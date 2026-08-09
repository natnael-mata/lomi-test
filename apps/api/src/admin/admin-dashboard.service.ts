/**
 * The numbers an operator opens the admin on (T-160, T-161).
 *
 * **Every figure is a live count.** Nothing here is a stored counter kept in step
 * by a write path, because a counter that drifts is worse than no dashboard: it
 * looks like a measurement and reports a memory. The cost is a handful of counts
 * per page load, which at this size is nothing.
 *
 * **The segments partition the signups exactly**, and that is a deliberate
 * constraint rather than a coincidence. DESIGN.md's `<TotalBar>` throws in
 * development if its rows do not sum to its total, so a dashboard whose figures
 * merely coexist could not be rendered with it. Numbers that must add up are
 * numbers somebody can check.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Every signed-up student, in exactly one bucket.
 *
 * The names describe where somebody is with paying, not what kind of person
 * they are: a student who has answered nothing this week is `dormant` here and
 * is never told anything of the sort.
 */
export interface SignupBreakdown {
  signups: number;
  /** Paid, and access is live right now. */
  paying: number;
  /** Paid at some point; nothing live today. */
  lapsed: number;
  /** Never paid, but has answered at least one question. */
  trialling: number;
  /** Never paid, never answered. Signed up and went away. */
  dormant: number;
}

export interface DashboardOverview extends SignupBreakdown {
  /**
   * Claimed payments nobody has settled yet.
   *
   * A **queue length, not a segment** — it counts payments and everything above
   * counts students, so it is deliberately outside the partition. It is the one
   * number on this screen that is somebody's to-do list.
   */
  awaitingSettlement: number;
}

export interface RevenueRow {
  method: 'TELEBIRR' | 'CBEBIRR' | 'CHAPA' | 'BANK';
  /** Whole birr, from confirmed payments only. */
  etb: number;
  count: number;
}

export interface RevenueSplit {
  rows: RevenueRow[];
  totalEtb: number;
  totalCount: number;
}

/** What a search hit tells an operator, and nothing more (T-163). */
export interface UserSearchHit {
  userId: string;
  displayName: string;
  phone: string | null;
  telegramId: string | null;
  deactivated: boolean;
  /** How the row matched, so a surprising hit explains itself. */
  matchedOn: 'phone' | 'displayName' | 'txRef';
  /** Present only on a `txRef` match: the reference that found them. */
  txRef?: string;
}

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The overview (T-160).
   *
   * Deactivated accounts are counted. They are still signups, somebody may still
   * be owed a refund, and quietly dropping them would make the total disagree
   * with `SELECT count(*) FROM "User"` — which is the first thing anybody
   * checking this figure will run.
   */
  async overview(now: Date = new Date()): Promise<DashboardOverview> {
    const [signups, payingIds, everPaidIds, answeredIds, awaitingSettlement] = await Promise.all([
      this.prisma.user.count(),
      // Live access is the timestamp, never the status column — the same
      // authority the paywall uses (T-153). A dashboard that trusted `status`
      // would report access this product does not actually grant.
      this.prisma.subscription.findMany({
        where: { status: 'ACTIVE', expiresAt: { gt: now } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.subscription.findMany({
        where: { activatedAt: { not: null } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.attempt.findMany({ select: { userId: true }, distinct: ['userId'] }),
      this.prisma.payment.count({ where: { status: 'PENDING' } }),
    ]);

    const paying = new Set(payingIds.map((s) => s.userId));
    const everPaid = new Set(everPaidIds.map((s) => s.userId));
    const answered = new Set(answeredIds.map((a) => a.userId));

    const lapsed = [...everPaid].filter((id) => !paying.has(id)).length;
    const trialling = [...answered].filter((id) => !everPaid.has(id)).length;

    return {
      signups,
      paying: paying.size,
      lapsed,
      trialling,
      // The remainder, computed rather than counted, so the four buckets add up
      // to the total by construction. Counting it separately would give a fifth
      // query the chance to disagree with the other four.
      dormant: signups - paying.size - lapsed - trialling,
      awaitingSettlement,
    };
  }

  /**
   * Money taken, split by how it arrived (T-161).
   *
   * **Four rows, not the two the task named.** It was written when Chapa meant
   * one hosted redirect; telebirr and CBE Birr are now their own methods
   * (T-142), and folding them into "Chapa" would hide the split an operator
   * actually reconciles against — a student's receipt says telebirr, and so does
   * the conversation about it.
   *
   * **Confirmed payments only.** A pending claim is not revenue, and counting it
   * would report money that may never arrive; a rejected one is money that
   * definitely did not.
   */
  async revenue(): Promise<RevenueSplit> {
    const grouped = await this.prisma.payment.groupBy({
      by: ['method'],
      where: { status: 'CONFIRMED' },
      _sum: { amountEtb: true },
      _count: { _all: true },
    });

    const rows: RevenueRow[] = (['TELEBIRR', 'CBEBIRR', 'CHAPA', 'BANK'] as const).map((method) => {
      const row = grouped.find((g) => g.method === method);
      return { method, etb: row?._sum.amountEtb ?? 0, count: row?._count._all ?? 0 };
    });

    /*
     * Totalled from the rows, not queried separately.
     *
     * A second `SUM` over the same table is a second chance to disagree with the
     * first — different WHERE, different moment, and then a footing error nobody
     * can explain. Summing what is displayed makes the total true of the rows by
     * construction, which is the only sense in which a footing is worth stating.
     */
    return {
      rows,
      totalEtb: rows.reduce((sum, row) => sum + row.etb, 0),
      totalCount: rows.reduce((sum, row) => sum + row.count, 0),
    };
  }

  /**
   * Finds a student by phone, display name or transaction reference (T-163).
   *
   * All three at once, because an operator on a support call has whichever one
   * the student can read out — and a search box that accepts three things but
   * silently ignores one is worse than a box that accepts one.
   *
   * The reference match is **exact**, where the other two are partial. A `txRef`
   * is quoted off a receipt in full or not at all, and a prefix search over
   * references would return other people's payments to somebody who mistyped.
   */
  async search(query: string, limit = 20): Promise<UserSearchHit[]> {
    const term = query.trim();
    if (term.length < 3) return [];

    const [byReference, byPerson] = await Promise.all([
      this.prisma.payment.findMany({
        where: { txRef: term },
        select: { userId: true, txRef: true },
        take: limit,
      }),
      this.prisma.user.findMany({
        where: {
          OR: [
            { phone: { contains: term } },
            { displayName: { contains: term, mode: 'insensitive' } },
          ],
        },
        select: { id: true, displayName: true, phone: true, telegramId: true, deactivatedAt: true },
        take: limit,
      }),
    ]);

    const hits: UserSearchHit[] = [];
    const seen = new Set<string>();

    // Reference hits first: an operator who typed a full reference is looking at
    // a receipt, and that is the most specific thing they can have.
    for (const payment of byReference) {
      if (seen.has(payment.userId)) continue;
      const user = await this.prisma.user.findUnique({ where: { id: payment.userId } });
      if (!user) continue;
      seen.add(user.id);
      hits.push({
        userId: user.id,
        displayName: user.displayName,
        phone: user.phone,
        telegramId: user.telegramId,
        deactivated: user.deactivatedAt !== null,
        matchedOn: 'txRef',
        txRef: payment.txRef,
      });
    }

    for (const user of byPerson) {
      if (seen.has(user.id)) continue;
      seen.add(user.id);
      hits.push({
        userId: user.id,
        displayName: user.displayName,
        phone: user.phone,
        telegramId: user.telegramId,
        deactivated: user.deactivatedAt !== null,
        matchedOn: user.phone?.includes(term) ? 'phone' : 'displayName',
      });
    }

    return hits.slice(0, limit);
  }
}
