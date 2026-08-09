import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import type { SubscriptionAccess } from '../practice/subscription-access';
import { expiresAtFrom, isLive, offersFrom, type PlanOffer } from './plan';

/**
 * Paid access (T-140a, T-141, T-141b).
 *
 * **A plan grants the whole product, not one field** (T-141b, recorded in
 * PRODUCT.md). The price is a duration and nothing else — there is no per-field
 * price and never was. Selling per field would charge a student twice for the
 * same six months if they changed programme, and would put a paywall between
 * somebody and a decision they are still making.
 *
 * So `hasActiveSubscription` takes a `fieldId` it deliberately ignores. The
 * argument stays because the interface is the one `practice/` already calls, and
 * because a future per-field product would need it — removing it now would be a
 * change to every call site for a saving of nothing.
 */
@Injectable()
export class SubscriptionsService implements SubscriptionAccess {
  constructor(private readonly prisma: PrismaService) {}

  /** The plans on sale, cheapest per month first, with the maths done (T-141a). */
  async offers(): Promise<PlanOffer[]> {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { months: 'asc' },
      select: { code: true, months: true, priceEtb: true },
    });
    return offersFrom(plans);
  }

  /**
   * Whether this student currently has paid access.
   *
   * Reads `expiresAt` rather than trusting `status`: a subscription that ran out
   * an hour ago is still `ACTIVE` in the table until something sweeps it, and a
   * paywall that believes a stale column is one that lets people in for free.
   * The status is what an operator reads; the timestamp is what the gate reads.
   */
  async hasActiveSubscription(userId: string, _fieldId: string): Promise<boolean> {
    const live = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    return live !== null;
  }

  /**
   * Starts a purchase. Nothing is granted until a payment settles.
   *
   * `paidEtb` is copied from the plan **now**, so a price change between here
   * and settlement cannot alter what was agreed. `Plan.priceEtb` is the price
   * today; `Subscription.paidEtb` is the price a person was quoted (T-141).
   */
  async begin(userId: string, code: 'SIX_MONTH' | 'TWELVE_MONTH'): Promise<{ id: string }> {
    const plan = await this.prisma.plan.findUniqueOrThrow({ where: { code } });
    const created = await this.prisma.subscription.create({
      data: { userId, planId: plan.id, paidEtb: plan.priceEtb, status: 'PENDING' },
      select: { id: true },
    });
    return created;
  }

  /**
   * Settles a purchase and starts the clock.
   *
   * **Idempotent.** A payment provider retries, and a webhook arriving twice
   * must not extend access twice (T-144). The guard is a conditional update on
   * `status: 'PENDING'` in the WHERE, not a read followed by a write — two
   * retries land at the same moment more often than they ought to.
   */
  async activate(
    subscriptionId: string,
    now: Date = new Date(),
  ): Promise<{ activated: boolean; expiresAt: Date | null }> {
    const subscription = await this.prisma.subscription.findUniqueOrThrow({
      where: { id: subscriptionId },
      include: { plan: { select: { months: true } } },
    });

    if (subscription.status !== 'PENDING') {
      // Already settled. Report what it is rather than doing it again — the
      // caller is a retry, and the honest answer is the existing expiry.
      return { activated: false, expiresAt: subscription.expiresAt };
    }

    const expiresAt = expiresAtFrom(now, subscription.plan.months);
    const claimed = await this.prisma.subscription.updateMany({
      where: { id: subscriptionId, status: 'PENDING' },
      data: { status: 'ACTIVE', activatedAt: now, expiresAt },
    });

    if (claimed.count === 0) {
      const settled = await this.prisma.subscription.findUniqueOrThrow({
        where: { id: subscriptionId },
        select: { expiresAt: true },
      });
      return { activated: false, expiresAt: settled.expiresAt };
    }

    return { activated: true, expiresAt };
  }

  /** Marks anything past its expiry as EXPIRED. Safe to run repeatedly. */
  async sweepExpired(now: Date = new Date()): Promise<number> {
    const swept = await this.prisma.subscription.updateMany({
      where: { status: 'ACTIVE', expiresAt: { lte: now } },
      data: { status: 'EXPIRED' },
    });
    return swept.count;
  }

  /** What a student's access looks like, for a screen or an operator. */
  async statusFor(userId: string, now: Date = new Date()) {
    const latest = await this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { plan: { select: { code: true, months: true } } },
    });
    if (!latest) return { hasEverPaid: false, active: false, expiresAt: null, planCode: null };

    return {
      hasEverPaid: latest.activatedAt !== null,
      active: latest.status === 'ACTIVE' && isLive(latest.expiresAt, now),
      expiresAt: latest.expiresAt?.toISOString() ?? null,
      planCode: latest.plan.code,
    };
  }
}
