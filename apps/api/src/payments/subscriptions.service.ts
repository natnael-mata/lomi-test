import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { freeRemaining } from '../practice/attempt-rules';
import type { PlanCode } from '@prisma/client';
import type { SubscriptionAccess } from '../practice/subscription-access';
import {
  expiresAtFrom,
  isLive,
  offersFrom,
  plansForTrack,
  renewalStartsAt,
  type PlanOffer,
} from './plan';

/** One line of a student's own payment history (T-154). */
export interface PaymentHistoryRow {
  id: string;
  method: string;
  status: string;
  amountEtb: number;
  txRef: string;
  months: number | null;
  claimedAt: string;
  settledAt: string | null;
  accessUntil: string | null;
}

export interface PaymentHistory {
  payments: PaymentHistoryRow[];
}

/** One claimed bank transfer, as an operator settling it needs to see it (T-224). */
export interface ManualClaim {
  paymentId: string;
  userId: string;
  status: string;
  amountEtb: number;
  txRef: string;
  note: string | null;
  claimedAt: string;
  settledAt: string | null;
  student: string | null;
  phone: string | null;
  joinedAt: string | null;
  priorPayments: number;
  priorVerified: number;
}

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
  async offers(userId?: string): Promise<PlanOffer[]> {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { months: 'asc' },
      select: { code: true, months: true, priceEtb: true },
    });

    /*
     * Filtered by the student's own track (T-268).
     *
     * `userId` is optional only so the seeding scripts and tests can ask what
     * is on sale without inventing a student. Every route into here supplies
     * one — the endpoint is behind `SessionGuard`, because scoping by track
     * needs to know who is asking.
     */
    const maxGrade = userId === undefined ? null : await this.maxGradeFor(userId);
    return offersFrom(plansForTrack(plans, maxGrade));
  }

  /**
   * Refuses a plan this student is not offered (T-268).
   *
   * **Filtering the picker is not enforcement.** `offers()` decides what a
   * student *sees*; this decides what they can *buy*, and until both existed a
   * Grade 6 account could submit a payment for the Br 800 exit-exam plan — a
   * plan it is never shown — simply by naming it. The two rules were one
   * `plansForTrack` call apart and only one of them was load-bearing.
   *
   * It matters in both directions. A school family charged Br 800 for a Br 300
   * product is the obvious harm; the quieter one is that the price on the screen
   * and the price on the invoice could disagree at all, which is the kind of
   * thing that is discovered by a parent rather than by us.
   *
   * Called by every purchase path — manual transfer, telebirr, CBE Birr and
   * Chapa — because a guard on three of four doors is a guard on none.
   */
  async assertPlanAllowed(userId: string, code: PlanCode): Promise<void> {
    const active = await this.prisma.plan.findMany({
      where: { isActive: true },
      select: { code: true },
    });
    const allowed = plansForTrack(active, await this.maxGradeFor(userId));
    if (!allowed.some((plan) => plan.code === code)) {
      throw new UnprocessableEntityException({
        error: 'PLAN_NOT_OFFERED',
        // Names the fix rather than the rule. A student who somehow reaches
        // this has a stale page, and reloading is what fixes it.
        message: 'That plan is not available on your programme. Reload and choose again.',
      });
    }
  }

  /** The year a student's track ends in, or null for an exit exam. */
  private async maxGradeFor(userId: string): Promise<number | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fieldId: true },
    });
    if (!user?.fieldId) return null;
    const field = await this.prisma.field.findUnique({
      where: { id: user.fieldId },
      select: { maxGrade: true },
    });
    return field?.maxGrade ?? null;
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
  async begin(userId: string, code: PlanCode): Promise<{ id: string }> {
    // Every purchase path checks. See `assertPlanAllowed`.
    await this.assertPlanAllowed(userId, code);
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
      include: { plan: { select: { months: true, code: true } } },
    });

    if (subscription.status !== 'PENDING') {
      // Already settled. Report what it is rather than doing it again — the
      // caller is a retry, and the honest answer is the existing expiry.
      return { activated: false, expiresAt: subscription.expiresAt };
    }

    /*
     * The plan must still fit the student's track (T-268).
     *
     * The purchase gate checks at submit; approval happens later, and a bank
     * transfer can sit in the queue for a day. Without this, claiming
     * `SCHOOL_YEAR` on a Grade 6 account and switching programme before the
     * operator gets to it buys twelve months of an exit-exam track for Br 300.
     * The switch itself is blocked once access is live, so this closes the
     * other ordering — switch first, approve second.
     *
     * A refusal rather than a silent grant, and deliberately not a rejection:
     * the money is real and the student may have moved for an honest reason.
     * Same shape as an underpayment — a thing a person looks at.
     */
    await this.assertPlanAllowed(subscription.userId, subscription.plan.code);

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

    /*
     * **The LIVE subscription, not the newest row.**
     *
     * This read `findFirst({ orderBy: { createdAt: 'desc' } })` and reported on
     * whatever came back — which told a student who had paid that they had not.
     * The path is ordinary: try telebirr, abandon it (a PENDING subscription is
     * left behind), pay by bank transfer, get approved. The approved row is
     * older than the abandoned one, so the newest row is PENDING and the Access
     * tab says `hasEverPaid: false` over a subscription that is running.
     *
     * The paywall was never fooled — `hasActiveSubscription` has always asked
     * the right question — so the student kept their access and was told they
     * had not paid for it. A screen and a gate disagreeing about the same fact
     * is worse than either being wrong alone.
     *
     * Found in QA, 2026-08-19.
     */
    const live = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE', expiresAt: { gt: now } },
      orderBy: { expiresAt: 'desc' },
      include: { plan: { select: { code: true, months: true } } },
    });

    const latest =
      live ??
      (await this.prisma.subscription.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { plan: { select: { code: true, months: true } } },
      }));
    const waiting = await this.pendingClaimFor(userId);
    const free = await this.freeLeftFor(userId);
    if (!latest) {
      return {
        hasEverPaid: false,
        active: false,
        expiresAt: null,
        planCode: null,
        pendingClaim: waiting,
        freeRemaining: free,
      };
    }

    /*
     * "Has ever paid" is about the account, not about one row.
     *
     * Read off `latest` it meant "the row I happened to pick was activated",
     * which flips to false the moment somebody starts a second checkout. It is
     * what a renewal screen keys off, so getting it wrong shows a returning
     * student the first-purchase copy.
     */
    const everActivated = await this.prisma.subscription.count({
      where: { userId, activatedAt: { not: null } },
    });

    return {
      hasEverPaid: everActivated > 0,
      // Still `&& isLive`, even after the sweep above. The sweep only touches
      // rows that were already stale; the authority is the timestamp, and a
      // status read is never allowed to become the thing that decides.
      active: latest.status === 'ACTIVE' && isLive(latest.expiresAt, now),
      expiresAt: latest.expiresAt?.toISOString() ?? null,
      planCode: latest.plan.code,
      pendingClaim: waiting,
      freeRemaining: free,
    };
  }

  /**
   * A bank transfer the student has submitted and nobody has settled yet.
   *
   * On `/home` this is the difference between a student who thinks their money
   * vanished and one who knows it is in a queue. `/checkout` had the sentence
   * all along — "Reference … is with our team" — and the home page, which is
   * where somebody actually lands, said only "You are on the free questions".
   *
   * The reference is included because it is what a worried student quotes when
   * they ask about it, and it is theirs already.
   */
  private async pendingClaimFor(
    userId: string,
  ): Promise<{ txRef: string; amountEtb: number } | null> {
    const claim = await this.prisma.payment.findFirst({
      where: { userId, status: 'PENDING', method: 'BANK' },
      orderBy: { createdAt: 'desc' },
      select: { txRef: true, amountEtb: true },
    });
    return claim ? { txRef: claim.txRef, amountEtb: claim.amountEtb } : null;
  }

  /**
   * Free questions left in the student's own programme, or null with no
   * programme chosen.
   *
   * Counted in distinct questions, by `freeRemaining` — the same rule the
   * practice path enforces, called rather than restated, because a home page
   * that computes the allowance separately is a home page that will eventually
   * disagree with the paywall about how many are left.
   */
  private async freeLeftFor(userId: string): Promise<number | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fieldId: true },
    });
    if (!user?.fieldId) return null;

    const distinct = await this.prisma.attempt.findMany({
      where: { userId, fieldId: user.fieldId },
      distinct: ['questionId'],
      select: { questionId: true },
    });
    return freeRemaining(distinct.length);
  }

  /**
   * Everything this student has paid, newest first (T-154).
   *
   * The receipt and the history are one query because they are one fact read at
   * two zoom levels: the top of the screen shows the most recent settled
   * payment in full, and the list under it shows the rest. Splitting them into
   * two endpoints would let the two halves disagree about which payment is the
   * latest.
   *
   * **Includes pending and rejected rows.** A student whose bank transfer is
   * still being checked needs to see it sitting there with its reference —
   * showing only confirmed payments makes a claim look like it was never
   * received, which is when somebody pays twice.
   */
  async historyFor(userId: string): Promise<PaymentHistory> {
    const payments = await this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        method: true,
        status: true,
        amountEtb: true,
        txRef: true,
        createdAt: true,
        settledAt: true,
        subscriptionId: true,
      },
    });

    // One extra query rather than a join per row: the plan length is what the
    // receipt calls "12 months · every programme", and a payment row does not
    // carry it.
    const subscriptions = await this.prisma.subscription.findMany({
      where: { id: { in: payments.map((p) => p.subscriptionId) } },
      select: { id: true, expiresAt: true, plan: { select: { months: true } } },
    });
    const months = new Map(subscriptions.map((s) => [s.id, s.plan.months]));
    const expiries = new Map(subscriptions.map((s) => [s.id, s.expiresAt]));

    return {
      payments: payments.map((p) => ({
        id: p.id,
        method: p.method,
        status: p.status,
        amountEtb: p.amountEtb,
        txRef: p.txRef,
        months: months.get(p.subscriptionId) ?? null,
        // Claimed at, for a pending row; settled at, once somebody has looked.
        // Labelling a claim's date as "paid" would put a date on a payment
        // nobody has confirmed happened.
        claimedAt: p.createdAt.toISOString(),
        settledAt: p.settledAt?.toISOString() ?? null,
        accessUntil: expiries.get(p.subscriptionId)?.toISOString() ?? null,
      })),
    };
  }

  /**
   * Claimed bank transfers waiting for somebody to read a statement (T-224).
   *
   * Pending first and oldest first within that, because the queue is worked
   * from the top and the person who has been waiting longest is the one owed an
   * answer. Settled rows are kept in the list, capped, so an operator can see
   * what they just did rather than watching it vanish.
   *
   * The student's Telegram handle and phone come along because settling a claim
   * means matching a name on a statement to an account — that is the whole job,
   * and sending an operator to another screen for the phone number is how
   * claims get approved without being checked.
   */
  async manualClaims(limit = 50): Promise<ManualClaim[]> {
    const payments = await this.prisma.payment.findMany({
      where: { method: 'BANK' },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      take: limit,
      select: {
        id: true,
        userId: true,
        status: true,
        amountEtb: true,
        txRef: true,
        note: true,
        createdAt: true,
        settledAt: true,
      },
    });

    const users = await this.prisma.user.findMany({
      where: { id: { in: payments.map((p) => p.userId) } },
      select: {
        id: true,
        telegramUsername: true,
        displayName: true,
        phone: true,
        createdAt: true,
      },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    // How many payments each claimant has settled before. An operator deciding
    // on a reference they cannot find in the statement wants to know whether
    // this is somebody's first claim or their fourth.
    const priors = await this.prisma.payment.groupBy({
      by: ['userId', 'status'],
      where: { userId: { in: payments.map((p) => p.userId) } },
      _count: { _all: true },
    });

    return payments.map((p) => {
      const user = byId.get(p.userId);
      const mine = priors.filter((row) => row.userId === p.userId);
      return {
        paymentId: p.id,
        userId: p.userId,
        status: p.status,
        amountEtb: p.amountEtb,
        txRef: p.txRef,
        note: p.note,
        claimedAt: p.createdAt.toISOString(),
        settledAt: p.settledAt?.toISOString() ?? null,
        // The Telegram handle, falling back to the display name — never a
        // legal name. DESIGN.md forbids one on any surface a person other than
        // the student reads, and an operator settling money does not need one
        // to match a reference. The fallback matters: an account created any
        // way other than a Telegram sign-in has no handle, and a dash in the
        // Student column makes the row unmatchable.
        student: user?.telegramUsername ?? user?.displayName ?? null,
        phone: user?.phone ?? null,
        joinedAt: user?.createdAt.toISOString() ?? null,
        priorPayments: mine.reduce((sum, row) => sum + row._count._all, 0) - 1,
        priorVerified: mine
          .filter((row) => row.status === 'CONFIRMED')
          .reduce((sum, row) => sum + row._count._all, 0),
      };
    });
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
    code: PlanCode,
    txRef: string,
  ): Promise<{ paymentId: string; subscriptionId: string; status: 'PENDING' }> {
    // Every purchase path checks. See `assertPlanAllowed`.
    await this.assertPlanAllowed(userId, code);

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
