/**
 * Integration test — readiness and trend (T-135–T-138).
 *
 * The arithmetic is proved in `readiness.test.ts` and `trend.test.ts` without a
 * database. What is checked here is what only a database can show: that practice
 * attempts and mock answers merge into one chronological sequence, that the
 * weights on the rows are the effective ones including a reviewer's override,
 * and that a student can only ever read their own scores.
 *
 * Needs Postgres (`npm run db:dev`). CI provides it as a service container.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { signInAsStaff, type StaffSession } from '../auth/staff-testkit.test-helper';
import { PrismaService } from '../prisma/prisma.service';

const SFX = 'e2e-progress';
const TG = 566000005;
const TG_OTHER = 566000006;

describe('readiness and trend (T-135–T-138)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let student: StaffSession;
  let other: StaffSession;
  let fieldId = '';
  const topicIds: Record<string, string> = {};
  const questionIds: Record<string, string[]> = {};

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
    const topics = await prisma.topic.findMany({
      where: { slug: { contains: SFX } },
      select: { id: true },
    });

    await prisma.sittingResult.deleteMany({ where: { sittingId: { in: sittingIds } } });
    await prisma.sittingAnswer.deleteMany({ where: { sittingId: { in: sittingIds } } });
    await prisma.sitting.deleteMany({ where: { id: { in: sittingIds } } });
    await prisma.examQuestion.deleteMany({ where: { examId: { in: exams.map((e) => e.id) } } });
    await prisma.exam.deleteMany({ where: { id: { in: exams.map((e) => e.id) } } });
    await prisma.attempt.deleteMany({ where: { fieldId: { in: ids } } });
    await prisma.topicWeightOverride.deleteMany({
      where: { topicId: { in: topics.map((t) => t.id) } },
    });
    await prisma.option.deleteMany({ where: { question: { fieldId: { in: ids } } } });
    await prisma.question.deleteMany({ where: { fieldId: { in: ids } } });
    await prisma.topic.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.course.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.field.deleteMany({ where: { id: { in: ids } } });
    await prisma.staffMember.deleteMany({ where: { grantedBy: `test-${SFX}` } });
    for (const tg of [TG, TG_OTHER]) {
      await prisma.session.deleteMany({ where: { user: { telegramId: String(tg) } } });
      await prisma.user.deleteMany({ where: { telegramId: String(tg) } });
    }
  };

  /** The student's live session row — `Sitting.startedBySessionId` needs a real one. */
  const sessionIdOf = async (who: StaffSession): Promise<string> =>
    (await prisma.session.findFirstOrThrow({ where: { userId: who.userId } })).id;

  /** One practice attempt, at a chosen moment. */
  const attempt = async (
    userId: string,
    topic: string,
    index: number,
    isCorrect: boolean,
    at: Date,
  ): Promise<void> => {
    await prisma.attempt.create({
      data: {
        userId,
        questionId: questionIds[topic]![index]!,
        fieldId,
        topicId: topicIds[topic]!,
        chosenLabel: isCorrect ? 'A' : 'B',
        isCorrect,
        timeTakenSec: 30,
        createdAt: at,
      },
    });
  };

  const readiness = async (auth: StaffSession = student) =>
    (await request(app.getHttpServer()).get(`/me/readiness/${fieldId}`).set(auth.auth).expect(200))
      .body;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await wipe();

    const field = await prisma.field.create({
      data: { name: `Progress ${SFX}`, slug: `field-${SFX}`, isPublished: true },
    });
    fieldId = field.id;
    const course = await prisma.course.create({
      data: { fieldId, name: 'Course', slug: `course-${SFX}` },
    });

    // Two topics, deliberately unequal: 80/20 after deriving, so the weighted
    // mean is visibly not the plain mean.
    for (const [name, count] of [
      ['Algorithms', 8],
      ['Databases', 2],
    ] as const) {
      const topic = await prisma.topic.create({
        data: { courseId: course.id, name, slug: `topic-${name.toLowerCase()}-${SFX}` },
      });
      topicIds[name] = topic.id;
      questionIds[name] = [];
      for (let i = 0; i < count; i++) {
        const q = await prisma.question.create({
          data: {
            stableId: `P-${name}-${i}-${SFX}`,
            topicId: topic.id,
            fieldId,
            qType: 'CONCEPT',
            stem: `${name} ${i}`,
            timeLimitSec: 60,
            status: 'PUBLISHED',
          },
        });
        questionIds[name]!.push(q.id);
      }
    }

    student = await signInAsStaff(app, prisma, TG, 'ADMIN', SFX);
    other = await signInAsStaff(app, prisma, TG_OTHER, 'ADMIN', SFX);
    await prisma.user.update({ where: { id: student.userId }, data: { fieldId } });

    // Derive the weights: 8 and 2 published questions → 80 / 20.
    await request(app.getHttpServer())
      .post(`/admin/fields/${fieldId}/weights/derive`)
      .set(student.auth)
      .expect(201);
  });

  afterAll(async () => {
    await wipe();
    await app.close();
  });

  it('needs a session', async () => {
    await request(app.getHttpServer()).get(`/me/readiness/${fieldId}`).expect(401);
  });

  it('has no headline before anything is answered', async () => {
    const body = await readiness();
    expect(body.headlinePct).toBeNull();
    expect(body.unassessedWeightPct).toBe(100);
    expect(body.topics).toHaveLength(2);
    expect(body.practiceNext).toBeNull();
  });

  /** T-135's stated test, through the database. */
  it('returns weights summing to 100, every row carrying its source', async () => {
    const at = new Date('2026-07-01T08:00:00.000Z');
    await attempt(student.userId, 'Algorithms', 0, true, at);

    const body = await readiness();
    expect(body.topics.reduce((s: number, t: { weightPct: number }) => s + t.weightPct, 0)).toBe(
      100,
    );
    for (const row of body.topics) {
      expect(['derived', 'override']).toContain(row.weightSource);
    }
  });

  /** T-136's stated test: the headline is reconstructible from the rows. */
  it('has a headline that recomputes from its own rows', async () => {
    // Algorithms (80%): 2 of 4 right. Databases (20%): 1 of 2 right.
    const base = Date.parse('2026-07-02T08:00:00.000Z');
    await attempt(student.userId, 'Algorithms', 1, true, new Date(base + 1000));
    await attempt(student.userId, 'Algorithms', 2, false, new Date(base + 2000));
    await attempt(student.userId, 'Algorithms', 3, false, new Date(base + 3000));
    await attempt(student.userId, 'Databases', 0, true, new Date(base + 4000));
    await attempt(student.userId, 'Databases', 1, false, new Date(base + 5000));

    const body = await readiness();
    const scored = body.topics.filter((t: { scorePct: number | null }) => t.scorePct !== null);
    const weight = scored.reduce((s: number, t: { weightPct: number }) => s + t.weightPct, 0);
    const recomputed =
      scored.reduce(
        (s: number, t: { scorePct: number; weightPct: number }) => s + t.scorePct * t.weightPct,
        0,
      ) / weight;

    expect(Math.abs(recomputed - body.headlinePct)).toBeLessThanOrEqual(0.5);
    // 50% on 80% of the paper and 50% on 20% is 50 — and notably not a number
    // that would come out of averaging the topics unweighted by accident.
    expect(body.headlinePct).toBe(50);
  });

  /** T-137: below 60% is a focus topic, heaviest first. */
  it('flags topics under the pass-safe line and names one to practise', async () => {
    const body = await readiness();
    expect(body.topics.every((t: { scorePct: number }) => t.scorePct === 50)).toBe(true);
    expect(body.focus.map((t: { topicName: string }) => t.topicName)).toEqual([
      'Algorithms',
      'Databases',
    ]);
    // T-139's data: the CTA targets the heaviest weak topic by id.
    expect(body.practiceNext.topicId).toBe(topicIds.Algorithms);
    expect(body.practiceNext.topicName).toBe('Algorithms');
  });

  /**
   * The merge across two tables.
   *
   * A mock answer that came *after* a practice attempt on the same question is
   * the current evidence. Sorting each table separately and concatenating would
   * make the answer depend on which query ran last.
   */
  it('takes the most recent answer across practice and mocks alike', async () => {
    const exam = await prisma.exam.create({
      data: {
        fieldId,
        slug: `mock-${SFX}`,
        name: `Mock ${SFX}`,
        conceptCount: 2,
        calculationCount: 0,
        durationSec: 600,
        isActive: true,
        builtBy: student.userId,
        builtAt: new Date('2026-07-19T08:00:00.000Z'),
        topicPlan: [],
      },
    });
    await prisma.examQuestion.createMany({
      data: [
        {
          examId: exam.id,
          position: 1,
          questionId: questionIds.Algorithms![2]!,
          topicId: topicIds.Algorithms!,
          qType: 'CONCEPT' as const,
          timeLimitSec: 60,
        },
        {
          examId: exam.id,
          position: 2,
          questionId: questionIds.Algorithms![3]!,
          topicId: topicIds.Algorithms!,
          qType: 'CONCEPT' as const,
          timeLimitSec: 60,
        },
      ],
    });

    const startedAt = new Date('2026-07-20T08:00:00.000Z');
    const sitting = await prisma.sitting.create({
      data: {
        userId: student.userId,
        examId: exam.id,
        fieldId,
        startedAt,
        endsAt: new Date(startedAt.getTime() + 600_000),
        closedAt: new Date(startedAt.getTime() + 300_000),
        closeReason: 'SUBMITTED',
        scoreCorrect: 2,
        answeredCount: 2,
        startedBySessionId: await sessionIdOf(student),
      },
    });

    // Both were wrong in practice on 2 July; both right in the mock on 20 July.
    await prisma.sittingResult.createMany({
      data: [2, 3].map((i) => ({
        sittingId: sitting.id,
        questionId: questionIds.Algorithms![i]!,
        topicId: topicIds.Algorithms!,
        chosenLabel: 'A' as const,
        isCorrect: true,
        createdAt: new Date(startedAt.getTime() + 300_000),
      })),
    });

    const body = await readiness();
    const algorithms = body.topics.find((t: { topicName: string }) => t.topicName === 'Algorithms');
    // 4 questions, all now correct: the two the mock overwrote plus the two
    // that were already right.
    expect(algorithms.answered).toBe(4);
    expect(algorithms.correct).toBe(4);
    expect(algorithms.scorePct).toBe(100);
    expect(algorithms.focus).toBe(false);
  });

  /**
   * A mock question nobody reached is graded wrong for the mock score, and is
   * not evidence about knowledge. It is counted and reported instead.
   */
  it('excludes mock questions that ran out of time, and says how many', async () => {
    const sitting = await prisma.sitting.findFirstOrThrow({
      where: { userId: student.userId, fieldId },
    });
    await prisma.sittingResult.create({
      data: {
        sittingId: sitting.id,
        questionId: questionIds.Databases![0]!,
        topicId: topicIds.Databases!,
        chosenLabel: null,
        isCorrect: false,
        createdAt: new Date('2026-07-21T08:00:00.000Z'),
      },
    });

    const body = await readiness();
    expect(body.unansweredInMocks).toBe(1);
    // Databases still reads from the two practice attempts, not three rows.
    const databases = body.topics.find((t: { topicName: string }) => t.topicName === 'Databases');
    expect(databases.answered).toBe(2);
    expect(databases.scorePct).toBe(50);
  });

  it('uses a reviewer’s override as the weight (T-134a)', async () => {
    await request(app.getHttpServer())
      .post(`/admin/fields/${fieldId}/weights/topics/${topicIds.Databases}`)
      .set(student.auth)
      .send({ weightPct: 60, reason: 'Databases is heavier than the bank suggests.' })
      .expect(201);

    const body = await readiness();
    const databases = body.topics.find((t: { topicName: string }) => t.topicName === 'Databases');
    expect(databases.weightPct).toBe(60);
    expect(databases.weightSource).toBe('override');
    expect(body.topics.reduce((s: number, t: { weightPct: number }) => s + t.weightPct, 0)).toBe(
      100,
    );
    // And the headline moves with it: 100% on 40 and 50% on 60 is 70.
    expect(body.headlinePct).toBe(70);
  });

  /** Nobody reads anybody else's scores. */
  it('answers for the caller, never for whoever the path names', async () => {
    const mine = await readiness();
    const theirs = await readiness(other);
    expect(mine.headlinePct).not.toBeNull();
    expect(theirs.headlinePct).toBeNull();
    expect(theirs.totalAnswered).toBe(0);
  });

  describe('the trend (T-138)', () => {
    it('labels sittings "Mock 1", "Mock 2", in the order they were sat', async () => {
      const exam = await prisma.exam.findFirstOrThrow({ where: { fieldId } });
      const startedAt = new Date('2026-07-25T08:00:00.000Z');
      await prisma.sitting.create({
        data: {
          userId: student.userId,
          examId: exam.id,
          fieldId,
          startedAt,
          endsAt: new Date(startedAt.getTime() + 600_000),
          closedAt: new Date(startedAt.getTime() + 600_000),
          closeReason: 'EXPIRED',
          scoreCorrect: 1,
          answeredCount: 1,
          startedBySessionId: await sessionIdOf(student),
        },
      });

      const body = (
        await request(app.getHttpServer()).get(`/me/trend/${fieldId}`).set(student.auth).expect(200)
      ).body;

      expect(body.map((p: { label: string }) => p.label)).toEqual(['Mock 1', 'Mock 2']);
      // 1 of 2 on the second paper, and it expired with one question unreached.
      expect(body[1].scorePct).toBe(50);
      expect(body[1].ranOutOfTime).toBe(true);
      expect(body[1].unanswered).toBe(1);
    });

    it('is empty for a student who has sat none', async () => {
      const body = (
        await request(app.getHttpServer()).get(`/me/trend/${fieldId}`).set(other.auth).expect(200)
      ).body;
      expect(body).toEqual([]);
    });
  });
});
