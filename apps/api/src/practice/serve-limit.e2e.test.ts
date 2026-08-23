/**
 * Integration test — the bank cannot be walked (T-259, T-260).
 *
 * **No bulk endpoint was ever built, deliberately.** And then the retail door
 * was left open: `GET /questions/next` served the same content one row at a
 * time, unlimited, to anybody holding a subscription — stems, concept lines,
 * worked solutions and every why-wrong. Since the national exam is drawn from a
 * question bank, a complete verified copy of it is the most valuable study
 * artifact in the country and the thing most worth stealing. Writing was
 * guarded and reading was not.
 *
 * The second half is the device cap, which was relaxed for the school tracks in
 * the same breath — a session count cannot tell a shared household from a
 * scraper, and a rate can. Two friends sharing an account answer forty questions
 * a day; a script answers four thousand.
 *
 * Needs Postgres (`npm run db:dev`).
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { RATE_LIMITS } from '../common/rate-limit';
import { MAX_CONCURRENT_SESSIONS, MAX_CONCURRENT_SESSIONS_JUNIOR } from '../auth/auth.service';
import {
  signInByPhone,
  TEST_BOT_TOKEN,
  TEST_JWT_SECRET,
  cleanupStaff,
} from '../auth/staff-testkit.test-helper';

const SFX = 'e2e-serve-limit';
const TG_SENIOR = 568000010;
const TG_JUNIOR = 568000011;

describe('the question bank cannot be walked (T-259)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token = '';
  let juniorId = '';

  const wipe = async (): Promise<void> => {
    const users = await prisma.user.findMany({
      where: { telegramId: { in: [String(TG_SENIOR), String(TG_JUNIOR)] } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await prisma.attempt.deleteMany({ where: { userId: { in: ids } } });
    await prisma.pointEntry.deleteMany({ where: { userId: { in: ids } } });
    await cleanupStaff(prisma, [TG_SENIOR, TG_JUNIOR], SFX);
    await prisma.option.deleteMany({ where: { question: { stableId: { contains: SFX } } } });
    await prisma.question.deleteMany({ where: { stableId: { contains: SFX } } });
    await prisma.topic.deleteMany({ where: { course: { field: { name: { contains: SFX } } } } });
    await prisma.course.deleteMany({ where: { field: { name: { contains: SFX } } } });
    await prisma.field.deleteMany({ where: { name: { contains: SFX } } });
  };

  const track = async (name: string, maxGrade: number | null): Promise<string> => {
    const field = await prisma.field.create({
      data: {
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        isPublished: true,
        minGrade: maxGrade === null ? null : maxGrade - 2,
        maxGrade,
      },
      select: { id: true },
    });
    const course = await prisma.course.create({
      data: { fieldId: field.id, name: 'Subject', slug: `c-${field.id}` },
      select: { id: true },
    });
    const topic = await prisma.topic.create({
      data: { courseId: course.id, name: 'Topic', slug: `t-${field.id}` },
      select: { id: true },
    });
    // Enough that running out of questions cannot be mistaken for the limit.
    for (let n = 0; n < 40; n++) {
      await prisma.question.create({
        data: {
          stableId: `${SFX}-${field.id}-${n}`,
          topicId: topic.id,
          fieldId: field.id,
          qType: 'CONCEPT',
          stem: `Q${n}`,
          conceptLine: 'C',
          explanation: 'E',
          timeLimitSec: 60,
          status: 'PUBLISHED',
          authorId: 'serve-limit-e2e',
          options: {
            create: [
              { label: 'A', text: 'right', isCorrect: true },
              { label: 'B', text: 'wrong', isCorrect: false, whyWrong: 'No.' },
            ],
          },
        },
      });
    }
    return field.id;
  };

  beforeAll(async () => {
    process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
    process.env.JWT_SECRET = TEST_JWT_SECRET;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await wipe();

    const seniorField = await track(`Grade 12 Natural ${SFX}`, 12);
    const juniorField = await track(`Grade 6 ${SFX}`, 6);

    const senior = { body: await signInByPhone(app, prisma, TG_SENIOR) };
    token = senior.body.token;
    await prisma.user.update({ where: { id: senior.body.userId }, data: { fieldId: seniorField } });

    const junior = { body: await signInByPhone(app, prisma, TG_JUNIOR) };
    juniorId = junior.body.userId;
    await prisma.user.update({ where: { id: juniorId }, data: { fieldId: juniorField } });
  });

  afterAll(async () => {
    await wipe();
    await app.close();
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  const serve = () =>
    request(app.getHttpServer()).get('/questions/next').set('Authorization', `Bearer ${token}`);

  it('is limited far above a person and far below a crawler', () => {
    // A question's smallest budget is fifteen seconds, so thirty a minute is
    // already faster than the shortest one can be read; the daily target this
    // product sets is twelve to twenty-four.
    expect(RATE_LIMITS.serveQuestion.limit).toBe(30);
    expect(RATE_LIMITS.serveQuestion.windowSec).toBe(60);
    expect(RATE_LIMITS.serveQuestionDaily.limit).toBe(600);
    expect(RATE_LIMITS.serveQuestionDaily.windowSec).toBe(86_400);
  });

  it('serves a student at a human pace without complaint', async () => {
    for (let i = 0; i < 5; i++) await serve().expect(200);
  });

  /*
   * THE test. A script asking as fast as it can is stopped, and stopped by the
   * read path — which is the one that had no guard at all.
   */
  it('refuses a burst that no reader could produce', async () => {
    let refused = 0;
    for (let i = 0; i < RATE_LIMITS.serveQuestion.limit + 5; i++) {
      const res = await serve();
      if (res.status === 429) refused++;
    }
    expect(refused).toBeGreaterThan(0);
  });

  it('says how long to wait rather than just refusing', async () => {
    const res = await serve();
    expect(res.status).toBe(429);
    // A refusal with no way forward is one a client retries in a tight loop,
    // which is the traffic the limit was trying to stop.
    expect(res.headers['retry-after']).toBeDefined();
  });
});

describe('the device cap fits the household (T-260)', () => {
  it('gives a school track more room than an exit-exam one', () => {
    // Two evicts a family sharing one phone all day; four is a household and
    // still not a classroom. The velocity cap does the anti-sharing work.
    expect(MAX_CONCURRENT_SESSIONS).toBe(2);
    expect(MAX_CONCURRENT_SESSIONS_JUNIOR).toBe(4);
    expect(MAX_CONCURRENT_SESSIONS_JUNIOR).toBeGreaterThan(MAX_CONCURRENT_SESSIONS);
  });
});
