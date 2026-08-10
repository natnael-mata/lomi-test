/**
 * Points, streaks and the leaderboard (T-190, T-191, T-193, T-194).
 *
 * **The ledger is the only truth.** Total points is a SUM over `PointEntry` and
 * the streak is a COUNT of distinct days — there is no stored counter anywhere,
 * because a counter kept in step by a write path is one that will eventually
 * disagree with the rows it summarises, and the first anybody hears of that is a
 * student saying their number is wrong.
 *
 * The arithmetic and the copy live in `points.ts`, without a database.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import {
  RULES,
  award,
  dayOf,
  entriesForReturn,
  pointsToNextTier,
  tierFor,
  type LedgerEntry,
  type PointRule,
  type TierId,
} from './points';

export interface StandingView {
  totalPoints: number;
  streakDays: number;
  tier: TierId;
  pointsToNextTier: number | null;
  lastActiveDay: string | null;
}

export interface LedgerRow {
  ruleId: string;
  points: number;
  reason: string;
  day: string;
  at: string;
}

/**
 * One row of the leaderboard.
 *
 * **Display name only** (T-193). There is deliberately no `name`, no
 * `verifiedName` and no user id: a public board is the surface where the Fayda
 * legal name must never appear, and the safest way to guarantee that is for the
 * shape carrying the board to have nowhere to put one.
 */
export interface LeaderboardRow {
  rank: number;
  displayName: string;
  points: number;
  tier: TierId;
  /** True for the row belonging to whoever asked. */
  isYou: boolean;
}

export interface LeaderboardView {
  rows: LeaderboardRow[];
  /**
   * Where the asker stands, even when they are not in `rows`.
   *
   * Present for an opted-out student too (T-194): opting out hides the row, not
   * the rank. A product that answers "you have opted out" when asked "how am I
   * doing" has punished somebody for a privacy choice.
   */
  you: { rank: number; points: number; tier: TierId; listed: boolean } | null;
}

@Injectable()
export class EngagementService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records an award.
   *
   * Takes a **rule**, never a number and a sentence, so "every row names its
   * source" is a property of the type rather than a habit. The database checks
   * it too — a caller reaching past this method still cannot write a nameless
   * row.
   */
  async record(userId: string, rule: PointRule, now: Date = new Date()): Promise<LedgerEntry> {
    const entry = award(rule);
    await this.prisma.pointEntry.create({
      data: { userId, ...entry, day: dayOf(now) },
    });
    return entry;
  }

  /**
   * Marks a student active today, and writes the rows that go with it (T-191).
   *
   * Idempotent per day: a student who opens the app six times gets one
   * `daily-return`. The streak measures returning, not volume.
   */
  async touch(userId: string, now: Date = new Date()): Promise<LedgerEntry[]> {
    const today = dayOf(now);
    const alreadyToday = await this.prisma.pointEntry.findFirst({
      where: { userId, day: today, ruleId: RULES.DAILY_RETURN.id },
      select: { id: true },
    });
    if (alreadyToday) return [];

    /*
     * The last active day **before today**, not the last active day.
     *
     * An earlier version asked for the latter, and it was wrong in the ordinary
     * case: answering a question writes a row dated today, so a `touch` a moment
     * later saw today as the last active day, concluded the student had already
     * returned, and awarded nothing. The daily return would then only ever fire
     * when `touch` happened to run first.
     *
     * Same-day idempotency is the `alreadyToday` check above, which looks for a
     * daily-return row specifically. This query is only about the gap.
     */
    const last = await this.prisma.pointEntry.findFirst({
      where: { userId, day: { lt: today } },
      orderBy: { day: 'desc' },
      select: { day: true },
    });

    const entries = entriesForReturn({ days: 0, lastActiveDay: last?.day ?? null }, today);
    if (entries.length > 0) {
      await this.prisma.pointEntry.createMany({
        data: entries.map((entry) => ({ userId, ...entry, day: today })),
      });
    }
    return entries;
  }

  /** Where this student stands. Every figure derived from the ledger. */
  async standingFor(userId: string): Promise<StandingView> {
    const [sum, days, last] = await Promise.all([
      this.prisma.pointEntry.aggregate({ where: { userId }, _sum: { points: true } }),
      // The streak: distinct days with any row at all. Nothing subtracts from
      // it, which is T-191 expressed as a query rather than as a rule somebody
      // has to remember not to write.
      this.prisma.pointEntry.findMany({
        where: { userId },
        distinct: ['day'],
        select: { day: true },
      }),
      this.prisma.pointEntry.findFirst({
        where: { userId },
        orderBy: { day: 'desc' },
        select: { day: true },
      }),
    ]);

    const totalPoints = sum._sum.points ?? 0;
    return {
      totalPoints,
      streakDays: days.length,
      tier: tierFor(totalPoints),
      pointsToNextTier: pointsToNextTier(totalPoints),
      lastActiveDay: last?.day ?? null,
    };
  }

  /** The student's own ledger, newest first. What every number was for. */
  async ledgerFor(userId: string, limit = 50): Promise<LedgerRow[]> {
    const rows = await this.prisma.pointEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { ruleId: true, points: true, reason: true, day: true, createdAt: true },
    });
    return rows.map((row) => ({
      ruleId: row.ruleId,
      points: row.points,
      reason: row.reason,
      day: row.day,
      at: row.createdAt.toISOString(),
    }));
  }

  /**
   * The public board (T-193, T-194).
   *
   * **Ranked over everybody, listed for some.** The rank is computed across all
   * students and only then filtered, so opting out does not quietly promote the
   * people around you — a board where hiding one student moves another up is a
   * board reporting a different competition to each viewer.
   */
  async leaderboard(viewerId: string, limit = 20): Promise<LeaderboardView> {
    const totals = await this.prisma.pointEntry.groupBy({
      by: ['userId'],
      _sum: { points: true },
      orderBy: { _sum: { points: 'desc' } },
    });

    const users = await this.prisma.user.findMany({
      where: { id: { in: totals.map((t) => t.userId) } },
      select: { id: true, displayName: true, leaderboardOptOut: true, deactivatedAt: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    // Ranked first, over everybody. Ties share a rank: two students on 40 points
    // are both second, because telling one of them they are third is a claim the
    // numbers do not support.
    let rank = 0;
    let previousPoints: number | null = null;
    const ranked = totals.map((total, index) => {
      const points = total._sum.points ?? 0;
      if (points !== previousPoints) {
        rank = index + 1;
        previousPoints = points;
      }
      return { userId: total.userId, points, rank };
    });

    const you = ranked.find((row) => row.userId === viewerId);
    const viewer = byId.get(viewerId);

    const rows: LeaderboardRow[] = ranked
      .filter((row) => {
        const user = byId.get(row.userId);
        // Deactivated accounts leave the board too — a name on a public list is
        // a presence, and a closed account should not have one.
        return user !== undefined && !user.leaderboardOptOut && user.deactivatedAt === null;
      })
      .slice(0, limit)
      .map((row) => ({
        rank: row.rank,
        // The display name and nothing else. See `LeaderboardRow`.
        displayName: byId.get(row.userId)?.displayName ?? '',
        points: row.points,
        tier: tierFor(row.points),
        isYou: row.userId === viewerId,
      }));

    return {
      rows,
      you: you
        ? {
            rank: you.rank,
            points: you.points,
            tier: tierFor(you.points),
            listed: viewer !== undefined && !viewer.leaderboardOptOut,
          }
        : null,
    };
  }

  /** Hides or shows this student on public boards. Their own choice, their own row. */
  async setLeaderboardOptOut(userId: string, optOut: boolean): Promise<{ optedOut: boolean }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { leaderboardOptOut: optOut },
    });
    return { optedOut: optOut };
  }
}
