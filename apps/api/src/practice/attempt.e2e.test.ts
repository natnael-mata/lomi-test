/**
 * Integration test — answering (T-108, T-109, T-110, T-111).
 *
 * Needs Postgres (`npm run db:dev`). CI provides it as a service container.
 */
import { createHmac } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { ANSWER_VIEW_FIELDS } from '../questions/answer-view';
import { FREE_ATTEMPTS_PER_FIELD } from './attempt-rules';

const BOT_TOKEN = '7000000000:AAF-lomi-test-fixture-bot-token-not-real';
const JWT_SECRET = 'test-secret-not-a-real-one';
const SFX = 'e2e-attempt';

function initDataFor(id: number): string {
  const user = JSON.stringify({ id, first_name: 'Test', username: `user${id}` });
  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user,
  };
  const pairs = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .sort();
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

describe('POST /attempts', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fieldId = '';
  let topicId = '';
  let otherFieldQuestionId = '';
  let draftQuestionId = '';
  /** Enough questions that the free limit is reachable and T-110 has room. */
  const questionIds: string[] = [];

  const TG = 561000001;
  let token = '';
  let userId = '';

  const cleanup = async (): Promise<void> => {
    await prisma.attempt.deleteMany({ where: { field: { slug: { contains: SFX } } } });
    await prisma.session.deleteMany({
      where: { user: { telegramId: { startsWith: '5610000' } } },
    });
    await prisma.user.deleteMany({ where: { telegramId: { startsWith: '5610000' } } });
    await prisma.option.deleteMany({ where: { question: { stableId: { contains: SFX } } } });
    await prisma.step.deleteMany({ where: { question: { stableId: { contains: SFX } } } });
    await prisma.question.deleteMany({ where: { stableId: { contains: SFX } } });
    await prisma.topic.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.course.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.field.deleteMany({ where: { slug: { contains: SFX } } });
  };

  const makeQuestion = async (
    stableId: string,
    tId: string,
    fId: string,
    status: 'PUBLISHED' | 'DRAFT' = 'PUBLISHED',
  ): Promise<string> => {
    const q = await prisma.question.create({
      data: {
        stableId: `${stableId}-${SFX}`,
        topicId: tId,
        fieldId: fId,
        qType: 'CALCULATION',
        stem: `Stem for ${stableId}`,
        conceptLine: 'VAT inside a gross amount is extracted with ×15/115.',
        explanation: 'The amount is VAT-inclusive.',
        timeLimitSec: 180,
        status,
        options: {
          create: [
            { label: 'A', text: '172,500', isCorrect: false, whyWrong: 'That is 15% of the net.' },
            { label: 'B', text: '150,000', isCorrect: true },
            { label: 'C', text: '15,000', isCorrect: false, whyWrong: 'Off by ten.' },
            { label: 'D', text: '1,000,000', isCorrect: false, whyWrong: 'That is the net.' },
          ],
        },
        steps: { create: [{ stepNo: 1, text: '= 150,000 → answer B', formula: null }] },
      },
    });
    return q.id;
  };

  const signIn = async (tg: number): Promise<{ token: string; userId: string }> => {
    const body = (
      await request(app.getHttpServer())
        .post('/auth/telegram')
        .send({ initData: initDataFor(tg) })
        .expect(201)
    ).body;
    await prisma.user.update({ where: { id: body.userId }, data: { fieldId } });
    return { token: body.token, userId: body.userId };
  };

  beforeAll(async () => {
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
    process.env.JWT_SECRET = JWT_SECRET;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();

    const field = await prisma.field.create({
      data: { name: `Attempt ${SFX}`, slug: `field-${SFX}`, isPublished: true },
    });
    fieldId = field.id;
    const course = await prisma.course.create({
      data: { fieldId, name: 'Taxation', slug: `course-${SFX}` },
    });
    const topic = await prisma.topic.create({
      data: { courseId: course.id, name: 'VAT', slug: `topic-${SFX}`, weightPct: 100 },
    });
    topicId = topic.id;

    for (let i = 0; i < FREE_ATTEMPTS_PER_FIELD + 4; i++) {
      questionIds.push(await makeQuestion(`Q${i}`, topicId, fieldId));
    }
    draftQuestionId = await makeQuestion('DRAFT', topicId, fieldId, 'DRAFT');

    const other = await prisma.field.create({
      data: { name: `Other ${SFX}`, slug: `other-${SFX}`, isPublished: true },
    });
    const otherCourse = await prisma.course.create({
      data: { fieldId: other.id, name: 'O', slug: `other-course-${SFX}` },
    });
    const otherTopic = await prisma.topic.create({
      data: { courseId: otherCourse.id, name: 'O', slug: `other-topic-${SFX}` },
    });
    otherFieldQuestionId = await makeQuestion('OTHER', otherTopic.id, other.id);

    const me = await signIn(TG);
    token = me.token;
    userId = me.userId;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.JWT_SECRET;
  });

  const answer = async (
    questionId: string,
    chosenLabel: string,
    expectStatus = 201,
    timeTakenSec: unknown = 30,
    bearer = token,
  ) =>
    (
      await request(app.getHttpServer())
        .post('/attempts')
        .set('Authorization', `Bearer ${bearer}`)
        .send({ questionId, chosenLabel, timeTakenSec })
        .expect(expectStatus)
    ).body;

  // T-108's own test.
  it('returns the full answer payload', async () => {
    const body = await answer(questionIds[0]!, 'B');

    expect(body.isCorrect).toBe(true);
    expect(Object.keys(body.answerView)).toEqual([...ANSWER_VIEW_FIELDS]);
    expect(body.answerView.conceptLine).toContain('15/115');
    expect(body.answerView.steps[0].text).toContain('answer B');
    expect(body.answerView.correctLabel).toBe('B');
    expect(body.answerView.chosenLabel).toBe('B');

    const distractors = body.answerView.options.filter((o: { isCorrect: boolean }) => !o.isCorrect);
    expect(distractors).toHaveLength(3);
    for (const o of distractors) expect(o.whyWrong).toBeTruthy();
  });

  it('records the attempt', async () => {
    const rows = await prisma.attempt.findMany({ where: { userId, questionId: questionIds[0]! } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ chosenLabel: 'B', isCorrect: true, timeTakenSec: 30 });
  });

  it('marks a wrong answer wrong, and still explains it', async () => {
    const body = await answer(questionIds[1]!, 'C');
    expect(body.isCorrect).toBe(false);
    expect(body.answerView.chosenLabel).toBe('C');
    expect(body.answerView.correctLabel).toBe('B');
  });

  // T-109.
  it('reports both durations and calls over-limit pacing, not failure', async () => {
    const within = await answer(questionIds[2]!, 'B', 201, 30);
    expect(within).toMatchObject({ timeTakenSec: 30, timeLimitSec: 180, pacing: 'within' });

    const over = await answer(questionIds[3]!, 'B', 201, 400);
    expect(over).toMatchObject({ timeTakenSec: 400, timeLimitSec: 180, pacing: 'over' });
    // Over time and still correct: the two axes are independent.
    expect(over.isCorrect).toBe(true);
    expect(JSON.stringify(over)).not.toMatch(/fail/i);
  });

  it('clamps an absurd duration rather than losing the attempt', async () => {
    const body = await answer(questionIds[4]!, 'B', 201, 999999);
    expect(body.timeTakenSec).toBe(7200);
    expect(body.timeNote).toMatch(/clamped/);
    expect(body.isCorrect).toBe(true);
  });

  it('says pacing is unknown when no usable duration arrived', async () => {
    const body = await answer(questionIds[5]!, 'B', 201, 'thirty');
    expect(body.pacing).toBe('unknown');
  });

  describe('rejections', () => {
    it('422s an answer outside A–D, writing nothing', async () => {
      const before = await prisma.attempt.count({ where: { userId } });
      const body = await answer(questionIds[6]!, 'E', 422);
      expect(body.error).toBe('INVALID_ATTEMPT');
      expect(await prisma.attempt.count({ where: { userId } })).toBe(before);
    });

    // "That question exists but is not yours" is itself information.
    it('404s a question in another programme, the same as one that does not exist', async () => {
      await answer(otherFieldQuestionId, 'B', 404);
      await answer('does-not-exist', 'B', 404);
    });

    it('404s an unpublished question', async () => {
      await answer(draftQuestionId, 'B', 404);
    });

    it('401s without a token', async () => {
      await request(app.getHttpServer())
        .post('/attempts')
        .send({ questionId: questionIds[0], chosenLabel: 'B', timeTakenSec: 1 })
        .expect(401);
    });
  });

  // T-110's own test.
  describe('a question answered correctly is not served again today', () => {
    it('does not reappear across 50 requests', async () => {
      const fresh = await signIn(561000002);
      const first = (
        await request(app.getHttpServer())
          .get('/questions/next')
          .set('Authorization', `Bearer ${fresh.token}`)
          .expect(200)
      ).body;

      await answer(first.questionId, 'B', 201, 30, fresh.token);

      for (let i = 0; i < 50; i++) {
        const next = (
          await request(app.getHttpServer())
            .get('/questions/next')
            .set('Authorization', `Bearer ${fresh.token}`)
            .expect(200)
        ).body;
        expect(next.questionId).not.toBe(first.questionId);
      }
    });

    // Getting it wrong is exactly when you need to see it again.
    it('does serve a question answered INcorrectly again', async () => {
      const fresh = await signIn(561000003);
      const target = questionIds[7]!;
      await answer(target, 'C', 201, 30, fresh.token);

      let reappeared = false;
      for (let i = 0; i < 60 && !reappeared; i++) {
        const next = (
          await request(app.getHttpServer())
            .get('/questions/next')
            .set('Authorization', `Bearer ${fresh.token}`)
            .expect(200)
        ).body;
        if (next.questionId === target) reappeared = true;
      }
      expect(reappeared).toBe(true);
    });
  });

  // T-111's own test.
  describe('the free tier', () => {
    it('allows exactly ten questions, then 402s with FREE_LIMIT_REACHED', async () => {
      const fresh = await signIn(561000004);

      for (let i = 0; i < FREE_ATTEMPTS_PER_FIELD; i++) {
        const body = await answer(questionIds[i]!, 'B', 201, 30, fresh.token);
        expect(body.freeRemaining).toBe(FREE_ATTEMPTS_PER_FIELD - (i + 1));
      }

      const blocked = await answer(
        questionIds[FREE_ATTEMPTS_PER_FIELD]!,
        'B',
        402,
        30,
        fresh.token,
      );
      expect(blocked.error).toBe('FREE_LIMIT_REACHED');
      expect(blocked.freeRemaining).toBe(0);
    });

    // A 402 that still returned the explanation would be a paywall you can walk
    // through.
    it('releases no answer content with the 402', async () => {
      const fresh = await signIn(561000005);
      for (let i = 0; i < FREE_ATTEMPTS_PER_FIELD; i++) {
        await answer(questionIds[i]!, 'B', 201, 30, fresh.token);
      }
      const res = await request(app.getHttpServer())
        .post('/attempts')
        .set('Authorization', `Bearer ${fresh.token}`)
        .send({ questionId: questionIds[11], chosenLabel: 'B', timeTakenSec: 5 })
        .expect(402);
      for (const key of ['answerView', 'whyWrong', 'conceptLine', 'explanation', 'steps']) {
        expect(res.text).not.toContain(`"${key}"`);
      }
      expect(res.text).not.toContain('answer B');
    });

    it('writes no attempt for a refused submission', async () => {
      const fresh = await prisma.user.findFirstOrThrow({ where: { telegramId: '561000005' } });
      const rows = await prisma.attempt.count({ where: { userId: fresh.id } });
      expect(rows).toBe(FREE_ATTEMPTS_PER_FIELD);
    });

    // Re-reading an explanation you already paid for is not a new question.
    it('does not charge again for a question already attempted', async () => {
      const fresh = await prisma.user.findFirstOrThrow({ where: { telegramId: '561000005' } });
      const body = (
        await request(app.getHttpServer())
          .post('/attempts')
          .set('Authorization', `Bearer ${token}`)
          .send({ questionId: questionIds[0], chosenLabel: 'B', timeTakenSec: 5 })
          .expect(201)
      ).body;
      expect(body.answerView).toBeTruthy();
      expect(fresh.id).toBeTruthy();
    });
  });
});
