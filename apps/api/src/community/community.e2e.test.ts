/**
 * Integration test — the community (T-195, T-196, T-197).
 *
 * The rules with judgement in them are proved in `community.test.ts` without a
 * database. What is checked here is what only a running application can show:
 * that a thread is invisible outside its own topic *and* its own programme, that
 * a reply's badge is a fact about the reply rather than about its author today,
 * and that reporting a post does not remove it.
 *
 * Needs Postgres (`npm run db:dev`).
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimitService } from '../common/rate-limit.service';
import { cleanupStaff, signInAsStaff, type StaffSession } from '../auth/staff-testkit.test-helper';
import { CommunityService } from './community.service';

const SFX = 'e2e-community';
const TG_STUDENT = 566000071;
const TG_OTHER = 566000072;
const TG_REVIEWER = 566000073;
const TG_ALL = [TG_STUDENT, TG_OTHER, TG_REVIEWER];

describe('the community (T-195, T-196, T-197)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let community: CommunityService;
  let rateLimit: RateLimitService;

  let student: StaffSession;
  let other: StaffSession;
  let reviewer: StaffSession;

  let topicA = '';
  let topicB = '';
  let topicOtherField = '';

  const wipe = async (): Promise<void> => {
    await prisma.report.deleteMany({});
    await prisma.post.deleteMany({});
    await prisma.thread.deleteMany({});
    await cleanupStaff(prisma, TG_ALL, SFX);
    await prisma.topic.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.course.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.field.deleteMany({ where: { slug: { contains: SFX } } });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    community = app.get(CommunityService);
    rateLimit = app.get(RateLimitService);

    await wipe();

    const fieldOne = await prisma.field.create({
      data: { name: `One ${SFX}`, slug: `one-${SFX}`, isPublished: true },
    });
    const fieldTwo = await prisma.field.create({
      data: { name: `Two ${SFX}`, slug: `two-${SFX}`, isPublished: true },
    });
    const courseOne = await prisma.course.create({
      data: { fieldId: fieldOne.id, name: `C1 ${SFX}`, slug: `c1-${SFX}` },
    });
    const courseTwo = await prisma.course.create({
      data: { fieldId: fieldTwo.id, name: `C2 ${SFX}`, slug: `c2-${SFX}` },
    });

    topicA = (
      await prisma.topic.create({
        data: { courseId: courseOne.id, name: `A ${SFX}`, slug: `a-${SFX}` },
      })
    ).id;
    topicB = (
      await prisma.topic.create({
        data: { courseId: courseOne.id, name: `B ${SFX}`, slug: `b-${SFX}` },
      })
    ).id;
    topicOtherField = (
      await prisma.topic.create({
        data: { courseId: courseTwo.id, name: `X ${SFX}`, slug: `x-${SFX}` },
      })
    ).id;

    student = await signInAsStaff(app, prisma, TG_STUDENT, 'REVIEWER', SFX);
    other = await signInAsStaff(app, prisma, TG_OTHER, 'REVIEWER', SFX);
    reviewer = await signInAsStaff(app, prisma, TG_REVIEWER, 'REVIEWER', SFX);
    // Only the reviewer keeps a staff row; the other two are students.
    await prisma.staffMember.deleteMany({
      where: { userId: { in: [student.userId, other.userId] } },
    });

    await prisma.user.update({ where: { id: student.userId }, data: { fieldId: fieldOne.id } });
    await prisma.user.update({ where: { id: reviewer.userId }, data: { fieldId: fieldOne.id } });
    // `other` studies the second programme.
    await prisma.user.update({ where: { id: other.userId }, data: { fieldId: fieldTwo.id } });
  });

  beforeEach(async () => {
    await prisma.report.deleteMany({});
    await prisma.post.deleteMany({});
    await prisma.thread.deleteMany({});
    // The limiter is per process and shared across tests; a suite that posts
    // repeatedly would otherwise rate-limit itself.
    rateLimit.reset();
  });

  afterAll(async () => {
    await wipe();
    await app.close();
  });

  describe('threads are scoped (T-195)', () => {
    /** T-195's stated test. */
    it('shows a thread only under its own topic', async () => {
      const { id } = await community.openThread(student.userId, topicA, 'Why B?', 'I chose C.');

      const inA = await community.threadsForTopic(student.userId, topicA);
      const inB = await community.threadsForTopic(student.userId, topicB);

      expect(inA.map((t) => t.id)).toContain(id);
      expect(inB).toHaveLength(0);
    });

    /**
     * The scoping that matters more, and that the task's test does not reach: a
     * topic id is guessable, so scoping on it alone would let anybody read
     * another programme's discussion by typing a different one.
     */
    it('shows nothing to a student in another programme', async () => {
      const { id } = await community.openThread(student.userId, topicA, 'Why B?', 'I chose C.');

      expect(await community.threadsForTopic(other.userId, topicA)).toHaveLength(0);
      // And the thread itself is not found rather than forbidden — "no such
      // thread" and "not yours" are the same answer, so this cannot be used to
      // discover which threads exist.
      await expect(community.threadFor(other.userId, id)).rejects.toMatchObject({ status: 404 });
    });

    it('refuses to open a thread in another programme’s topic', async () => {
      await expect(
        community.openThread(student.userId, topicOtherField, 'Hello', 'Body'),
      ).rejects.toMatchObject({ status: 403 });
    });

    /**
     * The denormalised `fieldId` is enforced by the database, like
     * `Question.fieldId`. Without it, one mismatched row shows one programme's
     * discussion to another's students.
     */
    it('will not store a thread whose field disagrees with its topic', async () => {
      const wrongField = await prisma.field.findFirstOrThrow({
        where: { slug: `two-${SFX}` },
      });
      await expect(
        prisma.thread.create({
          data: {
            topicId: topicA,
            fieldId: wrongField.id,
            authorId: student.userId,
            title: 'Mismatched',
            body: 'Should not land',
          },
        }),
      ).rejects.toThrow();
    });

    it('requires a programme before joining in', async () => {
      const nomad = await prisma.user.create({
        data: { telegramId: '566000079', displayName: 'NoFieldStudent' },
      });
      try {
        await expect(community.threadsForTopic(nomad.id, topicA)).rejects.toMatchObject({
          status: 403,
        });
      } finally {
        await prisma.user.delete({ where: { id: nomad.id } });
      }
    });
  });

  describe('a reviewer’s reply is marked (T-196)', () => {
    /** T-196's stated test. */
    it('verifies a reviewer and not a student', async () => {
      const { id } = await community.openThread(student.userId, topicA, 'Why B?', 'I chose C.');
      await community.reply(student.userId, id, 'I think it is C too.');
      await community.reply(reviewer.userId, id, 'B is correct: the asset is realised in a year.');

      const view = await community.threadFor(student.userId, id);
      const [studentReply, reviewerReply] = view.posts;

      expect(studentReply?.verified).toBe(false);
      expect(reviewerReply?.verified).toBe(true);
    });

    /**
     * **The badge is a fact about the reply, not about its author today.** A
     * student later made a reviewer must not have their old guesses
     * retroactively endorsed — which is the whole reason the role is stamped
     * onto the row.
     */
    it('does not endorse an old guess when its author is promoted', async () => {
      const { id } = await community.openThread(student.userId, topicA, 'Why B?', 'I chose C.');
      await community.reply(student.userId, id, 'It is definitely C.');

      await prisma.staffMember.create({
        data: { userId: student.userId, role: 'REVIEWER', grantedBy: `test-${SFX}` },
      });
      try {
        const view = await community.threadFor(student.userId, id);
        expect(view.posts[0]?.verified).toBe(false);
      } finally {
        await prisma.staffMember.deleteMany({ where: { userId: student.userId } });
      }
    });

    it('carries display names and nothing else', async () => {
      const { id } = await community.openThread(student.userId, topicA, 'Why B?', 'I chose C.');
      await community.reply(reviewer.userId, id, 'B is correct.');

      const res = await request(app.getHttpServer())
        .get(`/community/threads/${id}`)
        .set(student.auth)
        .expect(200);

      const body = JSON.stringify(res.body);
      for (const forbidden of ['verifiedName', 'telegramId', 'phone', 'authorId']) {
        expect(body.includes(forbidden), `${forbidden} appeared`).toBe(false);
      }
      expect(res.body.posts[0].authorName).toBeTruthy();
    });
  });

  describe('posting is bounded and posts are reportable (T-197)', () => {
    /** T-197's stated test: the sixth post in a minute is refused. */
    it('refuses the sixth post in a minute', async () => {
      const { id } = await community.openThread(student.userId, topicA, 'Why B?', 'I chose C.');
      // Opening the thread was the first.
      for (let i = 0; i < 4; i++) {
        await community.reply(student.userId, id, `Reply ${i}`);
      }
      await expect(community.reply(student.userId, id, 'One too many')).rejects.toMatchObject({
        status: 429,
      });
    });

    it('tells somebody how long to wait', async () => {
      const { id } = await community.openThread(student.userId, topicA, 'Why B?', 'I chose C and got it wrong.');
      for (let i = 0; i < 4; i++) await community.reply(student.userId, id, `Reply ${i}`);

      const res = await request(app.getHttpServer())
        .post(`/community/threads/${id}/posts`)
        .set(student.auth)
        .send({ body: 'One too many' })
        .expect(429);
      expect(res.body.retryAfterSec).toBeGreaterThan(0);
    });

    /** T-197's other half: reporting flags the post for moderation. */
    it('queues a report without hiding anything', async () => {
      const { id } = await community.openThread(student.userId, topicA, 'Why B?', 'I chose C.');
      const post = await community.reply(reviewer.userId, id, 'B is correct.');

      await community.report(student.userId, post.id, 'WRONG', 'The key says C.');

      const queue = await community.pendingReports();
      expect(queue.map((r) => r.postId)).toContain(post.id);

      // Still there. A report is one person's opinion, not a delete button.
      const view = await community.threadFor(student.userId, id);
      expect(view.posts.map((p) => p.id)).toContain(post.id);
      expect(view.posts[0]?.hidden).toBe(false);
    });

    it('counts one report per person however many times they tap', async () => {
      const { id } = await community.openThread(student.userId, topicA, 'Why B?', 'I chose C and got it wrong.');
      const post = await community.reply(reviewer.userId, id, 'B is correct.');

      await community.report(student.userId, post.id, 'WRONG');
      await community.report(student.userId, post.id, 'SPAM');

      expect(await prisma.report.count({ where: { postId: post.id } })).toBe(1);
      // The latest reason wins, so a corrected report is not a second one.
      expect((await prisma.report.findFirstOrThrow({ where: { postId: post.id } })).reason).toBe(
        'SPAM',
      );
    });

    it('refuses a reason it cannot triage', async () => {
      const { id } = await community.openThread(student.userId, topicA, 'Why B?', 'I chose C and got it wrong.');
      const post = await community.reply(reviewer.userId, id, 'B is correct.');
      await expect(community.report(student.userId, post.id, 'because')).rejects.toMatchObject({
        status: 403,
      });
    });

    it('hides a post only when an operator does', async () => {
      const { id } = await community.openThread(student.userId, topicA, 'Why B?', 'I chose C and got it wrong.');
      const post = await community.reply(reviewer.userId, id, 'Something unhelpful.');
      await community.report(student.userId, post.id, 'ABUSIVE');

      await community.setPostHidden(post.id, 'staff-1', true, 'Off topic');

      const view = await community.threadFor(student.userId, id);
      expect(view.posts.map((p) => p.id)).not.toContain(post.id);
      // And the queue is cleared, so the same report is not worked twice.
      expect(await community.pendingReports()).toHaveLength(0);
    });

    /**
     * The author still sees it. Somebody whose post vanished without
     * explanation assumes it was censored, and they are halfway right.
     */
    it('still shows the author their own hidden post', async () => {
      const { id } = await community.openThread(student.userId, topicA, 'Why B?', 'I chose C and got it wrong.');
      const post = await community.reply(reviewer.userId, id, 'Something unhelpful.');
      await community.setPostHidden(post.id, 'staff-1', true);

      const theirs = await community.threadFor(reviewer.userId, id);
      const mine = theirs.posts.find((p) => p.id === post.id);
      expect(mine?.hidden).toBe(true);
    });

    it('puts a post back', async () => {
      const { id } = await community.openThread(student.userId, topicA, 'Why B?', 'I chose C and got it wrong.');
      const post = await community.reply(reviewer.userId, id, 'Fine after all.');
      await community.setPostHidden(post.id, 'staff-1', true);
      await community.setPostHidden(post.id, 'staff-1', false);

      const view = await community.threadFor(student.userId, id);
      expect(view.posts.map((p) => p.id)).toContain(post.id);
    });
  });

  describe('who may reach it', () => {
    it('turns away a caller with no session', async () => {
      await request(app.getHttpServer()).get(`/community/topics/${topicA}/threads`).expect(401);
      await request(app.getHttpServer()).get('/admin/community/reports').expect(401);
    });

    it('keeps the moderation queue to staff', async () => {
      await request(app.getHttpServer())
        .get('/admin/community/reports')
        .set(student.auth)
        .expect(403);
    });
  });
});
