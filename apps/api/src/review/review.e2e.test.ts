/**
 * Integration test — `GET /admin/review/next` against the real database.
 *
 * Needs Postgres (`npm run db:dev`). CI provides it as a service container.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { ANSWER_VIEW_FIELDS } from '../questions/answer-view';

const SFX = 'e2e-review';

describe('GET /admin/review/next (T-065)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let topicId = '';
  let fieldId = '';

  const make = async (
    stableId: string,
    over: { authorId?: string | null; status?: 'IN_REVIEW' | 'DRAFT' | 'PUBLISHED' } = {},
  ): Promise<string> => {
    const q = await prisma.question.create({
      data: {
        stableId: `${stableId}-${SFX}`,
        topicId,
        fieldId,
        qType: 'CONCEPT',
        stem: `Stem for ${stableId}`,
        timeLimitSec: 60,
        status: over.status ?? 'IN_REVIEW',
        authorId: over.authorId === undefined ? 'author-a' : over.authorId,
        options: {
          create: [
            { label: 'A', text: 'a', isCorrect: true },
            { label: 'B', text: 'b', isCorrect: false, whyWrong: 'because b' },
          ],
        },
      },
    });
    return q.id;
  };

  /** Nudges updatedAt so "oldest first" is testable without waiting. */
  const age = async (stableId: string, minutesAgo: number): Promise<void> => {
    const when = new Date(Date.parse('2026-01-01T00:00:00Z') + (1000 - minutesAgo) * 60_000);
    await prisma.$executeRaw`UPDATE "Question" SET "updatedAt" = ${when} WHERE "stableId" = ${`${stableId}-${SFX}`}`;
  };

  const cleanup = async (): Promise<void> => {
    await prisma.option.deleteMany({ where: { question: { stableId: { contains: SFX } } } });
    await prisma.step.deleteMany({ where: { question: { stableId: { contains: SFX } } } });
    await prisma.question.deleteMany({ where: { stableId: { contains: SFX } } });
    await prisma.topic.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.course.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.field.deleteMany({ where: { slug: { contains: SFX } } });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();

    const field = await prisma.field.create({
      data: { name: `Review ${SFX}`, slug: `field-${SFX}` },
    });
    fieldId = field.id;
    const course = await prisma.course.create({
      data: { fieldId, name: 'Course', slug: `course-${SFX}` },
    });
    const topic = await prisma.topic.create({
      data: { courseId: course.id, name: 'Topic', slug: `topic-${SFX}` },
    });
    topicId = topic.id;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  const next = async (reviewerId: string) =>
    (await request(app.getHttpServer()).get('/admin/review/next').query({ reviewerId }).expect(200))
      .body;

  it('returns null when the queue is empty', async () => {
    expect(await next('reviewer-b')).toEqual({});
  });

  // The task's own test.
  it('does not hand author A their own question', async () => {
    await make('OWN', { authorId: 'author-a' });
    expect(await next('author-a')).toEqual({});
    // And it is genuinely in the queue — just not for its author.
    expect((await next('reviewer-b')).answerView.stableId).toBe(`OWN-${SFX}`);
  });

  it('returns the oldest waiting question first', async () => {
    await make('NEWER', { authorId: 'author-c' });
    await age('OWN', 10);
    await age('NEWER', 1);
    expect((await next('reviewer-b')).answerView.stableId).toBe(`OWN-${SFX}`);
  });

  it('offers a question with no author to everyone', async () => {
    await prisma.question.deleteMany({ where: { stableId: { contains: SFX } } });
    await make('ORPHAN', { authorId: null });
    // NOT { authorId: 'x' } in SQL drops NULL rows unless handled; an
    // unattributed question is nobody's own work.
    expect((await next('anyone')).answerView.stableId).toBe(`ORPHAN-${SFX}`);
  });

  it('ignores questions that are not IN_REVIEW', async () => {
    await prisma.option.deleteMany({ where: { question: { stableId: { contains: SFX } } } });
    await prisma.question.deleteMany({ where: { stableId: { contains: SFX } } });
    await make('DRAFTED', { status: 'DRAFT' });
    await make('LIVE', { status: 'PUBLISHED' });
    expect(await next('reviewer-b')).toEqual({});
  });
});

describe('the review payload is the student answer view (T-066)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const SFX2 = 'e2e-review-shape';

  const cleanup = async (): Promise<void> => {
    await prisma.option.deleteMany({ where: { question: { stableId: { contains: SFX2 } } } });
    await prisma.step.deleteMany({ where: { question: { stableId: { contains: SFX2 } } } });
    await prisma.question.deleteMany({ where: { stableId: { contains: SFX2 } } });
    await prisma.topic.deleteMany({ where: { slug: { contains: SFX2 } } });
    await prisma.course.deleteMany({ where: { slug: { contains: SFX2 } } });
    await prisma.field.deleteMany({ where: { slug: { contains: SFX2 } } });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();

    const field = await prisma.field.create({
      data: { name: `Shape ${SFX2}`, slug: `field-${SFX2}` },
    });
    const course = await prisma.course.create({
      data: { fieldId: field.id, name: 'Taxation', slug: `course-${SFX2}` },
    });
    const topic = await prisma.topic.create({
      data: { courseId: course.id, name: 'VAT', slug: `topic-${SFX2}`, weightPct: 40 },
    });

    await prisma.question.create({
      data: {
        stableId: `SHAPE-${SFX2}`,
        topicId: topic.id,
        fieldId: field.id,
        qType: 'CALCULATION',
        stem: 'How much VAT is contained in Br 1,150,000?',
        codeBlock: null,
        conceptLine: 'VAT inside a gross amount is extracted with ×15/115.',
        explanation: null,
        timeLimitSec: 180,
        status: 'IN_REVIEW',
        authorId: 'author-x',
        importFlags: ['READY'],
        options: {
          create: [
            { label: 'A', text: '172,500', isCorrect: false, whyWrong: 'That is 15% of the net.' },
            { label: 'B', text: '150,000', isCorrect: true },
            { label: 'C', text: '15,000', isCorrect: false, whyWrong: 'Off by a factor of ten.' },
            { label: 'D', text: '1,000,000', isCorrect: false, whyWrong: 'That is the net.' },
          ],
        },
        steps: {
          create: [
            { stepNo: 2, text: '1,150,000 × 15/115 = 150,000', formula: 'gross × 15/115' },
            { stepNo: 1, text: 'The amount is VAT-inclusive.', formula: null },
            { stepNo: 3, text: '= 150,000 → answer B', formula: null },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  const payload = async () =>
    (
      await request(app.getHttpServer())
        .get('/admin/review/next')
        .query({ reviewerId: 'reviewer-z' })
        .expect(200)
    ).body;

  // The task's own test.
  it('has exactly the answer-view fields, in the fixed render order', async () => {
    const { answerView } = await payload();
    expect(Object.keys(answerView)).toEqual([...ANSWER_VIEW_FIELDS]);
  });

  it('carries the why-wrong on every distractor', async () => {
    const { answerView } = await payload();
    const distractors = answerView.options.filter((o: { isCorrect: boolean }) => !o.isCorrect);
    expect(distractors).toHaveLength(3);
    for (const o of distractors) expect(o.whyWrong).toBeTruthy();
  });

  it('carries the steps in order, whatever order they were stored in', async () => {
    const { answerView } = await payload();
    expect(answerView.steps.map((s: { stepNo: number }) => s.stepNo)).toEqual([1, 2, 3]);
    expect(answerView.steps[2].text).toContain('answer B');
  });

  it('names the correct option once', async () => {
    const { answerView } = await payload();
    expect(answerView.correctLabel).toBe('B');
  });

  // Nobody has attempted it, so there is no verdict to render — but the field is
  // present, because the renderer must not branch on which keys exist.
  it('has a null chosenLabel in review', async () => {
    const { answerView } = await payload();
    expect(answerView).toHaveProperty('chosenLabel', null);
  });

  it('carries the concept line and the code block slot', async () => {
    const { answerView } = await payload();
    expect(answerView.conceptLine).toContain('15/115');
    expect(answerView).toHaveProperty('codeBlock', null);
  });

  it('puts the reviewer-only context outside the answer view', async () => {
    const body = await payload();
    expect(Object.keys(body).sort()).toEqual([
      'answerView',
      'authorId',
      'course',
      'field',
      'importFlags',
      'topic',
      'topicWeighted',
    ]);
    expect(body.authorId).toBe('author-x');
    expect(body.topicWeighted).toBe(true);
    expect(body.field).toBe(`Shape ${SFX2}`);
  });
});
