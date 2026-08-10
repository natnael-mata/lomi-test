/**
 * Integration test — points, streaks and the board (T-190, T-191, T-193, T-194).
 *
 * The arithmetic and the copy are proved in `points.test.ts` without a database.
 * What is checked here is what only a database can show: that the ledger really
 * is the only truth about a total, that a gap of any length leaves a streak
 * standing, and that a public board carries a display name and nothing else.
 *
 * Needs Postgres (`npm run db:dev`).
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { cleanupStaff, signInAsStaff, type StaffSession } from '../auth/staff-testkit.test-helper';
import { EngagementService } from './engagement.service';
import { RULES } from './points';

const SFX = 'e2e-engage';
const TG_A = 566000061;
const TG_B = 566000062;
const TG_C = 566000063;
const TG_ALL = [TG_A, TG_B, TG_C];

/** 10 August 2026, mid-afternoon in Addis. */
const at = (day: string, hhmm = '09:00'): Date => new Date(`${day}T${hhmm}:00.000Z`);

describe('points, streaks and the board (Phase 11)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let engagement: EngagementService;
  let a: StaffSession;
  let b: StaffSession;
  let c: StaffSession;

  const wipe = async (): Promise<void> => {
    const users = await prisma.user.findMany({
      where: { telegramId: { in: TG_ALL.map(String) } },
      select: { id: true },
    });
    await prisma.pointEntry.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await cleanupStaff(prisma, TG_ALL, SFX);
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    engagement = app.get(EngagementService);

    await wipe();
    a = await signInAsStaff(app, prisma, TG_A, 'REVIEWER', SFX);
    b = await signInAsStaff(app, prisma, TG_B, 'REVIEWER', SFX);
    c = await signInAsStaff(app, prisma, TG_C, 'REVIEWER', SFX);
    // Students, not staff — the board is a student surface.
    await prisma.staffMember.deleteMany({ where: { grantedBy: `test-${SFX}` } });
  });

  beforeEach(async () => {
    await prisma.pointEntry.deleteMany({
      where: { userId: { in: [a.userId, b.userId, c.userId] } },
    });
    await prisma.user.updateMany({
      where: { id: { in: [a.userId, b.userId, c.userId] } },
      data: { leaderboardOptOut: false },
    });
  });

  afterAll(async () => {
    await wipe();
    await app.close();
  });

  describe('every row names its source (T-190)', () => {
    /** T-190's stated test, against what actually landed in the table. */
    it('writes a rule id and a reason on every row', async () => {
      await engagement.record(a.userId, RULES.CORRECT);
      await engagement.touch(a.userId);

      const rows = await prisma.pointEntry.findMany({ where: { userId: a.userId } });
      expect(rows.length).toBeGreaterThan(1);
      for (const row of rows) {
        expect(row.ruleId.trim().length, JSON.stringify(row)).toBeGreaterThan(0);
        expect(row.reason.trim().length, JSON.stringify(row)).toBeGreaterThan(0);
      }
    });

    /**
     * The database refuses a nameless row too. The type makes it hard and the
     * CHECK makes it impossible — a future write path that reaches past the
     * service still cannot land one.
     */
    it('cannot be made to write a nameless row', async () => {
      await expect(
        prisma.pointEntry.create({
          data: { userId: a.userId, ruleId: '  ', points: 5, reason: '', day: '2026-08-10' },
        }),
      ).rejects.toThrow();
    });

    /**
     * The reason is copied in at award time. Rewording a rule must not silently
     * rewrite history — a student reading their ledger next month should see
     * what they were told at the time.
     */
    it('keeps the wording the student was shown', async () => {
      await engagement.record(a.userId, RULES.MOCK_COMPLETED);
      const [row] = await engagement.ledgerFor(a.userId);
      expect(row?.reason).toBe('You sat a full mock exam.');
      expect(row?.points).toBe(25);
    });
  });

  describe('a missed day never costs a streak (T-191)', () => {
    /**
     * **T-191's stated test, and the commitment the phase exists for.** Three
     * days engaged, then a fortnight away, then a return: the streak is four.
     */
    it('leaves the streak standing after a fortnight away', async () => {
      for (const day of ['2026-08-01', '2026-08-02', '2026-08-03']) {
        await engagement.touch(a.userId, at(day));
      }
      expect((await engagement.standingFor(a.userId)).streakDays).toBe(3);

      const entries = await engagement.touch(a.userId, at('2026-08-17'));
      const standing = await engagement.standingFor(a.userId);

      expect(standing.streakDays).toBe(4);
      const adjusted = entries.find((e) => e.ruleId === 'plan-adjusted');
      expect(adjusted?.points).toBe(0);
      expect(adjusted?.reason).toContain('13 days');
      expect(adjusted?.reason).toContain('nothing is lost');
    });

    it('adds no points and takes none for the gap', async () => {
      await engagement.touch(a.userId, at('2026-08-01'));
      const before = (await engagement.standingFor(a.userId)).totalPoints;
      await engagement.touch(a.userId, at('2026-08-20'));
      const after = (await engagement.standingFor(a.userId)).totalPoints;

      // Exactly the daily return. The adjustment row is worth zero.
      expect(after - before).toBe(RULES.DAILY_RETURN.points);
    });

    it('counts six visits in one day as one day, and one return', async () => {
      for (let i = 0; i < 6; i++)
        await engagement.touch(a.userId, at('2026-08-10', '0%d:00'.replace('%d', String(i + 1))));
      const standing = await engagement.standingFor(a.userId);
      expect(standing.streakDays).toBe(1);
      expect(standing.totalPoints).toBe(RULES.DAILY_RETURN.points);
    });

    /**
     * Ethiopian local time. 22:30 UTC is 01:30 the next day in Addis, so a
     * student answering late at night is on tomorrow's day — which is the day
     * the streak counts.
     */
    it('rolls the day over at midnight in Addis, not in UTC', async () => {
      await engagement.touch(a.userId, at('2026-08-10', '20:00'));
      await engagement.touch(a.userId, at('2026-08-10', '22:30'));
      expect((await engagement.standingFor(a.userId)).streakDays).toBe(2);
    });
  });

  describe('the totals are the ledger (T-190)', () => {
    it('sums from the rows rather than a stored counter', async () => {
      await engagement.record(a.userId, RULES.CORRECT);
      await engagement.record(a.userId, RULES.CORRECT);
      await engagement.record(a.userId, RULES.MOCK_COMPLETED);

      const standing = await engagement.standingFor(a.userId);
      const sum = await prisma.pointEntry.aggregate({
        where: { userId: a.userId },
        _sum: { points: true },
      });
      expect(standing.totalPoints).toBe(sum._sum.points);
      expect(standing.totalPoints).toBe(29);
    });

    it('cannot drift, because there is nowhere for it to drift to', async () => {
      const columns = Object.keys(await prisma.user.findFirstOrThrow({ where: { id: a.userId } }));
      for (const forbidden of ['totalPoints', 'streakDays', 'points', 'tier']) {
        expect(columns, forbidden).not.toContain(forbidden);
      }
    });

    it('reports a tier and the distance to the next', async () => {
      await engagement.record(a.userId, RULES.MOCK_COMPLETED);
      await engagement.record(a.userId, RULES.MOCK_COMPLETED);
      const standing = await engagement.standingFor(a.userId);
      expect(standing.totalPoints).toBe(50);
      expect(standing.tier).toBe('BRONZE');
      expect(standing.pointsToNextTier).toBe(150);
    });
  });

  describe('the board (T-193, T-194)', () => {
    const score = async (session: StaffSession, mocks: number): Promise<void> => {
      for (let i = 0; i < mocks; i++) await engagement.record(session.userId, RULES.MOCK_COMPLETED);
    };

    /** T-193's stated test: no legal name anywhere near the response. */
    it('carries a display name and nothing else', async () => {
      await score(a, 3);
      const res = await request(app.getHttpServer()).get('/me/leaderboard').set(a.auth).expect(200);

      const body = JSON.stringify(res.body);
      for (const forbidden of ['verifiedName', '"name"', 'userId', 'telegramId', 'phone']) {
        expect(body.includes(forbidden), `${forbidden} appeared on the board`).toBe(false);
      }
      expect(res.body.rows[0].displayName).toBeTruthy();
    });

    it('marks the asker’s own row', async () => {
      await score(a, 3);
      await score(b, 1);
      const view = await engagement.leaderboard(b.userId);
      expect(view.rows.find((r) => r.isYou)?.points).toBe(25);
      expect(view.rows.filter((r) => r.isYou)).toHaveLength(1);
    });

    /** T-194's stated test: absent from the list, still told their rank. */
    it('hides an opted-out student but still answers "how am I doing"', async () => {
      await score(a, 3);
      await score(b, 2);
      await score(c, 1);
      await engagement.setLeaderboardOptOut(b.userId, true);

      const theirs = await engagement.leaderboard(b.userId);
      expect(theirs.rows.some((r) => r.isYou)).toBe(false);
      expect(theirs.you?.rank).toBe(2);
      expect(theirs.you?.points).toBe(50);
      expect(theirs.you?.listed).toBe(false);

      // And they are gone from everybody else's view too.
      const others = await engagement.leaderboard(a.userId);
      expect(others.rows.map((r) => r.points)).not.toContain(50);
    });

    /**
     * Hiding one student must not promote another. A board where that happened
     * would report a different competition to each viewer.
     */
    it('ranks over everybody, then filters', async () => {
      await score(a, 3); // 75
      await score(b, 2); // 50
      await score(c, 1); // 25
      await engagement.setLeaderboardOptOut(b.userId, true);

      const view = await engagement.leaderboard(a.userId);
      const cRow = view.rows.find((r) => r.points === 25);
      // Third, not second — the student above them still exists.
      expect(cRow?.rank).toBe(3);
    });

    it('gives tied students the same rank', async () => {
      await score(a, 2);
      await score(b, 2);
      const view = await engagement.leaderboard(a.userId);
      const ranks = view.rows.filter((r) => r.points === 50).map((r) => r.rank);
      expect(new Set(ranks).size).toBe(1);
    });

    it('lets a student change their mind', async () => {
      await score(a, 1);
      await engagement.setLeaderboardOptOut(a.userId, true);
      expect((await engagement.leaderboard(a.userId)).you?.listed).toBe(false);
      await engagement.setLeaderboardOptOut(a.userId, false);
      expect((await engagement.leaderboard(a.userId)).you?.listed).toBe(true);
    });

    it('says nothing about a student who has scored nothing', async () => {
      const view = await engagement.leaderboard(a.userId);
      expect(view.you).toBeNull();
    });

    it('turns away a caller with no session', async () => {
      await request(app.getHttpServer()).get('/me/leaderboard').expect(401);
      await request(app.getHttpServer()).get('/me/points').expect(401);
    });
  });
});
