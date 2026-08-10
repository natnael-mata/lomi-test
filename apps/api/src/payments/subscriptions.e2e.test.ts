/**
 * Integration test — plans, subscriptions and what they grant
 * (T-140, T-140a, T-141, T-141a, T-141b, T-111a).
 *
 * The arithmetic is proved in `plan.test.ts` without a database. What is checked
 * here is what only a database can show: that the launch plans are really seeded
 * by the migration, that activation is idempotent under a retrying payment
 * provider, and that a subscription unlocks **every** field rather than the one
 * it was bought against.
 *
 * Needs Postgres (`npm run db:dev`). CI provides it as a service container.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { SUBSCRIPTION_ACCESS, type SubscriptionAccess } from '../practice/subscription-access';
import { SubscriptionsService } from './subscriptions.service';

const SFX = 'e2e-subs';
const TG = 566000010;

describe('plans and paid access (Phase 8)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let subscriptions: SubscriptionsService;
  let access: SubscriptionAccess;
  let userId = '';
  let fieldA = '';
  let fieldB = '';

  const wipe = async (): Promise<void> => {
    const users = await prisma.user.findMany({
      where: { telegramId: String(TG) },
      select: { id: true },
    });
    // Payments first: the FK is ON DELETE RESTRICT, deliberately, so the record
    // of a payment outlives any attempt to tidy away the subscription it settled.
    await clearPaymentAudit(users.map((u) => u.id));
    await prisma.payment.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.subscription.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.session.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.user.deleteMany({ where: { telegramId: String(TG) } });
    await prisma.field.deleteMany({ where: { slug: { contains: SFX } } });
  };

  /**
   * Removes the audit rows this suite's settlements wrote (T-152).
   *
   * Scoped by the payment ids it is about to delete, not by actor id: `staff-1`
   * is a name other suites use too, and a cleanup that matches on it would tidy
   * away another test's evidence. `public.audit_log` is never DELETEd wholesale.
   */
  const clearPaymentAudit = async (userIds: string[]): Promise<void> => {
    const payments = await prisma.payment.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    if (payments.length === 0) return;
    await prisma.auditLog.deleteMany({
      where: { entity: 'payment', entityId: { in: payments.map((p) => p.id) } },
    });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    subscriptions = app.get(SubscriptionsService);
    access = app.get<SubscriptionAccess>(SUBSCRIPTION_ACCESS);
    await wipe();

    fieldA = (
      await prisma.field.create({
        data: { name: `A ${SFX}`, slug: `field-a-${SFX}`, isPublished: true },
      })
    ).id;
    fieldB = (
      await prisma.field.create({
        data: { name: `B ${SFX}`, slug: `field-b-${SFX}`, isPublished: true },
      })
    ).id;
  });

  beforeEach(async () => {
    // Filtered by id, not through a relation: `Subscription.userId` is a plain
    // scalar with its foreign key written by hand in SQL, the same pattern the
    // exam tables use, so Prisma has no `user` to traverse.
    const existing = await prisma.user.findMany({
      where: { telegramId: String(TG) },
      select: { id: true },
    });
    await clearPaymentAudit(existing.map((u) => u.id));
    await prisma.payment.deleteMany({ where: { userId: { in: existing.map((u) => u.id) } } });
    await prisma.subscription.deleteMany({
      where: { userId: { in: existing.map((u) => u.id) } },
    });
    await prisma.user.deleteMany({ where: { telegramId: String(TG) } });
    userId = (
      await prisma.user.create({
        data: { telegramId: String(TG), displayName: 'PaidStudent0001', fieldId: fieldA },
      })
    ).id;
  });

  afterAll(async () => {
    await wipe();
    await app.close();
  });

  describe('the launch plans (T-140)', () => {
    /** T-140's stated test. */
    it('seeds exactly two active plans at the agreed prices', async () => {
      const plans = await prisma.plan.findMany({
        where: { isActive: true },
        orderBy: { months: 'asc' },
        select: { code: true, months: true, priceEtb: true },
      });
      expect(plans).toEqual([
        { code: 'SIX_MONTH', months: 6, priceEtb: 500 },
        { code: 'TWELVE_MONTH', months: 12, priceEtb: 800 },
      ]);
    });

    /**
     * Seeded by the migration, not by a seed script. A checkout with no plans is
     * a product that cannot take money, and a seed is a thing somebody forgets
     * to run on the environment that matters.
     */
    it('has them wherever migrations have run', async () => {
      expect(await prisma.plan.count()).toBeGreaterThanOrEqual(2);
    });

    /** T-141a's stated test, from real rows. */
    it('offers both with the per-month maths done', async () => {
      const offers = await subscriptions.offers();
      expect(offers.map((o) => o.code)).toEqual(['TWELVE_MONTH', 'SIX_MONTH']);
      expect(offers[0]?.perMonthEtb).toBe(67);
      expect(offers[1]?.perMonthEtb).toBe(83);
      expect(offers[0]?.bestValue).toBe(true);
    });
  });

  describe('buying and activating (T-140a)', () => {
    it('starts pending, granting nothing', async () => {
      const { id } = await subscriptions.begin(userId, 'SIX_MONTH');
      const row = await prisma.subscription.findUniqueOrThrow({ where: { id } });
      expect(row.status).toBe('PENDING');
      expect(row.activatedAt).toBeNull();
      expect(row.expiresAt).toBeNull();
      expect(await access.hasActiveSubscription(userId, fieldA)).toBe(false);
    });

    /**
     * The price is copied at purchase. `Plan.priceEtb` is the price today;
     * `paidEtb` is the price somebody was quoted, and a repricing between
     * checkout and settlement must not change what was agreed (T-141).
     */
    it('records what was actually charged, not what the plan costs later', async () => {
      const { id } = await subscriptions.begin(userId, 'SIX_MONTH');
      await prisma.plan.update({ where: { code: 'SIX_MONTH' }, data: { priceEtb: 900 } });
      try {
        const row = await prisma.subscription.findUniqueOrThrow({ where: { id } });
        expect(row.paidEtb).toBe(500);
      } finally {
        await prisma.plan.update({ where: { code: 'SIX_MONTH' }, data: { priceEtb: 500 } });
      }
    });

    /** T-140a's stated test, end to end. */
    it('expires six months after activation', async () => {
      const { id } = await subscriptions.begin(userId, 'SIX_MONTH');
      const { expiresAt } = await subscriptions.activate(id, new Date('2026-01-15T00:00:00.000Z'));
      expect(expiresAt?.toISOString()).toBe('2026-07-15T00:00:00.000Z');
    });

    it('grants access once activated', async () => {
      const { id } = await subscriptions.begin(userId, 'TWELVE_MONTH');
      await subscriptions.activate(id);
      expect(await access.hasActiveSubscription(userId, fieldA)).toBe(true);
    });

    /**
     * T-144, early. A payment provider retries, and a webhook arriving twice
     * must not buy a second six months.
     */
    it('is idempotent — a replay does not extend access twice', async () => {
      const { id } = await subscriptions.begin(userId, 'SIX_MONTH');
      const first = await subscriptions.activate(id, new Date('2026-01-15T00:00:00.000Z'));
      const second = await subscriptions.activate(id, new Date('2026-02-20T00:00:00.000Z'));

      expect(first.activated).toBe(true);
      expect(second.activated).toBe(false);
      expect(second.expiresAt?.toISOString()).toBe(first.expiresAt?.toISOString());

      const row = await prisma.subscription.findUniqueOrThrow({ where: { id } });
      expect(row.expiresAt?.toISOString()).toBe('2026-07-15T00:00:00.000Z');
    });
  });

  describe('what a plan grants (T-141b)', () => {
    /**
     * T-141b's stated test, both halves. **A plan grants the whole product**,
     * recorded in PRODUCT.md: the price is a duration and nothing else, and
     * selling per field would charge a student twice for the same six months if
     * they changed programme.
     */
    it('unlocks the field it was bought against', async () => {
      const { id } = await subscriptions.begin(userId, 'SIX_MONTH');
      await subscriptions.activate(id);
      expect(await access.hasActiveSubscription(userId, fieldA)).toBe(true);
    });

    it('unlocks a field the student never chose', async () => {
      const { id } = await subscriptions.begin(userId, 'SIX_MONTH');
      await subscriptions.activate(id);
      expect(await access.hasActiveSubscription(userId, fieldB)).toBe(true);
    });

    it('is written down where a person would look for the rule', async () => {
      const { existsSync, readFileSync } = await import('node:fs');
      const { dirname, resolve } = await import('node:path');
      let dir = process.cwd();
      let product = '';
      for (let i = 0; i < 6 && !product; i++) {
        const candidate = resolve(dir, 'PRODUCT.md');
        if (existsSync(candidate)) product = readFileSync(candidate, 'utf8');
        dir = dirname(dir);
      }
      expect(product, 'PRODUCT.md not found').not.toBe('');
      expect(product).toContain('grants the whole product, not one field');
    });
  });

  describe('running out', () => {
    /**
     * The gate reads the timestamp, not the status. A subscription that ran out
     * an hour ago is still `ACTIVE` in the table until something sweeps it, and
     * a paywall that trusts a stale column lets people in for free.
     */
    it('stops granting access the moment it expires, sweep or no sweep', async () => {
      const { id } = await subscriptions.begin(userId, 'SIX_MONTH');
      await subscriptions.activate(id, new Date('2020-01-15T00:00:00.000Z'));

      const row = await prisma.subscription.findUniqueOrThrow({ where: { id } });
      expect(row.status).toBe('ACTIVE'); // Nothing has swept it yet.
      expect(await access.hasActiveSubscription(userId, fieldA)).toBe(false);
    });

    it('marks expired rows when swept, and says how many', async () => {
      const { id } = await subscriptions.begin(userId, 'SIX_MONTH');
      await subscriptions.activate(id, new Date('2020-01-15T00:00:00.000Z'));

      expect(await subscriptions.sweepExpired()).toBeGreaterThanOrEqual(1);
      const row = await prisma.subscription.findUniqueOrThrow({ where: { id } });
      expect(row.status).toBe('EXPIRED');
    });

    /**
     * "Never paid" and "paid and ran out" need different messages and different
     * offers, so they are different states rather than one falsy answer.
     */
    it('tells never-paid apart from expired', async () => {
      expect(await subscriptions.statusFor(userId)).toMatchObject({
        hasEverPaid: false,
        active: false,
      });

      const { id } = await subscriptions.begin(userId, 'SIX_MONTH');
      await subscriptions.activate(id, new Date('2020-01-15T00:00:00.000Z'));

      expect(await subscriptions.statusFor(userId)).toMatchObject({
        hasEverPaid: true,
        active: false,
        planCode: 'SIX_MONTH',
      });
    });
  });

  describe('manual bank transfers (T-145, T-146)', () => {
    /** T-145's stated test. */
    it('refuses a transaction reference that has already been submitted', async () => {
      await subscriptions.submitManualPayment(userId, 'SIX_MONTH', 'FT250809ABCD');
      await expect(
        subscriptions.submitManualPayment(userId, 'SIX_MONTH', 'FT250809ABCD'),
      ).rejects.toMatchObject({ status: 409 });
    });

    /**
     * A unique constraint, not a lookup. Two submissions a second apart would
     * both pass a read, and an operator confirming both would grant twelve
     * months for one transfer.
     */
    it('enforces it in the database, not only in the service', async () => {
      const { subscriptionId } = await subscriptions.submitManualPayment(
        userId,
        'SIX_MONTH',
        'FT-UNIQUE-1',
      );
      await expect(
        prisma.payment.create({
          data: {
            userId,
            subscriptionId,
            method: 'BANK',
            amountEtb: 500,
            txRef: 'FT-UNIQUE-1',
          },
        }),
      ).rejects.toThrow();
    });

    it('trims the reference and refuses an empty one', async () => {
      await expect(
        subscriptions.submitManualPayment(userId, 'SIX_MONTH', '   '),
      ).rejects.toMatchObject({ status: 422 });
    });

    /** T-146's stated test: a pending payment grants nothing. */
    it('grants no access while the payment is pending', async () => {
      await subscriptions.submitManualPayment(userId, 'TWELVE_MONTH', 'FT-PENDING-1');
      expect(await access.hasActiveSubscription(userId, fieldA)).toBe(false);

      const status = await subscriptions.statusFor(userId);
      expect(status.active).toBe(false);
      expect(status.hasEverPaid).toBe(false);
    });

    it('grants access once an operator confirms it', async () => {
      const { paymentId } = await subscriptions.submitManualPayment(
        userId,
        'SIX_MONTH',
        'FT-CONFIRM-1',
      );
      const result = await subscriptions.confirmManualPayment(
        paymentId,
        'staff-1',
        'Seen on statement',
      );

      expect(result.activated).toBe(true);
      expect(await access.hasActiveSubscription(userId, fieldA)).toBe(true);
    });

    // The payment row is the record of who granted access, which is what
    // somebody will be asked about.
    it('records who settled it and when', async () => {
      const { paymentId } = await subscriptions.submitManualPayment(
        userId,
        'SIX_MONTH',
        'FT-AUDIT-1',
      );
      await subscriptions.confirmManualPayment(paymentId, 'staff-42');

      const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
      expect(payment.status).toBe('CONFIRMED');
      expect(payment.settledBy).toBe('staff-42');
      expect(payment.settledAt).not.toBeNull();
    });

    it('refuses to settle the same payment twice', async () => {
      const { paymentId } = await subscriptions.submitManualPayment(
        userId,
        'SIX_MONTH',
        'FT-TWICE-1',
      );
      await subscriptions.confirmManualPayment(paymentId, 'staff-1');
      await expect(subscriptions.confirmManualPayment(paymentId, 'staff-1')).rejects.toMatchObject({
        status: 409,
      });
    });
  });

  describe('settling by hand, and answering for it (T-152)', () => {
    const settle = async (
      reference: string,
    ): Promise<{ paymentId: string; subscriptionId: string }> => {
      const { paymentId, subscriptionId } = await subscriptions.submitManualPayment(
        userId,
        'SIX_MONTH',
        reference,
      );
      return { paymentId, subscriptionId };
    };

    /** T-152's stated test: the activation writes a row naming the operator. */
    it('writes an audit row naming who granted the access', async () => {
      const { paymentId } = await settle('FT-AUDIT-CONFIRM');
      await subscriptions.confirmManualPayment(paymentId, 'staff-7', 'Seen on the statement');

      const entry = await prisma.auditLog.findFirstOrThrow({
        where: { entity: 'payment', entityId: paymentId },
      });
      expect(entry.action).toBe('PAYMENT_CONFIRMED');
      expect(entry.actorId).toBe('staff-7');
      // The transaction reference, because that is what a dispute is about —
      // and it stays legible after the payment row is gone.
      expect(entry.reference).toBe('FT-AUDIT-CONFIRM');
      expect(entry.detail).toContain('Seen on the statement');
    });

    /**
     * The refusal is the outcome a student is more likely to dispute. "We looked
     * and the money was not there" is worthless as a defence if nobody wrote
     * down who looked.
     */
    it('writes an audit row for a refusal too', async () => {
      const { paymentId } = await settle('FT-AUDIT-REJECT');
      await subscriptions.rejectManualPayment(paymentId, 'staff-8', 'Nothing on the statement');

      const entry = await prisma.auditLog.findFirstOrThrow({
        where: { entity: 'payment', entityId: paymentId },
      });
      expect(entry.action).toBe('PAYMENT_REJECTED');
      expect(entry.actorId).toBe('staff-8');

      const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
      expect(payment.status).toBe('REJECTED');
      expect(payment.note).toBe('Nothing on the statement');
    });

    it('grants nothing on a refusal', async () => {
      const { paymentId } = await settle('FT-REJECT-NOACCESS');
      await subscriptions.rejectManualPayment(paymentId, 'staff-8', 'Not found');
      expect(await access.hasActiveSubscription(userId, fieldA)).toBe(false);
    });

    // A reason is required where the confirming note is optional: "rejected" with
    // nothing after it is not something a support conversation can start from.
    it('will not refuse a payment without saying why', async () => {
      const { paymentId } = await settle('FT-REJECT-NOREASON');
      await expect(
        subscriptions.rejectManualPayment(paymentId, 'staff-8', '   '),
      ).rejects.toMatchObject({ status: 422 });

      const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
      expect(payment.status).toBe('PENDING');
      expect(await prisma.auditLog.count({ where: { entityId: paymentId } })).toBe(0);
    });

    it('refuses to refuse a payment that is already settled', async () => {
      const { paymentId } = await settle('FT-REJECT-TWICE');
      await subscriptions.confirmManualPayment(paymentId, 'staff-1');
      await expect(
        subscriptions.rejectManualPayment(paymentId, 'staff-2', 'Changed my mind'),
      ).rejects.toMatchObject({ status: 409 });
    });

    /**
     * The settlement and its record are one transaction. A record that survives
     * a rolled-back confirmation is a lie about what happened, and one that
     * vanishes while the confirmation stands is worse.
     */
    it('writes exactly one audit row per settlement', async () => {
      const { paymentId } = await settle('FT-AUDIT-ONCE');
      await subscriptions.confirmManualPayment(paymentId, 'staff-1');
      await subscriptions.confirmManualPayment(paymentId, 'staff-1').catch(() => undefined);

      expect(await prisma.auditLog.count({ where: { entityId: paymentId } })).toBe(1);
    });
  });

  describe('access running out (T-153)', () => {
    const JAN = new Date('2026-01-15T00:00:00.000Z');
    const AUGUST = new Date('2026-08-15T00:00:00.000Z');

    const expired = async (): Promise<string> => {
      const { id } = await subscriptions.begin(userId, 'SIX_MONTH');
      // Six months from January runs out on 15 July.
      await subscriptions.activate(id, JAN);
      return id;
    };

    /**
     * T-153's stated test, and the one that matters most: access ends at the
     * timestamp **whether or not anything has swept**.
     *
     * The paywall reads `expiresAt`, never `status`. A product whose paywall
     * depends on a sweeper having run hands out free access every time a
     * scheduler dies, and schedulers die quietly.
     */
    it('ends access at the expiry even if nothing has swept', async () => {
      await expired();
      const stale = await prisma.subscription.findFirstOrThrow({ where: { userId } });
      expect(stale.status).toBe('ACTIVE'); // Nothing has tidied it yet.

      // Fresh service, no sweep run, clock past the expiry.
      expect(await access.hasActiveSubscription(userId, fieldA)).toBe(false);
    });

    /**
     * Asserted on **this suite's own row**, not on the sweep's global count.
     *
     * `sweepExpired` is a whole-table operation, so `toBe(1)` was a claim about
     * every other suite's leftovers as well as ours — and it failed exactly once,
     * on a database that had rows in it from an earlier run. A count of "at
     * least ours" is the strongest thing that is actually true.
     */
    it('downgrades the status when the sweep runs', async () => {
      await expired();
      const count = await subscriptions.sweepExpired(AUGUST);
      expect(count).toBeGreaterThanOrEqual(1);

      const swept = await prisma.subscription.findFirstOrThrow({ where: { userId } });
      expect(swept.status).toBe('EXPIRED');
    });

    /** Lazily, at the moment somebody would have read the stale value. */
    it('tidies this student’s own row when their status is read', async () => {
      await expired();
      const status = await subscriptions.statusFor(userId, AUGUST);
      expect(status.active).toBe(false);

      const row = await prisma.subscription.findFirstOrThrow({ where: { userId } });
      expect(row.status).toBe('EXPIRED');
    });

    it('leaves a live subscription alone', async () => {
      const { id } = await subscriptions.begin(userId, 'TWELVE_MONTH');
      await subscriptions.activate(id, AUGUST);

      await subscriptions.sweepExpired(AUGUST);
      // The row, not the count: whether the sweep found somebody else's stale
      // subscription is not this test's business.
      const row = await prisma.subscription.findFirstOrThrow({ where: { id } });
      expect(row.status).toBe('ACTIVE');
    });

    // The second call returning zero IS a fair global claim: whatever the first
    // pass found, there is nothing left for the second.
    it('is safe to run twice', async () => {
      await expired();
      expect(await subscriptions.sweepExpired(AUGUST)).toBeGreaterThanOrEqual(1);
      expect(await subscriptions.sweepExpired(AUGUST)).toBe(0);
    });

    /**
     * T-153's other half: data retained. A student who renews in September
     * should find their March history intact, and a dispute about a payment is
     * not helped by the record of it having been tidied away.
     */
    it('keeps the payment, the dates and the plan', async () => {
      const { paymentId, subscriptionId } = await subscriptions.submitManualPayment(
        userId,
        'SIX_MONTH',
        'FT-EXPIRY-KEEP',
      );
      await subscriptions.confirmManualPayment(paymentId, 'staff-1', undefined, JAN);
      await subscriptions.sweepExpired(AUGUST);

      const subscription = await prisma.subscription.findUniqueOrThrow({
        where: { id: subscriptionId },
      });
      expect(subscription.status).toBe('EXPIRED');
      expect(subscription.activatedAt).not.toBeNull();
      expect(subscription.expiresAt).not.toBeNull();
      expect(subscription.paidEtb).toBeGreaterThan(0);

      const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
      expect(payment.status).toBe('CONFIRMED');
      expect(payment.txRef).toBe('FT-EXPIRY-KEEP');
    });

    /** Expired is not "never paid". The difference is what a renewal screen says. */
    it('still knows the student has paid before', async () => {
      await expired();
      const status = await subscriptions.statusFor(userId, AUGUST);
      expect(status.hasEverPaid).toBe(true);
      expect(status.active).toBe(false);
    });
  });

  describe('renewing early (T-146a)', () => {
    /**
     * T-146a's stated test, end to end. A student renewing thirty days early
     * must not lose those thirty days — the behaviour that teaches is to wait
     * until access has lapsed before paying.
     */
    it('adds the full plan length to the existing expiry', async () => {
      const first = await subscriptions.begin(userId, 'SIX_MONTH');
      await subscriptions.activate(first.id, new Date('2026-01-15T00:00:00.000Z'));

      const renewal = await subscriptions.begin(userId, 'SIX_MONTH');
      const result = await subscriptions.activate(renewal.id, new Date('2026-06-15T00:00:00.000Z'));

      // The first ends 2026-07-15; the renewal must run to 2027-01-15, not
      // 2026-12-15 which is what counting from today would give.
      expect(result.expiresAt?.toISOString()).toBe('2027-01-15T00:00:00.000Z');
    });

    it('starts from today when the previous access has lapsed', async () => {
      const first = await subscriptions.begin(userId, 'SIX_MONTH');
      await subscriptions.activate(first.id, new Date('2020-01-15T00:00:00.000Z'));

      const renewal = await subscriptions.begin(userId, 'SIX_MONTH');
      const result = await subscriptions.activate(renewal.id, new Date('2026-06-15T00:00:00.000Z'));
      expect(result.expiresAt?.toISOString()).toBe('2026-12-15T00:00:00.000Z');
    });
  });

  /**
   * T-111a: `practice/` and `exams/` ask through `SUBSCRIPTION_ACCESS`, and the
   * token now resolves to the real implementation rather than `NoSubscriptionsYet`.
   */
  it('binds the real implementation to the seam (T-111a)', () => {
    expect(access).toBeInstanceOf(SubscriptionsService);
    expect(access.constructor.name).not.toBe('NoSubscriptionsYet');
  });
});
