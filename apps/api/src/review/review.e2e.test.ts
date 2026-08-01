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
      'bounceNote',
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

describe('POST /admin/review/:id/publish (T-067)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  /** The real seeded GEO-0001 — the template's deliberately unfinished row. */
  let geoId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    const geo = await prisma.question.findUnique({ where: { stableId: 'GEO-0001' } });
    if (!geo) throw new Error('GEO-0001 is not seeded — run `npm run db:seed -w api`');
    geoId = geo.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const publish = async (id: string, reviewerId: string, expectStatus: number) =>
    (
      await request(app.getHttpServer())
        .post(`/admin/review/${id}/publish`)
        .send({ reviewerId })
        .expect(expectStatus)
    ).body;

  // The task's own test. It said 3 blockers; GEO-0001 actually raises 8, and
  // every one of them is real — see the correction in TASK.md.
  it('refuses GEO-0001 with 422 and every blocker named', async () => {
    const body = await publish(geoId, 'reviewer-z', 422);

    expect(body.error).toBe('GATE_BLOCKED');
    expect(body.blockers).toEqual([
      'No correct option marked — a reviewer must supply and confirm the answer.',
      'Option A: why it is wrong is missing.',
      'Option B: why it is wrong is missing.',
      'Option C: why it is wrong is missing.',
      'Option D: why it is wrong is missing.',
      'Concept line is missing.',
      'Explanation is missing.',
      'Topic "Sampling" has no weight — set it before publishing.',
    ]);
  });

  it('leaves the question untouched after a refusal', async () => {
    const after = await prisma.question.findUniqueOrThrow({ where: { id: geoId } });
    expect(after.status).toBe('DRAFT');
    expect(after.reviewerId).toBeNull();
  });

  it('404s for a question that does not exist', async () => {
    await request(app.getHttpServer())
      .post('/admin/review/does-not-exist/publish')
      .send({ reviewerId: 'reviewer-z' })
      .expect(404);
  });

  // Same action, two routes — so they must give the same answer.
  it('agrees with POST /admin/questions/:id/publish', async () => {
    const viaQuestions = (
      await request(app.getHttpServer())
        .post(`/admin/questions/${geoId}/publish`)
        .send({ reviewerId: 'reviewer-z' })
        .expect(422)
    ).body;
    const viaReview = await publish(geoId, 'reviewer-z', 422);
    expect(viaReview).toEqual(viaQuestions);
  });
});

describe('POST /admin/review/:id/bounce (T-068)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const SFX3 = 'e2e-bounce';
  let questionId = '';

  const cleanup = async (): Promise<void> => {
    await prisma.option.deleteMany({ where: { question: { stableId: { contains: SFX3 } } } });
    await prisma.question.deleteMany({ where: { stableId: { contains: SFX3 } } });
    await prisma.topic.deleteMany({ where: { slug: { contains: SFX3 } } });
    await prisma.course.deleteMany({ where: { slug: { contains: SFX3 } } });
    await prisma.field.deleteMany({ where: { slug: { contains: SFX3 } } });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();

    const field = await prisma.field.create({
      data: { name: `Bounce ${SFX3}`, slug: `field-${SFX3}` },
    });
    const course = await prisma.course.create({
      data: { fieldId: field.id, name: 'Course', slug: `course-${SFX3}` },
    });
    const topic = await prisma.topic.create({
      data: { courseId: course.id, name: 'Topic', slug: `topic-${SFX3}` },
    });
    const q = await prisma.question.create({
      data: {
        stableId: `BOUNCE-${SFX3}`,
        topicId: topic.id,
        fieldId: field.id,
        qType: 'CONCEPT',
        stem: 'A question under review',
        timeLimitSec: 60,
        status: 'IN_REVIEW',
        authorId: 'author-b',
      },
    });
    questionId = q.id;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  const bounce = async (note: unknown, expectStatus: number) =>
    (
      await request(app.getHttpServer())
        .post(`/admin/review/${questionId}/bounce`)
        .send({ note })
        .expect(expectStatus)
    ).body;

  // The task's own test, first half.
  it('refuses an empty note with 400', async () => {
    await bounce('', 400);
    await bounce(undefined, 400);
  });

  it('refuses a note that is too short to act on', async () => {
    const body = await bounce('fix it', 400);
    expect(body.message).toContain('at least 10 characters');
  });

  it('counts the note after trimming, so spaces do not pad it past the bar', async () => {
    await bounce('  fix  ', 400);
  });

  it('leaves the question in review after a refusal', async () => {
    const after = await prisma.question.findUniqueOrThrow({ where: { id: questionId } });
    expect(after.status).toBe('IN_REVIEW');
    expect(after.bounceNote).toBeNull();
  });

  // The task's own test, second half.
  it('accepts a real note, returning the question to DRAFT with the note attached', async () => {
    const note = 'Option C repeats option A — replace it with a distinct distractor.';
    const body = await bounce(note, 201);
    expect(body.status).toBe('DRAFT');

    const after = await prisma.question.findUniqueOrThrow({ where: { id: questionId } });
    expect(after.status).toBe('DRAFT');
    expect(after.bounceNote).toBe(note);
  });

  // A bounced question must leave the queue at once, or the next reviewer picks
  // up something already rejected.
  it('removes the question from every reviewer queue', async () => {
    const body = (
      await request(app.getHttpServer())
        .get('/admin/review/next')
        .query({ reviewerId: 'reviewer-new' })
        .expect(200)
    ).body;
    expect(body?.answerView?.stableId).not.toBe(`BOUNCE-${SFX3}`);
  });

  it('404s for a question that does not exist', async () => {
    await request(app.getHttpServer())
      .post('/admin/review/does-not-exist/bounce')
      .send({ note: 'A perfectly valid note about nothing.' })
      .expect(404);
  });
});

describe('PATCH /admin/review/:id — the review write path (T-068a)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const SFX4 = 'e2e-patch';
  let questionId = '';
  let topicId = '';

  const cleanup = async (): Promise<void> => {
    await prisma.option.deleteMany({ where: { question: { stableId: { contains: SFX4 } } } });
    await prisma.step.deleteMany({ where: { question: { stableId: { contains: SFX4 } } } });
    await prisma.question.deleteMany({ where: { stableId: { contains: SFX4 } } });
    await prisma.topic.deleteMany({ where: { slug: { contains: SFX4 } } });
    await prisma.course.deleteMany({ where: { slug: { contains: SFX4 } } });
    await prisma.field.deleteMany({ where: { slug: { contains: SFX4 } } });
  };

  /**
   * A copy of the real GEO-0001 — same four options, same missing answer and
   * missing rationale — rather than the seeded row itself, so the test can drive
   * it all the way to PUBLISHED without leaving the seed data changed.
   */
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();

    const field = await prisma.field.create({
      data: { name: `Patch ${SFX4}`, slug: `field-${SFX4}` },
    });
    const course = await prisma.course.create({
      data: { fieldId: field.id, name: 'Research Methods', slug: `course-${SFX4}` },
    });
    const topic = await prisma.topic.create({
      // Unweighted, exactly like the real Sampling topic — the 8th blocker.
      data: { courseId: course.id, name: 'Sampling', slug: `topic-${SFX4}` },
    });
    topicId = topic.id;

    const q = await prisma.question.create({
      data: {
        stableId: `GEO-COPY-${SFX4}`,
        topicId: topic.id,
        fieldId: field.id,
        qType: 'CONCEPT',
        stem: 'To ensure every household has an equal chance of selection, you would use:',
        timeLimitSec: 60,
        status: 'IN_REVIEW',
        importFlags: ['NEEDS_ANSWER', 'NEEDS_EXPLANATION', 'NEEDS_TOPIC_REVIEW'],
        options: {
          create: [
            { label: 'A', text: 'Purposive sampling', isCorrect: false },
            { label: 'B', text: 'Snowball sampling', isCorrect: false },
            { label: 'C', text: 'Simple random sampling', isCorrect: false },
            { label: 'D', text: 'Convenience sampling', isCorrect: false },
          ],
        },
      },
    });
    questionId = q.id;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  const patch = async (body: object, expectStatus = 200) =>
    (
      await request(app.getHttpServer())
        .patch(`/admin/review/${questionId}`)
        .send(body)
        .expect(expectStatus)
    ).body;

  const publish = async (expectStatus: number) =>
    (
      await request(app.getHttpServer())
        .post(`/admin/review/${questionId}/publish`)
        .send({ reviewerId: 'reviewer-z' })
        .expect(expectStatus)
    ).body;

  // The task's own test, and the whole of T-031a's decision in one sequence.
  it('turns an unpublishable import into a published question', async () => {
    // Before: the same wall of blockers T-067 asserts for the real GEO-0001.
    const before = await publish(422);
    expect(before.blockers).toHaveLength(8);

    await patch({
      correctOption: 'c',
      conceptLine: 'Equal probability for every unit is simple random sampling.',
      explanation: 'Only simple random sampling gives every household the same chance.',
      whyWrong: {
        A: 'Purposive sampling picks units deliberately, not by chance.',
        B: 'Snowball sampling recruits through referral, so chances are unequal.',
        D: 'Convenience sampling takes whoever is reachable.',
      },
    });

    // The one blocker a reviewer cannot close from this endpoint: topic weight
    // is a taxonomy decision, not an edit to this question.
    const stillBlocked = await publish(422);
    expect(stillBlocked.blockers).toEqual([
      'Topic "Sampling" has no weight — set it before publishing.',
    ]);

    await prisma.topic.update({ where: { id: topicId }, data: { weightPct: 100 } });

    const published = await publish(201);
    expect(published.status).toBe('PUBLISHED');
  });

  it('reports what it changed', async () => {
    const body = await patch({ conceptLine: 'A revised concept line.' });
    expect(body.changed).toContain('concept line');
  });

  it('sends a published question back to review when it is edited', async () => {
    // The previous test left it PUBLISHED; this one edited it, so it must have
    // stopped being served — the same rule the importer follows (T-054).
    const after = await prisma.question.findUniqueOrThrow({ where: { id: questionId } });
    expect(after.status).toBe('IN_REVIEW');
  });

  it('clears exactly one correct option when a new one is set', async () => {
    await patch({ correctOption: 'a' });
    const options = await prisma.option.findMany({
      where: { questionId },
      orderBy: { label: 'asc' },
    });
    expect(options.filter((o) => o.isCorrect).map((o) => o.label)).toEqual(['A']);
  });

  it('leaves untouched fields alone', async () => {
    const before = await prisma.question.findUniqueOrThrow({ where: { id: questionId } });
    await patch({ timeLimitSec: 90 });
    const after = await prisma.question.findUniqueOrThrow({ where: { id: questionId } });
    expect(after.conceptLine).toBe(before.conceptLine);
    expect(after.explanation).toBe(before.explanation);
    expect(after.timeLimitSec).toBe(90);
  });

  it('422s on an invalid patch, naming every reason', async () => {
    const body = await patch({ correctOption: 'z', timeLimitSec: 9 }, 422);
    expect(body.error).toBe('INVALID_PATCH');
    expect(body.reasons).toHaveLength(2);
  });

  it('422s when the patch names an option this question does not have', async () => {
    const solo = await prisma.question.create({
      data: {
        stableId: `SOLO-${SFX4}`,
        topicId,
        fieldId: (await prisma.field.findFirstOrThrow({ where: { slug: `field-${SFX4}` } })).id,
        qType: 'CONCEPT',
        stem: 'Two options only',
        timeLimitSec: 60,
        options: {
          create: [
            { label: 'A', text: 'a', isCorrect: true },
            { label: 'B', text: 'b', isCorrect: false },
          ],
        },
      },
    });
    const body = (
      await request(app.getHttpServer())
        .patch(`/admin/review/${solo.id}`)
        .send({ whyWrong: { D: 'no such option' } })
        .expect(422)
    ).body;
    expect(body.reasons.join(' ')).toContain('no option D');
  });

  it('404s for a question that does not exist', async () => {
    await request(app.getHttpServer())
      .patch('/admin/review/does-not-exist')
      .send({ conceptLine: 'anything' })
      .expect(404);
  });

  it('writes and replaces the worked steps', async () => {
    await patch({
      steps: [
        { stepNo: 2, text: 'second' },
        { stepNo: 1, text: 'first' },
      ],
    });
    const first = await prisma.step.findMany({ where: { questionId }, orderBy: { stepNo: 'asc' } });
    expect(first.map((s) => s.text)).toEqual(['first', 'second']);

    await patch({ steps: [{ stepNo: 1, text: 'only' }] });
    const second = await prisma.step.findMany({ where: { questionId } });
    expect(second.map((s) => s.text)).toEqual(['only']);
  });
});

describe('POST /admin/review/:id/submit (T-068a)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const SFX5 = 'e2e-submit';
  let questionId = '';

  const cleanup = async (): Promise<void> => {
    await prisma.question.deleteMany({ where: { stableId: { contains: SFX5 } } });
    await prisma.topic.deleteMany({ where: { slug: { contains: SFX5 } } });
    await prisma.course.deleteMany({ where: { slug: { contains: SFX5 } } });
    await prisma.field.deleteMany({ where: { slug: { contains: SFX5 } } });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();

    const field = await prisma.field.create({
      data: { name: `Submit ${SFX5}`, slug: `field-${SFX5}` },
    });
    const course = await prisma.course.create({
      data: { fieldId: field.id, name: 'Course', slug: `course-${SFX5}` },
    });
    const topic = await prisma.topic.create({
      data: { courseId: course.id, name: 'Topic', slug: `topic-${SFX5}` },
    });
    const q = await prisma.question.create({
      data: {
        stableId: `SUB-${SFX5}`,
        topicId: topic.id,
        fieldId: field.id,
        qType: 'CONCEPT',
        stem: 'A bounced question',
        timeLimitSec: 60,
        status: 'DRAFT',
        bounceNote: 'Option C repeats option A — replace it.',
      },
    });
    questionId = q.id;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  // The reason submit exists at all: a stale note shows the next reviewer a
  // complaint about a fix that has already been made.
  it('puts the question back in review and clears the bounce note', async () => {
    const body = (
      await request(app.getHttpServer())
        .post(`/admin/review/${questionId}/submit`)
        .send({})
        .expect(201)
    ).body;
    expect(body.status).toBe('IN_REVIEW');

    const after = await prisma.question.findUniqueOrThrow({ where: { id: questionId } });
    expect(after.bounceNote).toBeNull();
  });

  it('refuses to submit a published question', async () => {
    await prisma.question.update({ where: { id: questionId }, data: { status: 'PUBLISHED' } });
    await request(app.getHttpServer())
      .post(`/admin/review/${questionId}/submit`)
      .send({})
      .expect(400);
  });

  it('refuses to submit a retired question', async () => {
    await prisma.question.update({ where: { id: questionId }, data: { status: 'RETIRED' } });
    await request(app.getHttpServer())
      .post(`/admin/review/${questionId}/submit`)
      .send({})
      .expect(400);
  });
});
