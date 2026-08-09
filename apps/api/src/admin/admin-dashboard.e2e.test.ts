/**
 * Integration test — the admin dashboard (T-160, T-161, T-163).
 *
 * **Asserted against direct queries and against deltas, never against literals.**
 * These figures are counts over the whole table, so a test that expected
 * "signups === 4" would be a test about which other suites had run first. Two
 * disciplines instead: every figure is checked against the SQL an operator would
 * run to challenge it, and this suite's own contribution is measured as the
 * change it made.
 *
 * That is also what T-160's stated test asks for — "each figure matches a direct
 * SQL count" — and it is the only version of the assertion worth having. A
 * dashboard is a claim that somebody can check; a test comparing it to a number
 * only this code produces would prove nothing.
 *
 * Needs Postgres (`npm run db:dev`).
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { cleanupStaff, signInAsStaff, type StaffSession } from '../auth/staff-testkit.test-helper';
import { AdminDashboardService, type DashboardOverview } from './admin-dashboard.service';
import { SubscriptionsService } from '../payments/subscriptions.service';

const SFX = 'e2e-dash';
const TG_ADMIN = 566000051;
/** One telegram id per student this suite invents. */
const TG_PAYING = 566000052;
const TG_LAPSED = 566000053;
const TG_TRIALLING = 566000054;
const TG_DORMANT = 566000055;
const TG_ALL = [TG_ADMIN, TG_PAYING, TG_LAPSED, TG_TRIALLING, TG_DORMANT];

describe('the admin dashboard (T-160, T-161, T-163)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let dashboard: AdminDashboardService;
  let subscriptions: SubscriptionsService;
  let admin: StaffSession;

  let fieldId = '';
  let questionId = '';
  const users: Record<string, string> = {};
  let baseline: DashboardOverview;
  let revenueBaseline = {
    totalEtb: 0,
    totalCount: 0,
    rows: [] as { method: string; etb: number }[],
  };

  const wipe = async (): Promise<void> => {
    const found = await prisma.user.findMany({
      where: { telegramId: { in: TG_ALL.map(String) } },
      select: { id: true },
    });
    const ids = found.map((u) => u.id);

    const payments = await prisma.payment.findMany({
      where: { userId: { in: ids } },
      select: { id: true },
    });
    // Never a wholesale DELETE from the audit log — only the rows this suite's
    // own settlements wrote.
    await prisma.auditLog.deleteMany({
      where: { entity: 'payment', entityId: { in: payments.map((p) => p.id) } },
    });
    await prisma.payment.deleteMany({ where: { userId: { in: ids } } });
    await prisma.subscription.deleteMany({ where: { userId: { in: ids } } });
    await prisma.attempt.deleteMany({ where: { userId: { in: ids } } });
    await cleanupStaff(prisma, TG_ALL, SFX);
    await prisma.question.deleteMany({ where: { stableId: { startsWith: `DASH-${SFX}` } } });
    await prisma.topic.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.course.deleteMany({ where: { slug: { contains: SFX } } });
    await prisma.field.deleteMany({ where: { slug: { contains: SFX } } });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    dashboard = app.get(AdminDashboardService);
    subscriptions = app.get(SubscriptionsService);

    await wipe();
    admin = await signInAsStaff(app, prisma, TG_ADMIN, 'ADMIN', SFX);

    // The baseline is taken AFTER the admin exists and BEFORE this suite's
    // students do, so every delta below is exactly what this suite created.
    baseline = await dashboard.overview();

    const field = await prisma.field.create({
      data: { name: `F ${SFX}`, slug: `field-${SFX}`, isPublished: true },
    });
    fieldId = field.id;
    const course = await prisma.course.create({
      data: { fieldId, name: `C ${SFX}`, slug: `course-${SFX}` },
    });
    const topic = await prisma.topic.create({
      data: { courseId: course.id, name: `T ${SFX}`, slug: `topic-${SFX}`, weightPct: 100 },
    });
    questionId = (
      await prisma.question.create({
        data: {
          stableId: `DASH-${SFX}-1`,
          topicId: topic.id,
          fieldId,
          qType: 'CONCEPT',
          stem: 'A question',
          status: 'PUBLISHED',
          timeLimitSec: 60,
        },
      })
    ).id;

    for (const [name, telegramId] of [
      ['paying', TG_PAYING],
      ['lapsed', TG_LAPSED],
      ['trialling', TG_TRIALLING],
      ['dormant', TG_DORMANT],
    ] as const) {
      users[name] = (
        await prisma.user.create({
          data: {
            telegramId: String(telegramId),
            displayName: `Dash${name.slice(0, 4)}0001`,
            fieldId,
          },
        })
      ).id;
    }

    // Paying: activated today, so it is live.
    const live = await subscriptions.begin(users['paying']!, 'SIX_MONTH');
    await subscriptions.activate(live.id);

    // Lapsed: activated in 2020, long run out.
    const old = await subscriptions.begin(users['lapsed']!, 'SIX_MONTH');
    await subscriptions.activate(old.id, new Date('2020-01-15T00:00:00.000Z'));

    // Trialling: has answered, has never paid.
    await prisma.attempt.create({
      data: {
        userId: users['trialling']!,
        questionId,
        fieldId,
        topicId: topic.id,
        chosenLabel: 'A',
        isCorrect: false,
        timeTakenSec: 30,
      },
    });

    // Dormant: exists and has done nothing. No rows to create.

    /*
     * The confirmed payments are created HERE, not inside the revenue tests
     * that measure them.
     *
     * The search tests below look one of these references up. Creating them in a
     * sibling `describe` would make this suite order-dependent — which has bitten
     * this project twice, and the failure looks nothing like its cause.
     */
    revenueBaseline = await dashboard.revenue();
    await takeMoney('TELEBIRR', 500, `DASH-${SFX}-TB`);
    await takeMoney('CBEBIRR', 500, `DASH-${SFX}-CBE`);
    await takeMoney('CHAPA', 800, `DASH-${SFX}-CH`);
    await takeMoney('BANK', 800, `DASH-${SFX}-BK`);
  });

  /** A settled payment, with the actor the database insists on. */
  const takeMoney = async (
    method: 'TELEBIRR' | 'CBEBIRR' | 'CHAPA' | 'BANK',
    amountEtb: number,
    reference: string,
  ): Promise<string> => {
    const subscription = await subscriptions.begin(users['paying']!, 'SIX_MONTH');
    const payment = await prisma.payment.create({
      data: {
        userId: users['paying']!,
        subscriptionId: subscription.id,
        method,
        status: 'CONFIRMED',
        amountEtb,
        txRef: reference,
        // `Payment_settled_has_actor` is a hand-written CHECK: a settled payment
        // that names nobody is a grant with no one answerable for it, and the
        // database refuses it rather than trusting every write path.
        settledBy: 'e2e-fixture',
        settledAt: new Date(),
      },
    });
    return payment.id;
  };

  afterAll(async () => {
    await wipe();
    await app.close();
  });

  describe('the overview (T-160)', () => {
    /**
     * T-160's stated test. Every figure re-derived from the tables rather than
     * compared to a remembered number — this is the query an operator runs when
     * they think the screen is lying.
     */
    it('matches a direct count for every figure', async () => {
      const now = new Date();
      const overview = await dashboard.overview(now);

      expect(overview.signups).toBe(await prisma.user.count());

      const livePayers = await prisma.subscription.findMany({
        where: { status: 'ACTIVE', expiresAt: { gt: now } },
        select: { userId: true },
        distinct: ['userId'],
      });
      expect(overview.paying).toBe(livePayers.length);

      expect(overview.awaitingSettlement).toBe(
        await prisma.payment.count({ where: { status: 'PENDING' } }),
      );
    });

    /**
     * The constraint that makes the screen renderable at all: DESIGN.md's
     * `<TotalBar>` throws in development if its rows do not sum to its total.
     * Figures that merely coexist could not be drawn with it.
     */
    it('partitions the signups exactly', async () => {
      const o = await dashboard.overview();
      expect(o.paying + o.lapsed + o.trialling + o.dormant).toBe(o.signups);
    });

    it('puts each of this suite’s students in exactly one bucket', async () => {
      const now = await dashboard.overview();
      expect(now.signups - baseline.signups).toBe(4);
      expect(now.paying - baseline.paying).toBe(1);
      expect(now.lapsed - baseline.lapsed).toBe(1);
      expect(now.trialling - baseline.trialling).toBe(1);
      expect(now.dormant - baseline.dormant).toBe(1);
    });

    /**
     * The same authority the paywall uses (T-153). A dashboard reading `status`
     * would report a subscription that ran out in March as live, and report
     * access this product does not actually grant.
     */
    it('counts live access by the timestamp, not by the status column', async () => {
      const stale = await prisma.subscription.findFirstOrThrow({
        where: { userId: users['lapsed']! },
      });
      // It is genuinely still ACTIVE in the column — nothing has swept it.
      expect(stale.status).toBe('ACTIVE');
      const o = await dashboard.overview();
      expect(o.paying - baseline.paying).toBe(1); // Not 2.
    });

    /** A queue length, not a segment — it counts payments, not students. */
    it('counts unsettled claims outside the partition', async () => {
      const before = await dashboard.overview();
      const { paymentId } = await subscriptions.submitManualPayment(
        users['dormant']!,
        'SIX_MONTH',
        `DASH-${SFX}-PENDING`,
      );
      const after = await dashboard.overview();

      expect(after.awaitingSettlement - before.awaitingSettlement).toBe(1);
      // The student did not move bucket: a claim is not a payment (T-146).
      expect(after.paying).toBe(before.paying);
      expect(after.dormant).toBe(before.dormant);

      await prisma.payment.delete({ where: { id: paymentId } });
      await prisma.subscription.deleteMany({ where: { userId: users['dormant']! } });
    });

    it('counts deactivated accounts, because they are still signups', async () => {
      const before = await dashboard.overview();
      await prisma.user.update({
        where: { id: users['dormant']! },
        data: { deactivatedAt: new Date() },
      });
      try {
        const after = await dashboard.overview();
        // Dropping them would make the total disagree with `count(*) FROM
        // "User"`, which is the first thing anybody checking this will run.
        expect(after.signups).toBe(before.signups);
        expect(after.paying + after.lapsed + after.trialling + after.dormant).toBe(after.signups);
      } finally {
        await prisma.user.update({
          where: { id: users['dormant']! },
          data: { deactivatedAt: null },
        });
      }
    });
  });

  describe('the revenue split (T-161)', () => {
    /** T-161's stated test: the parts equal the whole. */
    it('foots to its total', async () => {
      const split = await dashboard.revenue();
      expect(split.rows.reduce((sum, row) => sum + row.etb, 0)).toBe(split.totalEtb);
      expect(split.rows.reduce((sum, row) => sum + row.count, 0)).toBe(split.totalCount);
    });

    /**
     * Four rows, not the two the task named. It was written when Chapa meant one
     * hosted redirect; folding telebirr and CBE Birr back into "Chapa" would
     * hide the split an operator reconciles against.
     */
    it('splits by how the money actually arrived', async () => {
      const after = await dashboard.revenue();

      const delta = (method: string): number =>
        (after.rows.find((r) => r.method === method)?.etb ?? 0) -
        (revenueBaseline.rows.find((r) => r.method === method)?.etb ?? 0);

      expect(delta('TELEBIRR')).toBe(500);
      expect(delta('CBEBIRR')).toBe(500);
      expect(delta('CHAPA')).toBe(800);
      expect(delta('BANK')).toBe(800);
      expect(after.totalEtb - revenueBaseline.totalEtb).toBe(2600);
      // And it still foots after the fact.
      expect(after.rows.reduce((sum, row) => sum + row.etb, 0)).toBe(after.totalEtb);
    });

    it('names every method even when nothing came in that way', async () => {
      const split = await dashboard.revenue();
      // A missing row would read as "we do not accept CBE Birr" rather than
      // "nobody used it today", and an operator would go looking for a bug.
      expect(split.rows.map((r) => r.method).sort()).toEqual([
        'BANK',
        'CBEBIRR',
        'CHAPA',
        'TELEBIRR',
      ]);
    });

    /**
     * A pending claim is not revenue — it may never arrive — and a rejected one
     * is money that definitely did not.
     */
    it('counts only money that actually arrived', async () => {
      const before = await dashboard.revenue();
      const subscription = await subscriptions.begin(users['paying']!, 'SIX_MONTH');
      const pending = await prisma.payment.create({
        data: {
          userId: users['paying']!,
          subscriptionId: subscription.id,
          method: 'BANK',
          status: 'PENDING',
          amountEtb: 9999,
          txRef: `DASH-${SFX}-NOTYET`,
        },
      });
      const rejected = await prisma.payment.create({
        data: {
          userId: users['paying']!,
          subscriptionId: subscription.id,
          method: 'BANK',
          status: 'REJECTED',
          amountEtb: 9999,
          txRef: `DASH-${SFX}-NEVER`,
          settledBy: 'e2e-fixture',
          settledAt: new Date(),
        },
      });

      try {
        expect((await dashboard.revenue()).totalEtb).toBe(before.totalEtb);
      } finally {
        await prisma.payment.deleteMany({ where: { id: { in: [pending.id, rejected.id] } } });
        await prisma.subscription.delete({ where: { id: subscription.id } });
      }
    });
  });

  describe('finding a student (T-163)', () => {
    /** T-163's stated test: a known reference returns exactly that user. */
    it('finds the payer from a transaction reference', async () => {
      const hits = await dashboard.search(`DASH-${SFX}-TB`);
      expect(hits).toHaveLength(1);
      expect(hits[0]?.userId).toBe(users['paying']);
      expect(hits[0]?.matchedOn).toBe('txRef');
      expect(hits[0]?.txRef).toBe(`DASH-${SFX}-TB`);
    });

    /**
     * Exact, where the other two are partial. A reference is quoted off a
     * receipt in full or not at all, and a prefix search over references would
     * hand somebody else's payments to a student who mistyped.
     */
    it('does not match a partial reference', async () => {
      expect(await dashboard.search(`DASH-${SFX}`)).toHaveLength(0);
    });

    it('finds a student by part of their display name', async () => {
      const hits = await dashboard.search('Dashpayi');
      expect(hits.map((h) => h.userId)).toContain(users['paying']);
      expect(hits[0]?.matchedOn).toBe('displayName');
    });

    it('is not case-sensitive about a name somebody read out', async () => {
      expect((await dashboard.search('DASHPAYI')).map((h) => h.userId)).toContain(users['paying']);
    });

    it('finds a student by phone', async () => {
      await prisma.user.update({
        where: { id: users['trialling']! },
        data: { phone: '+251911000051' },
      });
      try {
        const hits = await dashboard.search('911000051');
        expect(hits.map((h) => h.userId)).toContain(users['trialling']);
        expect(hits.find((h) => h.userId === users['trialling'])?.matchedOn).toBe('phone');
      } finally {
        await prisma.user.update({ where: { id: users['trialling']! }, data: { phone: null } });
      }
    });

    /**
     * A two-character query would match most of the table. A support screen that
     * dumps every student on a stray keystroke is a privacy problem wearing a
     * search box.
     */
    it('returns nothing for a query too short to mean anything', async () => {
      for (const query of ['', ' ', 'a', 'ab']) {
        expect(await dashboard.search(query), query).toEqual([]);
      }
    });

    it('says whether an account is deactivated, so support does not chase a ghost', async () => {
      await prisma.user.update({
        where: { id: users['paying']! },
        data: { deactivatedAt: new Date() },
      });
      try {
        const hits = await dashboard.search(`DASH-${SFX}-TB`);
        expect(hits[0]?.deactivated).toBe(true);
      } finally {
        await prisma.user.update({
          where: { id: users['paying']! },
          data: { deactivatedAt: null },
        });
      }
    });
  });

  describe('who may look', () => {
    it('serves the figures to an admin', async () => {
      await request(app.getHttpServer())
        .get('/admin/analytics/overview')
        .set(admin.auth)
        .expect(200);
      await request(app.getHttpServer())
        .get('/admin/analytics/revenue')
        .set(admin.auth)
        .expect(200);
    });

    /**
     * Aggregates over every student's payments. The route sweep (T-168) proves
     * the guard is on every `/admin` route; this states the consequence for the
     * one that carries money.
     */
    it('turns away a caller with no session', async () => {
      await request(app.getHttpServer()).get('/admin/analytics/revenue').expect(401);
      await request(app.getHttpServer())
        .get(`/admin/analytics/users/search?q=DASH-${SFX}-TB`)
        .expect(401);
    });
  });
});
