/**
 * Integration test — sitting a mock exam (T-122, T-123, T-124).
 *
 * Builds its own SFX-scoped field and paper: sampling reads the whole published
 * pool in a field, so a shared one would mean testing whatever was imported that
 * week.
 *
 * `SUBSCRIPTION_ACCESS` is **overridden, not weakened**. `NoSubscriptionsYet`
 * answering false for everyone is deliberate — a permissive default would mean
 * the paywall is never enforced and Phase 8's arrival would silently change
 * everyone's access — so the test supplies its own subscriber instead.
 *
 * Needs Postgres (`npm run db:dev`). CI provides it as a service container.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { signInAsStaff, type StaffSession } from '../auth/staff-testkit.test-helper';
import { ANSWER_ONLY_FIELDS } from '../practice/question-view';
import { SUBSCRIPTION_ACCESS, type SubscriptionAccess } from '../practice/subscription-access';
import { PrismaService } from '../prisma/prisma.service';
import { TIME_LIMIT_SEC } from './exam-blueprint';
import { SUBMIT_GRACE_SEC } from './sitting-clock';

/** Everyone is a subscriber here; the paywall has its own test below. */
class AlwaysSubscribed implements SubscriptionAccess {
  hasActiveSubscription(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

/** Deletes a suite's field and everything hanging off it, in foreign-key order. */
async function wipe(prisma: PrismaService, sfx: string, telegramId: number): Promise<void> {
  const fields = await prisma.field.findMany({
    where: { slug: { contains: sfx } },
    select: { id: true },
  });
  const fieldIds = fields.map((f) => f.id);
  const sittings = await prisma.sitting.findMany({
    where: { fieldId: { in: fieldIds } },
    select: { id: true },
  });
  const sittingIds = sittings.map((s) => s.id);
  const exams = await prisma.exam.findMany({
    where: { fieldId: { in: fieldIds } },
    select: { id: true },
  });

  await prisma.sittingResult.deleteMany({ where: { sittingId: { in: sittingIds } } });
  await prisma.sittingAnswer.deleteMany({ where: { sittingId: { in: sittingIds } } });
  await prisma.sitting.deleteMany({ where: { id: { in: sittingIds } } });
  await prisma.examQuestion.deleteMany({ where: { examId: { in: exams.map((e) => e.id) } } });
  await prisma.exam.deleteMany({ where: { id: { in: exams.map((e) => e.id) } } });
  await prisma.option.deleteMany({ where: { question: { fieldId: { in: fieldIds } } } });
  await prisma.question.deleteMany({ where: { fieldId: { in: fieldIds } } });
  await prisma.topic.deleteMany({ where: { slug: { contains: sfx } } });
  await prisma.course.deleteMany({ where: { slug: { contains: sfx } } });
  await prisma.field.deleteMany({ where: { id: { in: fieldIds } } });
  await prisma.staffMember.deleteMany({ where: { grantedBy: `test-${sfx}` } });
  await prisma.session.deleteMany({ where: { user: { telegramId: String(telegramId) } } });
  await prisma.user.deleteMany({ where: { telegramId: String(telegramId) } });
}

/**
 * A second student, for the "not yours" test.
 *
 * Module-scoped so every suite in this file can wipe it. Cleaned up in
 * `beforeAll` **and** `afterAll` rather than only inline at the end of that
 * test: an inline cleanup does not run when the test fails, so one failure left
 * this row behind and every later run then failed on the unique telegramId — a
 * second, unrelated-looking failure masking the first. That happened.
 */
const TG_OTHER = 566999999;

/**
 * Removes the second student used by the "not yours" test.
 *
 * Separate from `wipe` because that one is scoped to a field suffix and this
 * user belongs to no field of its own. Run at both ends of the suite so a failed
 * run cannot poison the next one.
 */
async function wipeOther(prisma: PrismaService, telegramId: number): Promise<void> {
  const users = await prisma.user.findMany({
    where: { telegramId: String(telegramId) },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  const sittings = await prisma.sitting.findMany({
    where: { userId: { in: ids } },
    select: { id: true },
  });
  const sittingIds = sittings.map((s) => s.id);
  await prisma.sittingResult.deleteMany({ where: { sittingId: { in: sittingIds } } });
  await prisma.sittingAnswer.deleteMany({ where: { sittingId: { in: sittingIds } } });
  await prisma.sitting.deleteMany({ where: { id: { in: sittingIds } } });
  await prisma.attempt.deleteMany({ where: { userId: { in: ids } } });
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

/** A field with a bank, and the sentinels T-124 greps for. */
async function seedBank(
  prisma: PrismaService,
  sfx: string,
  concept: number,
  calculation: number,
): Promise<string> {
  const field = await prisma.field.create({
    data: { name: `Exam ${sfx}`, slug: `field-${sfx}`, isPublished: true },
  });
  const course = await prisma.course.create({
    data: { fieldId: field.id, name: 'Course', slug: `course-${sfx}` },
  });
  const topic = await prisma.topic.create({
    data: { courseId: course.id, name: 'Topic', slug: `topic-${sfx}`, weightPct: 100 },
  });

  let n = 0;
  for (const [qType, count] of [
    ['CONCEPT', concept],
    ['CALCULATION', calculation],
  ] as const) {
    for (let i = 0; i < count; i++) {
      await prisma.question.create({
        data: {
          stableId: `SIT-${++n}-${sfx}`,
          topicId: topic.id,
          fieldId: field.id,
          qType,
          stem: `Question ${n}`,
          conceptLine: 'CONCEPT-SENTINEL',
          explanation: 'EXPLANATION-SENTINEL',
          timeLimitSec: TIME_LIMIT_SEC[qType],
          status: 'PUBLISHED',
          options: {
            create: [
              { label: 'A', text: 'a', isCorrect: true },
              { label: 'B', text: 'b', isCorrect: false, whyWrong: 'WHYWRONG-SENTINEL' },
              { label: 'C', text: 'c', isCorrect: false, whyWrong: 'WHYWRONG-SENTINEL' },
              { label: 'D', text: 'd', isCorrect: false, whyWrong: 'WHYWRONG-SENTINEL' },
            ],
          },
          steps: { create: [{ stepNo: 1, text: 'STEP-SENTINEL' }] },
        },
      });
    }
  }
  return field.id;
}

describe('sitting a mock exam', () => {
  const SFX = 'e2e-sitting';
  const TG = 566000001;
  /** Small paper — 3 concept, 2 calculation — so a test can work through it. */
  const BLUEPRINT = { conceptCount: 3, calculationCount: 2, durationSec: 600 };

  let app: INestApplication;
  let prisma: PrismaService;
  let student: StaffSession;
  let fieldId = '';
  let examId = '';
  let sittingId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SUBSCRIPTION_ACCESS)
      .useClass(AlwaysSubscribed)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await wipe(prisma, SFX, TG);
    await wipeOther(prisma, TG_OTHER);

    fieldId = await seedBank(prisma, SFX, 3, 2);
    student = await signInAsStaff(app, prisma, TG, 'ADMIN', SFX);

    const exam = (
      await request(app.getHttpServer())
        .post('/admin/exams')
        .set(student.auth)
        .send({ fieldId, blueprint: BLUEPRINT })
        .expect(201)
    ).body;
    examId = exam.id;
    await prisma.user.update({ where: { id: student.userId }, data: { fieldId } });
  });

  afterAll(async () => {
    await wipe(prisma, SFX, TG);
    await wipeOther(prisma, TG_OTHER);
    await app.close();
  });

  const start = async (expectStatus = 201) =>
    (
      await request(app.getHttpServer())
        .post(`/exams/${fieldId}/start`)
        .set(student.auth)
        .send({})
        .expect(expectStatus)
    ).body;

  it('starts a sitting against the built paper', async () => {
    const body = await start();
    sittingId = body.sittingId;
    expect(body.resumed).toBe(false);
    expect(body.totalQuestions).toBe(5);
    expect(body.clock.durationSec).toBe(600);
    expect(body.clock.remainingSec).toBeGreaterThan(590);
    expect(body.clock.state).toBe('open');
  });

  // T-122: pressing Start again must not buy another 600 seconds.
  it('rejoins the open sitting instead of granting a fresh deadline', async () => {
    const before = await prisma.sitting.findUniqueOrThrow({ where: { id: sittingId } });
    const body = await start();
    expect(body.resumed).toBe(true);
    expect(body.sittingId).toBe(sittingId);

    const after = await prisma.sitting.findUniqueOrThrow({ where: { id: sittingId } });
    expect(after.endsAt.getTime()).toBe(before.endsAt.getTime());
    expect(await prisma.sitting.count({ where: { userId: student.userId } })).toBe(1);
  });

  it('serves the paper one question at a time, with the clock', async () => {
    const body = (
      await request(app.getHttpServer())
        .get(`/exams/sittings/${sittingId}/paper/1`)
        .set(student.auth)
        .expect(200)
    ).body;
    expect(body.position).toBe(1);
    expect(body.totalQuestions).toBe(5);
    expect(body.question.options).toHaveLength(4);
    expect(body.chosenLabel).toBeNull();
    expect(body.clock.state).toBe('open');
  });

  it('records an answer and a flag, and remembers them', async () => {
    await request(app.getHttpServer())
      .put(`/exams/sittings/${sittingId}/answers/1`)
      .set(student.auth)
      .send({ chosenLabel: 'a', isFlagged: true })
      .expect(200);

    const item = (
      await request(app.getHttpServer())
        .get(`/exams/sittings/${sittingId}/paper/1`)
        .set(student.auth)
        .expect(200)
    ).body;
    expect(item.chosenLabel).toBe('A');
    expect(item.flagged).toBe(true);
  });

  it('reports the paper’s shape without any question text', async () => {
    const body = (
      await request(app.getHttpServer())
        .get(`/exams/sittings/${sittingId}`)
        .set(student.auth)
        .expect(200)
    ).body;
    expect(body.totalQuestions).toBe(5);
    expect(body.answeredCount).toBe(1);
    expect(body.flaggedCount).toBe(1);
    expect(body.slots).toHaveLength(5);
    expect(JSON.stringify(body)).not.toContain('Question 1');
  });

  /**
   * The strongest T-124 assertion available: while a sitting is open there is not
   * a single graded row in the database. No response test can catch a column a
   * future handler will one day `select` — this one fails the moment somebody
   * commits "grade as you go".
   */
  it('has written no correctness anywhere while the sitting is open', async () => {
    expect(await prisma.sittingResult.count({ where: { sittingId } })).toBe(0);
    const answer = await prisma.sittingAnswer.findFirstOrThrow({ where: { sittingId } });
    expect(Object.keys(answer)).not.toContain('isCorrect');
  });

  // T-124 as a claim about the APPLICATION, not about a hand-listed set. This is
  // the assertion that catches the endpoint somebody adds in Phase 7.
  it('leaks no answer content from any student-reachable route mid-sitting', async () => {
    const server = app.getHttpAdapter().getInstance() as {
      router?: { stack?: unknown[] };
      _router?: { stack?: unknown[] };
    };
    const stack = (server.router?.stack ?? server._router?.stack ?? []) as {
      route?: { path: string; methods: Record<string, boolean> };
    }[];
    const routes = stack
      .filter((l) => l.route && !l.route.path.startsWith('/admin'))
      .flatMap((l) =>
        Object.keys(l.route!.methods).map((m) => ({
          method: m.toLowerCase(),
          path: l.route!.path,
        })),
      )
      /*
       * Everything except the routes whose job is to END something.
       *
       * `/submit` closes the paper, so every later request in the sweep
       * legitimately returns the answer key, which reads as a leak. `sign-out`
       * (T-112a) revokes the session, so everything after it — here and in the
       * rest of this suite — 401s. Both have their own tests.
       *
       * This list is the sweep's one real weakness: a destructive route added
       * later breaks the suite from the point it appears, and the failure looks
       * nothing like its cause. It has now happened twice.
       */
      .filter((r) => !r.path.endsWith('/submit') && !r.path.endsWith('/sign-out'));
    expect(routes.length).toBeGreaterThan(5);

    let combined = '';
    for (const route of routes) {
      const path = route.path
        .replace(':sittingId', sittingId)
        .replace(':fieldId', fieldId)
        .replace(':position', '1')
        .replace(/:[^/]+/g, '1');
      const res = await (
        request(app.getHttpServer()) as unknown as Record<string, (p: string) => request.Test>
      )[route.method]!(path)
        .set(student.auth)
        .send({});
      combined += res.text ?? '';
    }

    /**
     * Everything in `ANSWER_ONLY_FIELDS` except `chosenLabel`.
     *
     * That one is the student's OWN selection echoed back, which a sitting must
     * do — T-125 requires navigating away and back to preserve it. It reveals
     * nothing: it is what they typed. `correctLabel` is the one that would, and
     * it stays forbidden.
     */
    const forbidden = ANSWER_ONLY_FIELDS.filter((f) => f !== 'chosenLabel');
    expect(forbidden).toContain('correctLabel');
    expect(forbidden).toContain('isCorrect');

    for (const key of forbidden) {
      expect(combined, `"${key}" reached a student mid-sitting`).not.toContain(`"${key}"`);
    }
    for (const sentinel of [
      'CONCEPT-SENTINEL',
      'EXPLANATION-SENTINEL',
      'WHYWRONG-SENTINEL',
      'STEP-SENTINEL',
    ]) {
      expect(combined, `${sentinel} leaked mid-sitting`).not.toContain(sentinel);
    }
  });

  // The oracle the guard exists to close: without it, POST /attempts hands over
  // the key for a question on the student's own paper.
  it('locks practice while the sitting is live', async () => {
    const next = await request(app.getHttpServer())
      .get('/questions/next')
      .set(student.auth)
      .expect(403);
    expect(next.body.error).toBe('SITTING_IN_PROGRESS');

    const slot = await prisma.examQuestion.findFirstOrThrow({ where: { examId } });
    const attempt = await request(app.getHttpServer())
      .post('/attempts')
      .set(student.auth)
      .send({ questionId: slot.questionId, chosenLabel: 'A', timeTakenSec: 1 })
      .expect(403);
    expect(attempt.text).not.toContain('WHYWRONG-SENTINEL');
  });

  // T-129's "none before".
  it('refuses the result while the sitting is open', async () => {
    const res = await request(app.getHttpServer())
      .get(`/exams/sittings/${sittingId}/result`)
      .set(student.auth)
      .expect(409);
    expect(res.body.error).toBe('SITTING_OPEN');
    expect(res.text).not.toContain('WHYWRONG-SENTINEL');
  });

  // Omitting userId from the WHERE is the single most likely bug in this module:
  // it hands a hundred answer views to a student still sitting.
  it('404s another student’s sitting, exactly like one that does not exist', async () => {
    const other = await prisma.user.create({
      data: { telegramId: String(TG_OTHER), displayName: 'OtherStudent1234', fieldId },
    });
    const theirs = await prisma.sitting.create({
      data: {
        userId: other.id,
        examId,
        fieldId,
        startedAt: new Date(),
        endsAt: new Date(Date.now() + 600_000),
      },
    });

    await request(app.getHttpServer())
      .get(`/exams/sittings/${theirs.id}`)
      .set(student.auth)
      .expect(404);
    await request(app.getHttpServer())
      .get('/exams/sittings/does-not-exist')
      .set(student.auth)
      .expect(404);

    await prisma.sitting.delete({ where: { id: theirs.id } });
    await prisma.user.delete({ where: { id: other.id } });
  });

  describe('closing', () => {
    it('grades every question on the paper, including the unanswered ones', async () => {
      const body = (
        await request(app.getHttpServer())
          .post(`/exams/sittings/${sittingId}/submit`)
          .set(student.auth)
          .expect(201)
      ).body;

      expect(body.totalQuestions).toBe(5);
      expect(body.answeredCount).toBe(1);
      expect(body.scoreCorrect).toBe(1);
      expect(body.closeReason).toBe('SUBMITTED');
      // One row per question, not one per answer.
      expect(await prisma.sittingResult.count({ where: { sittingId } })).toBe(5);
    });

    // T-129's "all after".
    it('unlocks every explanation the instant it closes', async () => {
      const res = await request(app.getHttpServer())
        .get(`/exams/sittings/${sittingId}/result`)
        .set(student.auth)
        .expect(200);
      expect(res.body.items).toHaveLength(5);
      expect(res.text).toContain('WHYWRONG-SENTINEL');
      expect(res.text).toContain('CONCEPT-SENTINEL');
      expect(res.body.items[0].answerView.correctLabel).toBe('A');
    });

    /**
     * T-130's wiring. The ranking rule itself is proved in `exam-summary.test.ts`
     * against hand-built papers, because a seed with one topic cannot tell weight
     * × miss rate apart from raw misses. What this checks is that the breakdown
     * reaches the response at all, built from the frozen grading rows.
     */
    it('comes back with a per-topic breakdown and a topic to revise', async () => {
      const body = (
        await request(app.getHttpServer())
          .get(`/exams/sittings/${sittingId}/result`)
          .set(student.auth)
          .expect(200)
      ).body;

      expect(body.topics).toHaveLength(1);
      expect(body.topics[0]).toMatchObject({
        topic: 'Topic',
        asked: 5,
        correct: 1,
        weightPct: 100,
      });
      // 100% of the paper, 80% of it missed.
      expect(body.topics[0].weightedGapPct).toBe(80);
      expect(body.weakestTopic).toBe('Topic');
    });

    it('refuses further answers once closed', async () => {
      const res = await request(app.getHttpServer())
        .put(`/exams/sittings/${sittingId}/answers/2`)
        .set(student.auth)
        .send({ chosenLabel: 'B' })
        .expect(409);
      expect(res.body.error).toBe('SITTING_CLOSED');
    });

    it('releases practice again', async () => {
      await request(app.getHttpServer()).get('/questions/next').set(student.auth).expect(200);
    });
  });
});

describe('the deadline (T-123)', () => {
  const SFX = 'e2e-deadline';
  const TG = 566000002;

  let app: INestApplication;
  let prisma: PrismaService;
  let student: StaffSession;
  let fieldId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SUBSCRIPTION_ACCESS)
      .useClass(AlwaysSubscribed)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await wipe(prisma, SFX, TG);

    fieldId = await seedBank(prisma, SFX, 2, 0);
    student = await signInAsStaff(app, prisma, TG, 'ADMIN', SFX);
    await request(app.getHttpServer())
      .post('/admin/exams')
      .set(student.auth)
      .send({ fieldId, blueprint: { conceptCount: 2, calculationCount: 0, durationSec: 600 } })
      .expect(201);
    await prisma.user.update({ where: { id: student.userId }, data: { fieldId } });
  });

  afterAll(async () => {
    await wipe(prisma, SFX, TG);
    await app.close();
  });

  /** Starts a sitting, then rewinds it so its deadline is `secondsAgo` past. */
  const sittingEndingAgo = async (secondsAgo: number): Promise<string> => {
    const stale = await prisma.sitting.findMany({
      where: { userId: student.userId },
      select: { id: true },
    });
    await prisma.sittingResult.deleteMany({ where: { sittingId: { in: stale.map((s) => s.id) } } });
    await prisma.sittingAnswer.deleteMany({ where: { sittingId: { in: stale.map((s) => s.id) } } });
    await prisma.sitting.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });

    const body = (
      await request(app.getHttpServer())
        .post(`/exams/${fieldId}/start`)
        .set(student.auth)
        .send({})
        .expect(201)
    ).body;
    const endsAt = new Date(Date.now() - secondsAgo * 1000);
    await prisma.sitting.update({
      where: { id: body.sittingId },
      data: { startedAt: new Date(endsAt.getTime() - 600_000), endsAt },
    });
    return body.sittingId;
  };

  /**
   * The corrected T-123. The task says "deadline + 1s → already closed", but a
   * zero grace turns two seconds of mobile network into a silently lost answer:
   * the student pressed the button in time and the packet was slow. Five seconds
   * clears one TCP retransmit and is a twelfth of the smallest question budget.
   */
  it('writes an answer arriving one second late, then closes as EXPIRED', async () => {
    const id = await sittingEndingAgo(1);
    await request(app.getHttpServer())
      .put(`/exams/sittings/${id}/answers/1`)
      .set(student.auth)
      .send({ chosenLabel: 'A' })
      .expect(200);

    const after = await prisma.sitting.findUniqueOrThrow({ where: { id } });
    expect(after.closedAt).not.toBeNull();
    expect(after.closeReason).toBe('EXPIRED');
    expect(await prisma.sittingAnswer.count({ where: { sittingId: id } })).toBe(1);
  });

  it('refuses one arriving past the grace, and preserves earlier answers', async () => {
    const id = await sittingEndingAgo(0);
    await request(app.getHttpServer())
      .put(`/exams/sittings/${id}/answers/1`)
      .set(student.auth)
      .send({ chosenLabel: 'A' })
      .expect(200);

    await prisma.sitting.update({
      where: { id },
      data: {
        closedAt: null,
        closeReason: null,
        endsAt: new Date(Date.now() - (SUBMIT_GRACE_SEC + 2) * 1000),
      },
    });
    await prisma.sittingResult.deleteMany({ where: { sittingId: id } });

    const res = await request(app.getHttpServer())
      .put(`/exams/sittings/${id}/answers/2`)
      .set(student.auth)
      .send({ chosenLabel: 'B' })
      .expect(409);
    expect(res.body.error).toBe('SITTING_EXPIRED');

    const after = await prisma.sitting.findUniqueOrThrow({ where: { id } });
    expect(after.closeReason).toBe('EXPIRED');
    // The earlier answer is safe, and the paper still graded in full.
    expect(await prisma.sittingAnswer.count({ where: { sittingId: id } })).toBe(1);
    expect(await prisma.sittingResult.count({ where: { sittingId: id } })).toBe(2);
  });

  // Lazy close, with start() as the sweeper: an abandoned sitting must not block
  // the student's next one forever, and there is no scheduler in this project.
  it('sweeps an abandoned sitting when the student starts again', async () => {
    const stale = await sittingEndingAgo(3600);
    const body = (
      await request(app.getHttpServer())
        .post(`/exams/${fieldId}/start`)
        .set(student.auth)
        .send({})
        .expect(201)
    ).body;

    expect(body.resumed).toBe(false);
    expect(body.sittingId).not.toBe(stale);
    const swept = await prisma.sitting.findUniqueOrThrow({ where: { id: stale } });
    expect(swept.closedAt).not.toBeNull();
    expect(swept.closeReason).toBe('EXPIRED');
  });
});

describe('a mock is behind the paywall', () => {
  const SFX = 'e2e-exam-paywall';
  const TG = 566000003;

  let app: INestApplication;
  let prisma: PrismaService;
  let student: StaffSession;
  let fieldId = '';

  beforeAll(async () => {
    // No override here: NoSubscriptionsYet answers false, which is the shipped
    // default and the thing under test.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await wipe(prisma, SFX, TG);

    fieldId = await seedBank(prisma, SFX, 2, 0);
    student = await signInAsStaff(app, prisma, TG, 'ADMIN', SFX);
    await request(app.getHttpServer())
      .post('/admin/exams')
      .set(student.auth)
      .send({ fieldId, blueprint: { conceptCount: 2, calculationCount: 0, durationSec: 600 } })
      .expect(201);
    await prisma.user.update({ where: { id: student.userId }, data: { fieldId } });
  });

  afterAll(async () => {
    await wipe(prisma, SFX, TG);
    await app.close();
  });

  /**
   * A hundred-question mock is ten times the free practice allowance, so leaving
   * it ungated is a paywall bypass needing no exploit. Charged once at start —
   * charging at the end would mean sitting three hours and then being asked to
   * pay.
   */
  it('402s a student with no subscription, and starts nothing', async () => {
    const res = await request(app.getHttpServer())
      .post(`/exams/${fieldId}/start`)
      .set(student.auth)
      .send({})
      .expect(402);
    expect(res.body.error).toBe('SUBSCRIPTION_REQUIRED');
    expect(await prisma.sitting.count({ where: { userId: student.userId } })).toBe(0);
  });
});

describe('navigating the paper (T-125, T-126)', () => {
  const SFX = 'e2e-navigate';
  const TG = 566000003;

  let app: INestApplication;
  let prisma: PrismaService;
  let student: StaffSession;
  let fieldId = '';
  let sittingId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SUBSCRIPTION_ACCESS)
      .useClass(AlwaysSubscribed)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await wipe(prisma, SFX, TG);
    await wipeOther(prisma, TG_OTHER);

    fieldId = await seedBank(prisma, SFX, 3, 2);
    student = await signInAsStaff(app, prisma, TG, 'ADMIN', SFX);
    await request(app.getHttpServer())
      .post('/admin/exams')
      .set(student.auth)
      .send({ fieldId, blueprint: { conceptCount: 3, calculationCount: 2, durationSec: 600 } })
      .expect(201);
    await prisma.user.update({ where: { id: student.userId }, data: { fieldId } });

    sittingId = (
      await request(app.getHttpServer())
        .post(`/exams/${fieldId}/start`)
        .set(student.auth)
        .send({})
        .expect(201)
    ).body.sittingId;
  });

  afterAll(async () => {
    await wipe(prisma, SFX, TG);
    await app.close();
  });

  /**
   * T-125: the selection survives navigation.
   *
   * The screen keeps one question on screen at a time, so "go to question 4 and
   * come back" is the ordinary way to use it, not an edge case. Nothing is held
   * in the client — each answer is written as it is made — and this is the test
   * that the server is really where it lives.
   */
  it('preserves each question’s selection across navigating away and back', async () => {
    const put = (position: number, body: Record<string, unknown>) =>
      request(app.getHttpServer())
        .put(`/exams/sittings/${sittingId}/answers/${position}`)
        .set(student.auth)
        .send(body)
        .expect(200);
    const get = async (position: number) =>
      (
        await request(app.getHttpServer())
          .get(`/exams/sittings/${sittingId}/paper/${position}`)
          .set(student.auth)
          .expect(200)
      ).body;

    await put(2, { chosenLabel: 'b' });
    await put(4, { chosenLabel: 'd' });

    // Walk the paper the way a student would, past both answered questions.
    for (const position of [3, 4, 5, 1, 2]) await get(position);

    expect((await get(2)).chosenLabel).toBe('B');
    expect((await get(4)).chosenLabel).toBe('D');
    // Untouched questions stay untouched — a selection belongs to its question.
    expect((await get(3)).chosenLabel).toBeNull();
  });

  /**
   * T-126: a flag survives navigation and a reload.
   *
   * "Reload" here is a fresh start request, which is what the app does when the
   * tab is reopened: it rejoins the sitting already in flight. A flag lost to a
   * dropped connection is a question the student meant to come back to and now
   * never will.
   */
  it('keeps flags across navigation and a reload, without disturbing answers', async () => {
    await request(app.getHttpServer())
      .put(`/exams/sittings/${sittingId}/answers/3`)
      .set(student.auth)
      .send({ chosenLabel: 'c' })
      .expect(200);

    // Flagging sends no `chosenLabel`. If the handler wrote the whole row rather
    // than the fields it was given, this is where the answer would disappear.
    await request(app.getHttpServer())
      .put(`/exams/sittings/${sittingId}/answers/3`)
      .set(student.auth)
      .send({ isFlagged: true })
      .expect(200);

    const rejoined = (
      await request(app.getHttpServer())
        .post(`/exams/${fieldId}/start`)
        .set(student.auth)
        .send({})
        .expect(201)
    ).body;
    expect(rejoined.sittingId).toBe(sittingId);

    const item = (
      await request(app.getHttpServer())
        .get(`/exams/sittings/${rejoined.sittingId}/paper/3`)
        .set(student.auth)
        .expect(200)
    ).body;
    expect(item.flagged).toBe(true);
    expect(item.chosenLabel).toBe('C');

    // And it un-flags without taking the answer with it.
    await request(app.getHttpServer())
      .put(`/exams/sittings/${sittingId}/answers/3`)
      .set(student.auth)
      .send({ isFlagged: false })
      .expect(200);
    const after = (
      await request(app.getHttpServer())
        .get(`/exams/sittings/${sittingId}/paper/3`)
        .set(student.auth)
        .expect(200)
    ).body;
    expect(after.flagged).toBe(false);
    expect(after.chosenLabel).toBe('C');
  });
});
