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
    await prisma.subscription.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.session.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.user.deleteMany({ where: { telegramId: String(TG) } });
    await prisma.field.deleteMany({ where: { slug: { contains: SFX } } });
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

  /**
   * T-111a: `practice/` and `exams/` ask through `SUBSCRIPTION_ACCESS`, and the
   * token now resolves to the real implementation rather than `NoSubscriptionsYet`.
   */
  it('binds the real implementation to the seam (T-111a)', () => {
    expect(access).toBeInstanceOf(SubscriptionsService);
    expect(access.constructor.name).not.toBe('NoSubscriptionsYet');
  });
});
