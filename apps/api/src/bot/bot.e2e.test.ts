/**
 * Integration test — referrals, the daily question and opting out
 * (T-180, T-181, T-182).
 *
 * The day boundary and the eligibility rules are proved in `daily.test.ts`
 * without a database. What is checked here is what only a database can show:
 * that a referral is written once and never overwritten, and that two runs of
 * the job on the same day cannot both claim the same student.
 *
 * Needs Postgres (`npm run db:dev`). CI provides it as a service container.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { addisDate } from './daily';

const SFX = 'e2e-bot';
const BOT_SECRET = 'test-bot-secret-e2e-bot';

describe('the bot’s routes (T-180, T-181, T-182)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId = '';
  let fieldId = '';
  const previous: Record<string, string | undefined> = {};
  const bot = { 'x-bot-secret': BOT_SECRET };

  const TG = '5677000001';
  const arrival = (payload: string, chatId = '900') =>
    request(app.getHttpServer())
      .post('/bot/arrival')
      .set(bot)
      .send({ telegramId: TG, telegramUsername: 'student', chatId, payload });

  const wipe = async (): Promise<void> => {
    const users = await prisma.user.findMany({
      where: { telegramId: { startsWith: '5677' } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await prisma.botProfile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.attempt.deleteMany({ where: { userId: { in: ids } } });
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.option.deleteMany({ where: { question: { stableId: { contains: SFX } } } });
    await prisma.question.deleteMany({ where: { stableId: { contains: SFX } } });
    await prisma.topic.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.course.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.field.deleteMany({ where: { slug: { contains: SFX } } });
  };

  beforeAll(async () => {
    previous.BOT_SHARED_SECRET = process.env.BOT_SHARED_SECRET;
    process.env.BOT_SHARED_SECRET = BOT_SECRET;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await wipe();

    const field = await prisma.field.create({
      data: { name: `Bot ${SFX}`, slug: `field-${SFX}`, isPublished: true },
    });
    fieldId = field.id;
    const course = await prisma.course.create({
      data: { fieldId, name: 'Course', slug: `course-${SFX}` },
    });
    const topic = await prisma.topic.create({
      data: { courseId: course.id, name: 'Topic', slug: `topic-${SFX}`, weightPct: 100 },
    });
    await prisma.question.create({
      data: {
        stableId: `BOT-1-${SFX}`,
        topicId: topic.id,
        fieldId,
        qType: 'CONCEPT',
        stem: 'A published question',
        conceptLine: 'CONCEPT-SENTINEL',
        explanation: 'EXPLANATION-SENTINEL',
        timeLimitSec: 60,
        status: 'PUBLISHED',
        options: {
          create: [
            { label: 'A', text: 'a', isCorrect: true },
            { label: 'B', text: 'b', isCorrect: false, whyWrong: 'WHYWRONG-SENTINEL' },
            { label: 'C', text: 'c', isCorrect: false, whyWrong: 'WHYWRONG-SENTINEL' },
            { label: 'D', text: 'd', isCorrect: false, whyWrong: 'WHYWRONG-SENTINEL' },
          ],
        },
      },
    });
  });

  beforeEach(async () => {
    await prisma.botProfile.deleteMany({});
    await prisma.user.deleteMany({ where: { telegramId: { startsWith: '5677' } } });
    const user = await prisma.user.create({
      data: { telegramId: TG, displayName: 'BotStudent0001', fieldId },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await wipe();
    await app.close();
    if (previous.BOT_SHARED_SECRET === undefined) delete process.env.BOT_SHARED_SECRET;
    else process.env.BOT_SHARED_SECRET = previous.BOT_SHARED_SECRET;
  });

  it('is unreachable without the bot secret', async () => {
    await request(app.getHttpServer()).post('/bot/daily/claim').expect(401);
    await request(app.getHttpServer()).post('/bot/arrival').send({ telegramId: TG }).expect(401);
  });

  describe('referrals (T-180)', () => {
    /** T-180's stated test. */
    it('attributes a referral code from the deep link', async () => {
      const body = (await arrival('amb_123').expect(201)).body;
      expect(body.referredVia).toBe('amb_123');

      const profile = await prisma.botProfile.findUniqueOrThrow({ where: { userId } });
      expect(profile.referredVia).toBe('amb_123');
      expect(profile.chatId).toBe('900');
    });

    /**
     * The one that matters. Whoever introduced a student did so once — letting a
     * later link overwrite it would let anybody claim someone else's referral
     * simply by sending them a fresh one.
     */
    it('never overwrites a referral with a later one', async () => {
      await arrival('amb_first').expect(201);
      const second = (await arrival('amb_thief').expect(201)).body;
      expect(second.referredVia).toBe('amb_first');
      expect(second.wasFirst).toBe(false);

      const profile = await prisma.botProfile.findUniqueOrThrow({ where: { userId } });
      expect(profile.referredVia).toBe('amb_first');
    });

    // A login link is not a referral, and recording it as one would be a
    // payment to nobody — invisible until somebody queries the numbers.
    it('records nothing for a payload that is not a referral', async () => {
      const body = (await arrival('login_9f3a').expect(201)).body;
      expect(body.referredVia).toBeNull();
    });

    it('takes a referral on a later visit if the first had none', async () => {
      await arrival('').expect(201);
      const body = (await arrival('amb_late').expect(201)).body;
      expect(body.referredVia).toBe('amb_late');
    });

    /**
     * The chat id IS refreshed, unlike the referral. A student can reinstall and
     * get a new one, and a stale chat is a student silently receiving nothing.
     */
    it('refreshes the chat id on every visit', async () => {
      await arrival('amb_123', '900').expect(201);
      await arrival('amb_123', '901').expect(201);
      const profile = await prisma.botProfile.findUniqueOrThrow({ where: { userId } });
      expect(profile.chatId).toBe('901');
    });
  });

  describe('the daily question (T-181)', () => {
    /** T-181's stated test: running the job twice in a day sends once. */
    it('claims a student once per day, however often the job runs', async () => {
      await arrival('').expect(201);

      const first = (
        await request(app.getHttpServer()).post('/bot/daily/claim').set(bot).expect(201)
      ).body;
      expect(first.recipients).toHaveLength(1);
      expect(first.recipients[0].userId).toBe(userId);
      expect(first.today).toBe(addisDate());

      const second = (
        await request(app.getHttpServer()).post('/bot/daily/claim').set(bot).expect(201)
      ).body;
      expect(second.recipients).toHaveLength(0);
      expect(second.skipped[0].reason).toBe('already-sent');
    });

    /**
     * Marked before sending — at-most-once. A crash mid-run costs those students
     * one day; marking after would replay the batch and send the same question
     * twice, which is the failure that makes people mute a bot.
     */
    it('records the send before the bot has done anything with it', async () => {
      await arrival('').expect(201);
      await request(app.getHttpServer()).post('/bot/daily/claim').set(bot).expect(201);
      const profile = await prisma.botProfile.findUniqueOrThrow({ where: { userId } });
      expect(profile.lastDailySentOn).toBe(addisDate());
    });

    it('carries a question with no answer content in it', async () => {
      await arrival('').expect(201);
      const res = await request(app.getHttpServer()).post('/bot/daily/claim').set(bot).expect(201);
      expect(res.body.recipients[0].question.stem).toBe('A published question');
      for (const sentinel of ['CONCEPT-SENTINEL', 'EXPLANATION-SENTINEL', 'WHYWRONG-SENTINEL']) {
        expect(res.text, `${sentinel} reached the bot`).not.toContain(sentinel);
      }
      expect(res.text).not.toContain('isCorrect');
    });

    // Nowhere to send it. Not an error — the student signed in on the web and
    // has never opened the bot.
    it('skips a student with no chat', async () => {
      await prisma.botProfile.create({ data: { userId, chatId: null } });
      const res = await request(app.getHttpServer()).post('/bot/daily/claim').set(bot).expect(201);
      expect(res.body.recipients).toHaveLength(0);
      expect(res.body.skipped[0].reason).toBe('no-chat');
    });
  });

  describe('opting out (T-182)', () => {
    /** T-182's stated test: an opted-out student receives nothing on the next run. */
    it('suppresses every nudge from the next run onward', async () => {
      await arrival('').expect(201);
      await request(app.getHttpServer())
        .post('/bot/opt-out')
        .set(bot)
        .send({ userId, optOut: true })
        .expect(201);

      const res = await request(app.getHttpServer()).post('/bot/daily/claim').set(bot).expect(201);
      expect(res.body.recipients).toHaveLength(0);
      expect(res.body.skipped[0].reason).toBe('opted-out');
    });

    // And it does not consume their day: opting back in the same afternoon
    // should not mean waiting until tomorrow.
    it('leaves the day unclaimed, so opting back in works immediately', async () => {
      await arrival('').expect(201);
      await request(app.getHttpServer())
        .post('/bot/opt-out')
        .set(bot)
        .send({ userId, optOut: true })
        .expect(201);
      await request(app.getHttpServer()).post('/bot/daily/claim').set(bot).expect(201);

      await request(app.getHttpServer())
        .post('/bot/opt-out')
        .set(bot)
        .send({ userId, optOut: false })
        .expect(201);

      const res = await request(app.getHttpServer()).post('/bot/daily/claim').set(bot).expect(201);
      expect(res.body.recipients).toHaveLength(1);
    });

    it('works for a student the bot has never seen', async () => {
      const res = await request(app.getHttpServer())
        .post('/bot/opt-out')
        .set(bot)
        .send({ userId, optOut: true })
        .expect(201);
      expect(res.body.botOptOut).toBe(true);
    });
  });
});
