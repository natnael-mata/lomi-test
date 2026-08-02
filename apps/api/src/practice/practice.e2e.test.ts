/**
 * Integration test — serving a question (T-105, T-106, T-107).
 *
 * T-106 is the one that matters. It asserts against the **serialised JSON**, not
 * a typed object: a type says what the code intends, and the wire says what the
 * student actually received. Those differ the moment someone spreads a database
 * row into a response.
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
import { ANSWER_ONLY_FIELDS, SERVED_QUESTION_FIELDS } from './question-view';

const BOT_TOKEN = '7000000000:AAF-lomi-test-fixture-bot-token-not-real';
const JWT_SECRET = 'test-secret-not-a-real-one';
const SFX = 'e2e-practice';
const TG = 560000001;

function initData(): string {
  const user = JSON.stringify({ id: TG, first_name: 'Test', username: `user${TG}` });
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

describe('GET /questions/next', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token = '';
  let userId = '';
  let fieldId = '';
  let otherFieldQuestionId = '';

  const cleanup = async (): Promise<void> => {
    await prisma.attempt.deleteMany({ where: { user: { telegramId: String(TG) } } });
    await prisma.session.deleteMany({ where: { user: { telegramId: String(TG) } } });
    await prisma.user.deleteMany({ where: { telegramId: String(TG) } });
    await prisma.option.deleteMany({ where: { question: { stableId: { contains: SFX } } } });
    await prisma.step.deleteMany({ where: { question: { stableId: { contains: SFX } } } });
    await prisma.question.deleteMany({ where: { stableId: { contains: SFX } } });
    await prisma.topic.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.course.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.field.deleteMany({ where: { slug: { contains: SFX } } });
  };

  /** A published question, loaded with every piece of answer content there is. */
  const publish = async (stableId: string, topicId: string, fId: string): Promise<string> => {
    const q = await prisma.question.create({
      data: {
        stableId: `${stableId}-${SFX}`,
        topicId,
        fieldId: fId,
        qType: 'CALCULATION',
        stem: 'How much VAT is contained in Br 1,150,000?',
        codeBlock: null,
        conceptLine: 'VAT inside a gross amount is extracted with ×15/115.',
        explanation: 'Because the amount is VAT-inclusive.',
        timeLimitSec: 180,
        status: 'PUBLISHED',
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

  beforeAll(async () => {
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
    process.env.JWT_SECRET = JWT_SECRET;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();

    const field = await prisma.field.create({
      data: { name: `Practice ${SFX}`, slug: `field-${SFX}`, isPublished: true },
    });
    fieldId = field.id;
    const course = await prisma.course.create({
      data: { fieldId, name: 'Taxation', slug: `course-${SFX}` },
    });
    const topic = await prisma.topic.create({
      data: { courseId: course.id, name: 'VAT', slug: `topic-${SFX}`, weightPct: 100 },
    });

    await publish('PRAC-1', topic.id, fieldId);

    // A second, unrelated field — nothing from it may ever be served here.
    const other = await prisma.field.create({
      data: { name: `Other ${SFX}`, slug: `other-field-${SFX}`, isPublished: true },
    });
    const otherCourse = await prisma.course.create({
      data: { fieldId: other.id, name: 'Other', slug: `other-course-${SFX}` },
    });
    const otherTopic = await prisma.topic.create({
      data: { courseId: otherCourse.id, name: 'Other', slug: `other-topic-${SFX}` },
    });
    otherFieldQuestionId = await publish('OTHER-1', otherTopic.id, other.id);

    // A draft in the student's own field — never servable.
    await prisma.question.create({
      data: {
        stableId: `DRAFT-${SFX}`,
        topicId: topic.id,
        fieldId,
        qType: 'CONCEPT',
        stem: 'An unpublished question',
        timeLimitSec: 60,
        status: 'DRAFT',
        options: {
          create: [
            { label: 'A', text: 'a', isCorrect: true },
            { label: 'B', text: 'b', isCorrect: false },
          ],
        },
      },
    });

    const signIn = (
      await request(app.getHttpServer())
        .post('/auth/telegram')
        .send({ initData: initData() })
        .expect(201)
    ).body;
    token = signIn.token;
    userId = signIn.userId;
    await prisma.user.update({ where: { id: userId }, data: { fieldId } });
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.JWT_SECRET;
  });

  const next = async (expectStatus = 200) =>
    (
      await request(app.getHttpServer())
        .get('/questions/next')
        .set('Authorization', `Bearer ${token}`)
        .expect(expectStatus)
    ).body;

  // T-105's own test.
  it('returns a stem and four options', async () => {
    const body = await next();
    expect(body.stem).toContain('VAT');
    expect(body.options).toHaveLength(4);
    expect(body.options.map((o: { label: string }) => o.label)).toEqual(['A', 'B', 'C', 'D']);
    for (const option of body.options) expect(option.text).toBeTruthy();
  });

  it('serves only from the student’s own field', async () => {
    for (let i = 0; i < 12; i++) {
      const body = await next();
      expect(body.stableId).toBe(`PRAC-1-${SFX}`);
    }
    expect(otherFieldQuestionId).toBeTruthy();
  });

  it('never serves a question that is not PUBLISHED', async () => {
    for (let i = 0; i < 12; i++) {
      expect((await next()).stableId).not.toBe(`DRAFT-${SFX}`);
    }
  });

  it('401s without a token', async () => {
    await request(app.getHttpServer()).get('/questions/next').expect(401);
  });

  // The loose end from T-085: the guard is now on the real endpoint.
  it('409s with FIELD_REQUIRED when no programme is chosen', async () => {
    await prisma.user.update({ where: { id: userId }, data: { fieldId: null } });
    const res = await request(app.getHttpServer())
      .get('/questions/next')
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
    expect(res.body.error).toBe('FIELD_REQUIRED');
    await prisma.user.update({ where: { id: userId }, data: { fieldId } });
  });
});

describe('the served payload carries no answer content (T-106)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token = '';

  const SFX2 = 'e2e-leak';
  const TG2 = 560000002;

  const initData2 = (): string => {
    const user = JSON.stringify({ id: TG2, first_name: 'Test', username: `user${TG2}` });
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
  };

  const cleanup = async (): Promise<void> => {
    await prisma.session.deleteMany({ where: { user: { telegramId: String(TG2) } } });
    await prisma.user.deleteMany({ where: { telegramId: String(TG2) } });
    await prisma.option.deleteMany({ where: { question: { stableId: { contains: SFX2 } } } });
    await prisma.step.deleteMany({ where: { question: { stableId: { contains: SFX2 } } } });
    await prisma.question.deleteMany({ where: { stableId: { contains: SFX2 } } });
    await prisma.topic.deleteMany({ where: { slug: { contains: SFX2 } } });
    await prisma.course.deleteMany({ where: { slug: { contains: SFX2 } } });
    await prisma.field.deleteMany({ where: { slug: { contains: SFX2 } } });
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
      data: { name: `Leak ${SFX2}`, slug: `field-${SFX2}`, isPublished: true },
    });
    const course = await prisma.course.create({
      data: { fieldId: field.id, name: 'C', slug: `course-${SFX2}` },
    });
    const topic = await prisma.topic.create({
      data: { courseId: course.id, name: 'T', slug: `topic-${SFX2}` },
    });
    await prisma.question.create({
      data: {
        stableId: `LEAK-${SFX2}`,
        topicId: topic.id,
        fieldId: field.id,
        qType: 'CALCULATION',
        stem: 'A question with every kind of answer content attached',
        conceptLine: 'CONCEPT-LINE-SENTINEL',
        explanation: 'EXPLANATION-SENTINEL',
        timeLimitSec: 180,
        status: 'PUBLISHED',
        options: {
          create: [
            { label: 'A', text: 'a', isCorrect: true },
            { label: 'B', text: 'b', isCorrect: false, whyWrong: 'WHYWRONG-SENTINEL' },
            { label: 'C', text: 'c', isCorrect: false, whyWrong: 'WHYWRONG-SENTINEL' },
            { label: 'D', text: 'd', isCorrect: false, whyWrong: 'WHYWRONG-SENTINEL' },
          ],
        },
        steps: { create: [{ stepNo: 1, text: 'STEP-SENTINEL', formula: null }] },
      },
    });

    const signIn = (
      await request(app.getHttpServer())
        .post('/auth/telegram')
        .send({ initData: initData2() })
        .expect(201)
    ).body;
    token = signIn.token;
    await prisma.user.update({ where: { id: signIn.userId }, data: { fieldId: field.id } });
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.JWT_SECRET;
  });

  const raw = async (): Promise<string> =>
    (
      await request(app.getHttpServer())
        .get('/questions/next')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
    ).text;

  it('contains none of the answer-only keys, anywhere in the JSON', async () => {
    const text = await raw();
    for (const key of ANSWER_ONLY_FIELDS) {
      expect(text, `"${key}" appears in the served payload`).not.toContain(`"${key}"`);
    }
  });

  // Keys could be renamed; the VALUES are what a cheat actually needs.
  it('contains none of the answer content itself', async () => {
    const text = await raw();
    for (const sentinel of [
      'CONCEPT-LINE-SENTINEL',
      'EXPLANATION-SENTINEL',
      'WHYWRONG-SENTINEL',
      'STEP-SENTINEL',
    ]) {
      expect(text, `${sentinel} leaked`).not.toContain(sentinel);
    }
  });

  it('has exactly the declared fields and nothing else', async () => {
    const body = JSON.parse(await raw());
    expect(Object.keys(body).sort()).toEqual([...SERVED_QUESTION_FIELDS].sort());
    for (const option of body.options) {
      expect(Object.keys(option).sort()).toEqual(['label', 'text']);
    }
  });

  it('still tells the student which options exist', async () => {
    const body = JSON.parse(await raw());
    expect(body.options.map((o: { text: string }) => o.text)).toEqual(['a', 'b', 'c', 'd']);
  });
});
