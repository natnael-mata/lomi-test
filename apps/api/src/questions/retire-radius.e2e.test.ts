/**
 * Integration test — the blast radius of a retirement, and what a retired
 * question is no longer allowed to reach (T-070, T-071).
 *
 * Both halves were deferred for the same reason: neither could be written
 * before `Attempt`, `Sitting` and `GET /questions/next` existed. They do now.
 *
 * Needs Postgres (`npm run db:dev`). CI provides it as a service container.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { signInAsStaff, type StaffSession } from '../auth/staff-testkit.test-helper';
import { SUBSCRIPTION_ACCESS, type SubscriptionAccess } from '../practice/subscription-access';
import { PrismaService } from '../prisma/prisma.service';

const SFX = 'e2e-radius';
const TG = 566000008;

class AlwaysSubscribed implements SubscriptionAccess {
  hasActiveSubscription(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

describe('retiring a question (T-070, T-071)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let staff: StaffSession;
  let fieldId = '';
  let topicId = '';
  const questionIds: string[] = [];

  const wipe = async (): Promise<void> => {
    const fields = await prisma.field.findMany({
      where: { slug: { contains: SFX } },
      select: { id: true },
    });
    const ids = fields.map((f) => f.id);
    const sittings = await prisma.sitting.findMany({
      where: { fieldId: { in: ids } },
      select: { id: true },
    });
    const sittingIds = sittings.map((s) => s.id);
    const exams = await prisma.exam.findMany({
      where: { fieldId: { in: ids } },
      select: { id: true },
    });

    await prisma.sittingResult.deleteMany({ where: { sittingId: { in: sittingIds } } });
    await prisma.sittingAnswer.deleteMany({ where: { sittingId: { in: sittingIds } } });
    await prisma.sitting.deleteMany({ where: { id: { in: sittingIds } } });
    await prisma.examQuestion.deleteMany({ where: { examId: { in: exams.map((e) => e.id) } } });
    await prisma.exam.deleteMany({ where: { id: { in: exams.map((e) => e.id) } } });
    await prisma.attempt.deleteMany({ where: { fieldId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { stableId: { contains: SFX } } });
    await prisma.option.deleteMany({ where: { question: { fieldId: { in: ids } } } });
    await prisma.question.deleteMany({ where: { fieldId: { in: ids } } });
    await prisma.topic.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.course.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.field.deleteMany({ where: { id: { in: ids } } });
    await prisma.staffMember.deleteMany({ where: { grantedBy: `test-${SFX}` } });
    await prisma.session.deleteMany({ where: { user: { telegramId: String(TG) } } });
    await prisma.user.deleteMany({ where: { telegramId: String(TG) } });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SUBSCRIPTION_ACCESS)
      .useClass(AlwaysSubscribed)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await wipe();

    const field = await prisma.field.create({
      data: { name: `Radius ${SFX}`, slug: `field-${SFX}`, isPublished: true },
    });
    fieldId = field.id;
    const course = await prisma.course.create({
      data: { fieldId, name: 'Course', slug: `course-${SFX}` },
    });
    const topic = await prisma.topic.create({
      data: { courseId: course.id, name: 'Topic', slug: `topic-${SFX}`, weightPct: 100 },
    });
    topicId = topic.id;

    // Four published questions, so retiring one still leaves a pool to serve.
    for (let i = 0; i < 4; i++) {
      const q = await prisma.question.create({
        data: {
          stableId: `RAD-${i}-${SFX}`,
          topicId,
          fieldId,
          qType: 'CONCEPT',
          stem: `Question ${i}`,
          conceptLine: 'concept',
          explanation: 'explanation',
          timeLimitSec: 60,
          status: 'PUBLISHED',
          options: {
            create: [
              { label: 'A', text: 'a', isCorrect: true },
              { label: 'B', text: 'b', isCorrect: false, whyWrong: 'no' },
              { label: 'C', text: 'c', isCorrect: false, whyWrong: 'no' },
              { label: 'D', text: 'd', isCorrect: false, whyWrong: 'no' },
            ],
          },
        },
      });
      questionIds.push(q.id);
    }

    staff = await signInAsStaff(app, prisma, TG, 'ADMIN', SFX);
    await prisma.user.update({ where: { id: staff.userId }, data: { fieldId } });
  });

  afterAll(async () => {
    await wipe();
    await app.close();
  });

  describe('the blast radius (T-070)', () => {
    /**
     * T-070's stated test. The counts were `null` until now — **not zero**,
     * because "retiring this disturbs nobody" was a claim the code could not
     * make before the tables existed.
     */
    it('reports counts of affected attempts and live sittings', async () => {
      const victim = questionIds[0]!;

      // Three students' history on this question…
      for (let i = 0; i < 3; i++) {
        await prisma.attempt.create({
          data: {
            userId: staff.userId,
            questionId: victim,
            fieldId,
            topicId,
            chosenLabel: 'A',
            isCorrect: true,
            timeTakenSec: 20,
          },
        });
      }

      // …and one exam in progress with it on the paper.
      const exam = await prisma.exam.create({
        data: {
          fieldId,
          slug: `mock-${SFX}`,
          name: 'Mock',
          conceptCount: 2,
          calculationCount: 0,
          durationSec: 600,
          isActive: true,
          builtBy: staff.userId,
          builtAt: new Date(),
          topicPlan: [],
        },
      });
      await prisma.examQuestion.create({
        data: {
          examId: exam.id,
          position: 1,
          questionId: victim,
          topicId,
          qType: 'CONCEPT',
          timeLimitSec: 60,
        },
      });
      const session = await prisma.session.findFirstOrThrow({ where: { userId: staff.userId } });
      await prisma.sitting.create({
        data: {
          userId: staff.userId,
          examId: exam.id,
          fieldId,
          startedAt: new Date(),
          endsAt: new Date(Date.now() + 600_000),
          startedBySessionId: session.id,
        },
      });

      const body = (
        await request(app.getHttpServer())
          .post(`/admin/questions/${victim}/retire`)
          .set(staff.auth)
          .send({ reason: 'The answer key is wrong.' })
          .expect(201)
      ).body;

      expect(body.status).toBe('RETIRED');
      expect(body.blastRadius).toEqual({ attempts: 3, liveSittings: 1, measurable: true });
    });

    /**
     * Itemised, never summarised (DESIGN.md). The two counts are different kinds
     * of harm — history that stays correct, versus a student in a timed exam
     * right now — and a single total would let an operator skim past both.
     */
    it('keeps the two counts apart rather than totalling them', async () => {
      const body = (
        await request(app.getHttpServer())
          .post(`/admin/questions/${questionIds[0]}/retire`)
          .set(staff.auth)
          .send({})
          .expect(201)
      ).body;
      expect(Object.keys(body.blastRadius).sort()).toEqual([
        'attempts',
        'liveSittings',
        'measurable',
      ]);
      expect(body.blastRadius).not.toHaveProperty('total');
    });

    // Somebody re-running a retirement is usually somebody checking what it
    // cost. "Unknown" is unhelpful in the one moment the number is wanted.
    it('still measures when the question was already retired', async () => {
      const body = (
        await request(app.getHttpServer())
          .post(`/admin/questions/${questionIds[0]}/retire`)
          .set(staff.auth)
          .send({})
          .expect(201)
      ).body;
      expect(body.alreadyRetired).toBe(true);
      expect(body.blastRadius.measurable).toBe(true);
      expect(body.blastRadius.attempts).toBe(3);
    });

    /**
     * A closed sitting is not disturbed. It was graded against the key as it
     * stood, and retiring the question now does not reach back into it —
     * counting it would inflate the number an operator is deciding on.
     */
    it('counts only sittings still in progress', async () => {
      await prisma.sitting.updateMany({
        where: { fieldId, closedAt: null },
        data: { closedAt: new Date(), closeReason: 'SUBMITTED' },
      });

      const body = (
        await request(app.getHttpServer())
          .post(`/admin/questions/${questionIds[0]}/retire`)
          .set(staff.auth)
          .send({})
          .expect(201)
      ).body;
      expect(body.blastRadius.liveSittings).toBe(0);
      expect(body.blastRadius.attempts).toBe(3);
    });

    // Zero now means zero. It is a measurement, not a placeholder.
    it('reports real zeroes for a question nobody has touched', async () => {
      const body = (
        await request(app.getHttpServer())
          .post(`/admin/questions/${questionIds[1]}/retire`)
          .set(staff.auth)
          .send({})
          .expect(201)
      ).body;
      expect(body.blastRadius).toEqual({ attempts: 0, liveSittings: 0, measurable: true });
    });
  });

  describe('a retired question is gone from every student surface (T-071)', () => {
    /**
     * T-071's stated test, at its stated scale.
     *
     * Two questions remain published, so a retired one reappearing would show up
     * quickly — and asking a hundred times is what makes "never" mean never
     * rather than "not on the first try".
     */
    it('never comes back from /questions/next across a hundred requests', async () => {
      const retired = new Set([questionIds[0], questionIds[1]]);
      const seen = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const res = await request(app.getHttpServer())
          .get('/questions/next')
          .set(staff.auth)
          .expect(200);
        if (res.body?.questionId) seen.add(String(res.body.questionId));
      }

      expect(seen.size).toBeGreaterThan(0);
      for (const id of seen) {
        expect(retired.has(id), `retired question ${id} was served`).toBe(false);
      }
    });

    /**
     * The stronger version of the same claim.
     *
     * A response test only covers the routes somebody remembered to check. This
     * asks the sampler's own source — the published pool — so a new student
     * route reading it inherits the guarantee instead of needing its own test.
     */
    it('is not in the published pool the sampler draws from', async () => {
      const pool = await prisma.question.findMany({
        where: { fieldId, status: 'PUBLISHED' },
        select: { id: true },
      });
      const ids = pool.map((q) => q.id);
      expect(ids).not.toContain(questionIds[0]);
      expect(ids).not.toContain(questionIds[1]);
      expect(ids).toHaveLength(2);
    });

    // Retired, never deleted: a student's history pointing at nothing is a worse
    // artefact than a bad question nobody is served.
    it('keeps the row and the attempts that reference it', async () => {
      const row = await prisma.question.findUniqueOrThrow({ where: { id: questionIds[0]! } });
      expect(row.status).toBe('RETIRED');
      expect(await prisma.attempt.count({ where: { questionId: questionIds[0]! } })).toBe(3);
    });
  });
});
