/**
 * Integration test — building a mock paper (T-120, T-120a, T-121, T-121a).
 *
 * Sampling reads the whole published pool in a field, so every test here builds
 * its **own** SFX-scoped field. Reusing a shared one would mean testing whatever
 * happened to be imported that week.
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
import { DEFAULT_BLUEPRINT, TIME_LIMIT_SEC } from './exam-blueprint';

const SFX = 'e2e-exambuild';
const TG_ADMIN = 565000001;

describe('POST /admin/exams', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: StaffSession;

  /** A field with a bank big enough to draw a paper from. */
  const buildField = async (
    slug: string,
    concept: number,
    calculation: number,
    topicNames: string[] = ['Alpha', 'Beta'],
  ): Promise<string> => {
    const field = await prisma.field.create({
      data: { name: `Exam ${slug}`, slug, isPublished: true },
    });
    const course = await prisma.course.create({
      data: { fieldId: field.id, name: 'Course', slug: `${slug}-course` },
    });
    const topics = [];
    for (const [i, name] of topicNames.entries()) {
      topics.push(
        await prisma.topic.create({
          data: {
            courseId: course.id,
            name,
            slug: `${slug}-topic-${i}`,
            // Weights must sum to exactly 100 or the build refuses.
            weightPct: Number((100 / topicNames.length).toFixed(2)),
          },
        }),
      );
    }
    // Nudge the last weight so they sum to exactly 100.00.
    const sum = topics.length * Number((100 / topics.length).toFixed(2));
    if (sum !== 100) {
      await prisma.topic.update({
        where: { id: topics[topics.length - 1]!.id },
        data: { weightPct: Number((100 / topics.length).toFixed(2)) + (100 - sum) },
      });
    }

    let n = 0;
    for (const [qType, count] of [
      ['CONCEPT', concept],
      ['CALCULATION', calculation],
    ] as const) {
      for (let i = 0; i < count; i++) {
        const topic = topics[i % topics.length]!;
        await prisma.question.create({
          data: {
            stableId: `${slug}-Q${++n}`,
            topicId: topic.id,
            fieldId: field.id,
            qType,
            stem: `Question ${n}`,
            conceptLine: 'A concept.',
            explanation: 'Because.',
            timeLimitSec: TIME_LIMIT_SEC[qType],
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
      }
    }
    return field.id;
  };

  /** Deleted in foreign-key order: exam questions, exams, then the bank. */
  const cleanup = async (): Promise<void> => {
    const fields = await prisma.field.findMany({
      where: { slug: { contains: SFX } },
      select: { id: true },
    });
    const fieldIds = fields.map((f) => f.id);
    const exams = await prisma.exam.findMany({
      where: { fieldId: { in: fieldIds } },
      select: { id: true },
    });
    const examIds = exams.map((e) => e.id);

    await prisma.examQuestion.deleteMany({ where: { examId: { in: examIds } } });
    await prisma.exam.deleteMany({ where: { id: { in: examIds } } });
    await prisma.option.deleteMany({ where: { question: { fieldId: { in: fieldIds } } } });
    await prisma.question.deleteMany({ where: { fieldId: { in: fieldIds } } });
    await prisma.topic.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.course.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.field.deleteMany({ where: { id: { in: fieldIds } } });
    await prisma.staffMember.deleteMany({ where: { grantedBy: `test-${SFX}` } });
    await prisma.session.deleteMany({ where: { user: { telegramId: String(TG_ADMIN) } } });
    await prisma.user.deleteMany({ where: { telegramId: String(TG_ADMIN) } });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();
    admin = await signInAsStaff(app, prisma, TG_ADMIN, 'ADMIN', SFX);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  const build = async (fieldId: string, expectStatus = 201, body: object = {}) =>
    (
      await request(app.getHttpServer())
        .post('/admin/exams')
        .set(admin.auth)
        .send({ fieldId, ...body })
        .expect(expectStatus)
    ).body;

  // T-120's own test.
  it('freezes a 100-question paper, 60 concept and 40 calculation', async () => {
    const fieldId = await buildField(`${SFX}-ok`, 80, 60);
    const exam = await build(fieldId);

    expect(exam.conceptCount).toBe(60);
    expect(exam.calculationCount).toBe(40);

    const rows = await prisma.examQuestion.findMany({ where: { examId: exam.id } });
    expect(rows).toHaveLength(100);
    expect(rows.filter((r) => r.qType === 'CONCEPT')).toHaveLength(60);
    expect(rows.filter((r) => r.qType === 'CALCULATION')).toHaveLength(40);
    expect(new Set(rows.map((r) => r.questionId)).size).toBe(100);
    expect(new Set(rows.map((r) => r.position)).size).toBe(100);
  });

  // T-121a, computed from the rows actually drawn.
  it('sums the sampled budgets to exactly the sitting length', async () => {
    const field = await prisma.field.findFirstOrThrow({ where: { slug: `${SFX}-ok` } });
    const exam = await prisma.exam.findFirstOrThrow({ where: { fieldId: field.id } });
    const rows = await prisma.examQuestion.findMany({ where: { examId: exam.id } });
    const total = rows.reduce((sum, r) => sum + r.timeLimitSec, 0);
    expect(total).toBe(10_800);
    expect(total).toBe(exam.durationSec);
    expect(exam.durationSec).toBe(DEFAULT_BLUEPRINT.durationSec);
  });

  // T-120's identity requirement, true by construction because the paper belongs
  // to the exam rather than being drawn per sitting.
  it('gives every sitting of one exam the same questions', async () => {
    const field = await prisma.field.findFirstOrThrow({ where: { slug: `${SFX}-ok` } });
    const exam = await prisma.exam.findFirstOrThrow({ where: { fieldId: field.id } });
    const first = await prisma.examQuestion.findMany({
      where: { examId: exam.id },
      orderBy: { position: 'asc' },
      select: { questionId: true },
    });
    const second = await prisma.examQuestion.findMany({
      where: { examId: exam.id },
      orderBy: { position: 'asc' },
      select: { questionId: true },
    });
    expect(first).toEqual(second);
  });

  it('records achieved against target per topic', async () => {
    const field = await prisma.field.findFirstOrThrow({ where: { slug: `${SFX}-ok` } });
    const exam = await prisma.exam.findFirstOrThrow({ where: { fieldId: field.id } });
    const plan = exam.topicPlan as unknown as { target: number; achieved: number }[];
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.reduce((n, r) => n + r.target, 0)).toBe(100);
    expect(plan.reduce((n, r) => n + r.achieved, 0)).toBe(100);
  });

  // T-120a's own test.
  it('refuses a bank with only 10 calculation questions, naming the shortfall', async () => {
    const fieldId = await buildField(`${SFX}-thin`, 80, 10);
    const body = await build(fieldId, 422);
    expect(body.error).toBe('CANNOT_BUILD_EXAM');
    expect(body.blockers.join(' ')).toContain('Need 40 CALCULATION questions, have 10');
    expect(body.blockers.join(' ')).toContain('short 30');
    expect(await prisma.exam.count({ where: { fieldId } })).toBe(0);
  });

  // T-121: duration is a column, not a constant.
  it('honours a different duration', async () => {
    const fieldId = await buildField(`${SFX}-short`, 80, 60);
    const exam = await build(fieldId, 201, {
      blueprint: { conceptCount: 10, calculationCount: 5, durationSec: 3600 },
    });
    expect(exam.durationSec).toBe(3600);
    const rows = await prisma.examQuestion.findMany({ where: { examId: exam.id } });
    expect(rows).toHaveLength(15);
  });

  it('refuses a blueprint that cannot be finished in its own duration', async () => {
    const fieldId = await buildField(`${SFX}-overrun`, 80, 60);
    const body = await build(fieldId, 422, {
      // 60 × 60 + 40 × 180 = 10,800 in a one-hour sitting.
      blueprint: { ...DEFAULT_BLUEPRINT, durationSec: 3600 },
    });
    expect(body.blockers.join(' ')).toContain('over by');
  });

  it('refuses when the field’s weights do not sum to 100', async () => {
    const fieldId = await buildField(`${SFX}-weights`, 80, 60);
    const topic = await prisma.topic.findFirstOrThrow({
      where: { slug: { startsWith: `${SFX}-weights-topic` } },
    });
    await prisma.topic.update({ where: { id: topic.id }, data: { weightPct: 10 } });
    const body = await build(fieldId, 422);
    expect(body.blockers.join(' ').toLowerCase()).toMatch(/100|sum/);
  });

  describe('readiness — the useful half of T-120a', () => {
    it('reports what is missing without building anything', async () => {
      const field = await prisma.field.findFirstOrThrow({ where: { slug: `${SFX}-thin` } });
      const body = (
        await request(app.getHttpServer())
          .get(`/admin/exams/${field.id}/readiness`)
          .set(admin.auth)
          .expect(200)
      ).body;

      expect(body.canBuild).toBe(false);
      expect(body.publishable).toEqual({ CONCEPT: 80, CALCULATION: 10 });
      expect(body.required).toEqual({ CONCEPT: 60, CALCULATION: 40 });
      expect(body.blockers.join(' ')).toContain('short 30');
      expect(await prisma.exam.count({ where: { fieldId: field.id } })).toBe(0);
    });

    // The real reason a pool comes back empty, and the one a bare "have 0"
    // would never explain.
    it('names unweighted topics as the reason the gate is refusing everything', async () => {
      const field = await prisma.field.create({
        data: { name: `Exam ${SFX}-unweighted`, slug: `${SFX}-unweighted`, isPublished: true },
      });
      const course = await prisma.course.create({
        data: { fieldId: field.id, name: 'C', slug: `${SFX}-unweighted-course` },
      });
      await prisma.topic.create({
        data: { courseId: course.id, name: 'T', slug: `${SFX}-unweighted-topic-0` },
      });

      const body = (
        await request(app.getHttpServer())
          .get(`/admin/exams/${field.id}/readiness`)
          .set(admin.auth)
          .expect(200)
      ).body;

      expect(body.unweightedTopics).toBe(1);
      expect(body.blockers.join(' ')).toContain('publish gate');
      expect(body.blockers.join(' ')).toContain('T-134');
    });
  });

  describe('access', () => {
    it('401s with no token and 403s for a student', async () => {
      const field = await prisma.field.findFirstOrThrow({ where: { slug: `${SFX}-ok` } });
      await request(app.getHttpServer())
        .post('/admin/exams')
        .send({ fieldId: field.id })
        .expect(401);
      await request(app.getHttpServer()).get(`/admin/exams/${field.id}/readiness`).expect(401);
    });
  });
});
