import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { SubscriptionAccess } from '../practice/subscription-access';
import { expiresAtFrom, isLive, offersFrom, renewalStartsAt, type PlanOffer } from './plan';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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

    /*
     * Renewal counts from the existing expiry, not from today (T-146a).
     *
     * A student renewing a week early would otherwise lose that week, and the
     * lesson that teaches is to wait until access has lapsed before paying.
     * Once it HAS lapsed the clock starts now — backdating a June renewal to a
     * March expiry would sell somebody three months they cannot use.
     */
    const live = await this.prisma.subscription.findFirst({
      where: {
        userId: subscription.userId,
        status: 'ACTIVE',
        expiresAt: { gt: now },
        id: { not: subscriptionId },
      },
      orderBy: { expiresAt: 'desc' },
      select: { expiresAt: true },
    });

    const startsAt = renewalStartsAt(live?.expiresAt ?? null, now);
    const expiresAt = expiresAtFrom(startsAt, subscription.plan.months);
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

  /**
   * Marks everything past its expiry as `EXPIRED` (T-153).
   *
   * **Tidying, not enforcement, and the distinction matters.** The paywall reads
   * `expiresAt` and not `status` (see `hasActiveSubscription`), so access ends at
   * the timestamp whether or not this has ever run. What it fixes is the column
   * an operator reads, which would otherwise say `ACTIVE` about a subscription
   * that ended in March.
   *
   * That ordering is deliberate. A product whose paywall depends on a sweeper
   * having run is a product that hands out free access every time a scheduler
   * dies, and schedulers die quietly. Here the worst a missed sweep can do is
   * make a report untidy.
   *
   * **Nothing is deleted.** An expired subscription keeps its payments, its
   * dates and its plan: a student who renews in September should find their
   * March history intact, and a dispute about a payment is not helped by the
   * record of it having been tidied away.
   *
   * Safe to run repeatedly, and safe to forget.
   */
  async sweepExpired(now: Date = new Date()): Promise<number> {
    const swept = await this.prisma.subscription.updateMany({
      where: { status: 'ACTIVE', expiresAt: { lte: now } },
      data: { status: 'EXPIRED' },
    });
    return swept.count;
  }

  /**
   * What a student's access looks like, for a screen or an operator.
   *
   * Sweeps this **one** student's stale rows first (T-153). There is no
   * scheduler in this project — the exam module makes the same call, and for the
   * same reason: a `setTimeout` at boot is silently dropped by every deploy while
   * staying green in a test process that never restarts. So expiry is tidied
   * lazily, at the moment the stale value would be read, which is the only moment
   * it is visible.
   *
   * Scoped to one user rather than the whole table because this runs on a screen
   * a student opened. `sweepExpired` is the whole-table pass, and it is behind an
   * admin route.
   */
  async statusFor(userId: string, now: Date = new Date()) {
    await this.prisma.subscription.updateMany({
      where: { userId, status: 'ACTIVE', expiresAt: { lte: now } },
      data: { status: 'EXPIRED' },
    });

    const latest = await this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { plan: { select: { code: true, months: true } } },
    });
    if (!latest) return { hasEverPaid: false, active: false, expiresAt: null, planCode: null };

    return {
      hasEverPaid: latest.activatedAt !== null,
      // Still `&& isLive`, even after the sweep above. The sweep only touches
      // rows that were already stale; the authority is the timestamp, and a
      // status read is never allowed to become the thing that decides.
      active: latest.status === 'ACTIVE' && isLive(latest.expiresAt, now),
      expiresAt: latest.expiresAt?.toISOString() ?? null,
      planCode: latest.plan.code,
    };
  }

  /**
   * Records a bank transfer the student says they have made (T-145).
   *
   * **Creates a PENDING payment and grants nothing** (T-146). A reference typed
   * off a receipt proves that somebody typed something; it does not prove the
   * money moved. Only an operator who has looked at the bank statement can
   * settle it.
   *
   * The duplicate check is a **unique constraint**, not a lookup — two students
   * submitting the same reference a second apart would both pass a read, and an
   * operator confirming both would grant twelve months for one transfer.
   */
  async submitManualPayment(
    userId: string,
    code: 'SIX_MONTH' | 'TWELVE_MONTH',
    txRef: string,
  ): Promise<{ paymentId: string; subscriptionId: string; status: 'PENDING' }> {
    const reference = txRef.trim();
    if (reference.length === 0) {
      throw new UnprocessableEntityException({
        error: 'TX_REF_REQUIRED',
        message: 'Enter the transaction reference from your transfer receipt.',
      });
    }

    const plan = await this.prisma.plan.findUniqueOrThrow({ where: { code } });

    try {
      return await this.prisma.$transaction(async (tx) => {
        const subscription = await tx.subscription.create({
          data: { userId, planId: plan.id, paidEtb: plan.priceEtb, status: 'PENDING' },
          select: { id: true },
        });
        const payment = await tx.payment.create({
          data: {
            userId,
            subscriptionId: subscription.id,
            method: 'BANK',
            amountEtb: plan.priceEtb,
            txRef: reference,
          },
          select: { id: true },
        });
        return {
          paymentId: payment.id,
          subscriptionId: subscription.id,
          status: 'PENDING' as const,
        };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Said plainly, because the commonest cause is a student pressing submit
        // twice rather than anybody trying anything.
        throw new ConflictException({
          error: 'TX_REF_ALREADY_SUBMITTED',
          message: 'That transaction reference has already been submitted. Support can check it.',
        });
      }
      throw error;
    }
  }

  /**
   * An operator confirms a transfer really arrived, and access begins.
   *
   * Audited by the payment row itself — who settled it and when — rather than
   * only by a log line, because this is the action somebody will be asked about.
   */
  async confirmManualPayment(
    paymentId: string,
    actorId: string,
    note?: string,
    now: Date = new Date(),
  ): Promise<{ activated: boolean; expiresAt: Date | null }> {
    const payment = await this.settleManually(paymentId, actorId, 'CONFIRMED', note, now);
    return this.activate(payment.subscriptionId, now);
  }

  /**
   * An operator refuses a transfer that never arrived (T-152).
   *
   * The pair of `confirmManualPayment`, and not an afterthought: `REJECTED`
   * existed as a status with no way for anybody to set it, which left an
   * operator who had checked the statement and found nothing with no move
   * except to leave the claim pending forever. A student is owed the answer.
   *
   * The reason is **required** here where the confirming note is optional. A
   * refusal is what somebody will dispute, and "rejected" with no reason is not
   * something a support conversation can start from.
   */
  async rejectManualPayment(
    paymentId: string,
    actorId: string,
    reason: string,
    now: Date = new Date(),
  ): Promise<{ paymentId: string; status: 'REJECTED' }> {
    if (reason.trim().length === 0) {
      throw new UnprocessableEntityException({
        error: 'REASON_REQUIRED',
        message: 'Say why this payment is being refused. The student will be told.',
      });
    }
    await this.settleManually(paymentId, actorId, 'REJECTED', reason, now);
    return { paymentId, status: 'REJECTED' };
  }

  /**
   * Settles a claimed payment either way, and writes the audit row (T-152).
   *
   * **The audit write is inside the same transaction as the settlement.** A
   * record that survives a rolled-back confirmation is a lie about what
   * happened, and one that vanishes while the confirmation stands is worse —
   * this is the action somebody will be asked to answer for.
   *
   * The conditional `updateMany` on `status: 'PENDING'` is the guard, not the
   * read above it: two operators working the same queue land here at once more
   * often than the ordering suggests, and the read-then-write version grants
   * twice.
   */
  private async settleManually(
    paymentId: string,
    actorId: string,
    outcome: 'CONFIRMED' | 'REJECTED',
    note: string | undefined,
    now: Date,
  ): Promise<{ subscriptionId: string }> {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.status !== 'PENDING') {
      throw new ConflictException({
        error: 'PAYMENT_ALREADY_SETTLED',
        message: 'That payment has already been settled.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: { id: paymentId, status: 'PENDING' },
        data: { status: outcome, settledBy: actorId, settledAt: now, note: note?.trim() || null },
      });
      if (claimed.count === 0) {
        throw new ConflictException({
          error: 'PAYMENT_ALREADY_SETTLED',
          message: 'That payment has already been settled.',
        });
      }

      await this.audit.recordAction(
        {
          actorId,
          action: outcome === 'CONFIRMED' ? 'PAYMENT_CONFIRMED' : 'PAYMENT_REJECTED',
          entity: 'payment',
          entityId: paymentId,
          // The transaction reference, which is what a dispute is actually
          // about — and readable after the row it points at is gone.
          reference: payment.txRef,
          detail:
            `${payment.method} · Br ${payment.amountEtb}` +
            (note?.trim() ? ` — ${note.trim()}` : ''),
        },
        tx,
      );

      return { subscriptionId: payment.subscriptionId };
    });
  }
}

/** A Prisma unique-constraint violation, without importing the whole error type. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
  );
}
