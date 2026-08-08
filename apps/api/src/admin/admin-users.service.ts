import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

export interface ResetResult {
  userId: string;
  displayName: string;
  /** How many live sessions were ended. Zero is an answer, not a failure. */
  revoked: number;
}

export interface MissedTopic {
  topicId: string;
  topicName: string;
  asked: number;
  missed: number;
  missRatePct: number;
  weightPct: number;
  /** Share of the whole exam's marks this topic is costing students, 0–100. */
  weightedGapPct: number;
}

export interface DeactivateResult {
  userId: string;
  displayName: string;
  active: boolean;
  deactivatedAt: string | null;
  revoked: number;
}

/**
 * Operator actions on a student's account (T-164).
 *
 * Both are things a student phones support about, and both are the kind of
 * action somebody may later have to answer for — so both are audited (T-167),
 * inside the same transaction as the change they describe.
 */
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Ends every session a student has (T-164).
   *
   * **Revoked, never deleted.** The device list answers "signed out on 8 August,
   * by support" only if the rows survive, and that is exactly the question asked
   * when somebody rings back confused about why they were logged out.
   */
  async resetDevices(userId: string, actorId: string, reason?: string): Promise<ResetResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true },
    });
    if (!user) throw new NotFoundException('No such student.');

    return this.prisma.$transaction(async (tx) => {
      const revoked = await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await this.audit.recordAction(
        {
          actorId,
          action: 'DEVICES_RESET',
          entity: 'user',
          entityId: userId,
          // The display name, never the legal name — an audit log is read by
          // people who have no business seeing one (T-086).
          reference: user.displayName,
          detail: `${revoked.count} session(s) ended${reason?.trim() ? ` — ${reason.trim()}` : ''}`,
        },
        tx,
      );

      return { userId, displayName: user.displayName, revoked: revoked.count };
    });
  }

  /**
   * Most-missed topics in a field, costliest first (T-162).
   *
   * Counts **attempts**, not students: a topic ten people each got wrong twice
   * is costing more than one nobody has reached, and the operator question is
   * where the marks are going rather than how many people are affected.
   */
  async missedTopics(fieldId: string): Promise<MissedTopic[]> {
    const topics = await this.prisma.topic.findMany({
      where: { course: { fieldId } },
      select: { id: true, name: true, weightPct: true },
      orderBy: { name: 'asc' },
    });

    const grouped = await this.prisma.attempt.groupBy({
      by: ['topicId'],
      where: { fieldId },
      _count: { _all: true },
    });
    const wrong = await this.prisma.attempt.groupBy({
      by: ['topicId'],
      where: { fieldId, isCorrect: false },
      _count: { _all: true },
    });
    const askedBy = new Map(grouped.map((g) => [g.topicId, g._count._all]));
    const missedBy = new Map(wrong.map((g) => [g.topicId, g._count._all]));

    return rankMissedTopics(
      topics.map((t) => ({
        topicId: t.id,
        topicName: t.name,
        asked: askedBy.get(t.id) ?? 0,
        missed: missedBy.get(t.id) ?? 0,
        // An unweighted topic contributes nothing to the ranking rather than
        // being guessed at — the same rule as T-130.
        weightPct: t.weightPct?.toNumber() ?? 0,
      })),
    );
  }

  /**
   * Deactivates or reactivates an account.
   *
   * Deactivating also ends every session, because an account that cannot sign in
   * but whose existing sessions keep working is deactivated in name only — and
   * the sessions last ninety days.
   *
   * Reactivation does **not** restore them. Signing back in is one tap, and
   * silently reviving sessions that were ended for a reason is the kind of thing
   * nobody remembers doing.
   */
  async setActive(
    userId: string,
    active: boolean,
    actorId: string,
    reason?: string,
  ): Promise<DeactivateResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, deactivatedAt: true },
    });
    if (!user) throw new NotFoundException('No such student.');

    return this.prisma.$transaction(async (tx) => {
      const deactivatedAt = active ? null : (user.deactivatedAt ?? new Date());
      await tx.user.update({ where: { id: userId }, data: { deactivatedAt } });

      const revoked = active
        ? { count: 0 }
        : await tx.session.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
          });

      await this.audit.recordAction(
        {
          actorId,
          action: active ? 'ACCOUNT_REACTIVATED' : 'ACCOUNT_DEACTIVATED',
          entity: 'user',
          entityId: userId,
          reference: user.displayName,
          detail: reason?.trim() || null,
        },
        tx,
      );

      return {
        userId,
        displayName: user.displayName,
        active,
        deactivatedAt: deactivatedAt?.toISOString() ?? null,
        revoked: revoked.count,
      };
    });
  }
}

/**
 * The most-missed topics across every student in a field (T-162).
 *
 * **Weighted by derived share, not by raw misses** (D5) — the same argument as
 * T-130, one level up. Raw misses point at whichever topic simply has the most
 * questions in the bank, which is a fact about the import queue rather than
 * about what students find hard. What an operator needs is where the marks are
 * actually going, so the ranking is the topic's share of past papers multiplied
 * by the share of it students are getting wrong.
 *
 * The consequence, and the reason this has its own test: **changing a topic's
 * weight changes the order**. That is the point. A reviewer who corrects a
 * weight (T-134a) is telling the system something about the exam, and this list
 * is one of the things that has to move when they do.
 */
export function rankMissedTopics(
  rows: readonly {
    topicId: string;
    topicName: string;
    asked: number;
    missed: number;
    weightPct: number;
  }[],
): MissedTopic[] {
  const round1 = (n: number): number => Math.round(n * 10) / 10;
  return (
    rows
      .filter((r) => r.asked > 0)
      .map((r) => {
        const missRate = r.missed / r.asked;
        return {
          topicId: r.topicId,
          topicName: r.topicName,
          asked: r.asked,
          missed: r.missed,
          missRatePct: round1(missRate * 100),
          weightPct: r.weightPct,
          weightedGapPct: round1(r.weightPct * missRate),
        };
      })
      // Costliest first, then by name so the same data always reads the same way.
      .sort((a, b) => b.weightedGapPct - a.weightedGapPct || a.topicName.localeCompare(b.topicName))
  );
}
