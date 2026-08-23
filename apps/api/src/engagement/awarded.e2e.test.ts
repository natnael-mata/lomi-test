/**
 * Integration test — answering a question actually awards points (T-234).
 *
 * **This is the test that was missing, and its absence is the whole story.**
 * Phase 11 built points, streaks, badges and a leaderboard, tested every rule in
 * isolation, and shipped 11 of 11 tasks complete. Nothing in the product ever
 * called `EngagementService`. `me/standing` was a read model over a ledger that
 * no path wrote to, so a student who answered fifty questions saw "Points 0 ·
 * Nothing yet. Points appear here the moment you answer a question."
 *
 * Every unit test passed throughout. They were testing the award function, and
 * the award function was never the problem — nobody called it. So this test
 * deliberately goes the long way round: it posts a real attempt through the real
 * route and then asks the ledger what happened, because the only assertion that
 * could have caught this is one that crosses the gap between the two.
 *
 * Needs Postgres (`npm run db:dev`). CI provides it as a service container.
 */

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { signInByPhone } from '../auth/staff-testkit.test-helper';
import { PrismaService } from '../prisma/prisma.service';
import { RULES } from './points';

const BOT_TOKEN = '7000000000:AAF-lomi-test-fixture-bot-token-not-real';
const JWT_SECRET = 'test-secret-not-a-real-one';
const SFX = 'e2e-awarded';
const TG = 565100001;

describe('answering a question awards points (T-234)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token = '';
  let userId = '';
  const questionIds: string[] = [];

  const cleanup = async (): Promise<void> => {
    const ours = await prisma.user.findMany({
      where: { telegramId: { startsWith: '5651000' } },
      select: { id: true },
    });
    const ids = ours.map((u) => u.id);
    await prisma.pointEntry.deleteMany({ where: { userId: { in: ids } } });
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
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
    process.env.JWT_SECRET = JWT_SECRET;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();

    const field = await prisma.field.create({
      data: { name: `Awarded ${SFX}`, slug: `field-${SFX}`, isPublished: true },
    });
    const course = await prisma.course.create({
      data: { fieldId: field.id, name: 'C', slug: `course-${SFX}` },
    });
    const topic = await prisma.topic.create({
      data: { courseId: course.id, name: 'T', slug: `topic-${SFX}`, weightPct: 100 },
    });

    // Two questions, so "answered" and "correct" can be told apart: one is
    // answered right and one wrong, and the ledger must show a different total.
    for (const n of [1, 2]) {
      const q = await prisma.question.create({
        data: {
          stableId: `AWARD-${n}-${SFX}`,
          topicId: topic.id,
          fieldId: field.id,
          qType: 'CONCEPT',
          stem: `Question ${n}`,
          conceptLine: 'A concept.',
          explanation: 'An explanation.',
          timeLimitSec: 60,
          status: 'PUBLISHED',
          authorId: 'author-x',
          options: {
            create: [
              { label: 'A', text: 'right', isCorrect: true },
              { label: 'B', text: 'wrong', isCorrect: false, whyWrong: 'Because.' },
            ],
          },
        },
      });
      questionIds.push(q.id);
    }

    const signIn = await signInByPhone(app, prisma, TG);
    token = signIn.token;
    userId = signIn.userId;

    await prisma.user.update({ where: { id: userId }, data: { fieldId: field.id } });
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  const answer = (questionId: string, label: 'A' | 'B') =>
    request(app.getHttpServer())
      .post('/attempts')
      .set('Cookie', `lomi_session=${token}`)
      .send({ questionId, chosenLabel: label, timeTakenSec: 20 })
      .expect(201);

  const standing = async () =>
    (
      await request(app.getHttpServer())
        .get('/me/standing')
        .set('Cookie', `lomi_session=${token}`)
        .expect(200)
    ).body;

  it('starts at nothing', async () => {
    const before = await standing();
    expect(before.totalPoints).toBe(0);
    expect(before.streakDays).toBe(0);
  });

  it('writes a ledger row for a right answer, and one for coming back', async () => {
    await answer(questionIds[0]!, 'A');

    const rows = await prisma.pointEntry.findMany({ where: { userId } });
    const byRule = new Map(rows.map((r) => [r.ruleId, r.points]));

    // Asserted against the ledger, not against the total: a total can be right
    // for the wrong reasons, and which rules fired is the thing that broke.
    expect(byRule.get(RULES.ANSWERED.id)).toBe(RULES.ANSWERED.points);
    expect(byRule.get(RULES.CORRECT.id)).toBe(RULES.CORRECT.points);
    expect(byRule.get(RULES.DAILY_RETURN.id)).toBe(RULES.DAILY_RETURN.points);
  });

  it('shows the points on the standing the student reads', async () => {
    const after = await standing();
    expect(after.totalPoints).toBe(
      RULES.ANSWERED.points + RULES.CORRECT.points + RULES.DAILY_RETURN.points,
    );
    // The whole point of the streak: it counts days, and today is one.
    expect(after.streakDays).toBe(1);
    expect(after.lastActiveDay).not.toBeNull();
  });

  it('awards the answer but not the correctness for a wrong one', async () => {
    const before = await standing();
    await answer(questionIds[1]!, 'B');
    const after = await standing();

    // Answering is worth something even when the answer is wrong — the product
    // rewards showing up, and PRODUCT.md's never-shame rule means a wrong answer
    // cannot be a penalty.
    expect(after.totalPoints).toBe(before.totalPoints + RULES.ANSWERED.points);
  });

  it('counts a day once, however many questions are answered', async () => {
    const returns = await prisma.pointEntry.count({
      where: { userId, ruleId: RULES.DAILY_RETURN.id },
    });
    // Two answers, one day. The streak measures returning, not volume — a
    // student who does ten minutes daily is better prepared than one who does
    // five hours the night before, and the points have to say so.
    expect(returns).toBe(1);
  });
});
