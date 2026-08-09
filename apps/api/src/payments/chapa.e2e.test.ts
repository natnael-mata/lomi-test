/**
 * Integration test — the three Chapa-backed ways to pay (T-142, T-143, T-144).
 *
 * The protocol is proved in `chapa.test.ts` with no database and no socket. What
 * is checked here is what only a running application can show: that a charge
 * grants nothing until Chapa's verify endpoint agrees, that a webhook arriving
 * twice extends access once, and that a forged webhook is turned away at the
 * door.
 *
 * **The gateway is a stub, and it never opens a socket.** Testing against Chapa
 * would mean either real money or a sandbox whose availability decides whether
 * our test suite passes. The stub records what it was asked for, so the request
 * we build is still under test — it is the transport that is replaced, not the
 * decision-making.
 *
 * Needs Postgres (`npm run db:dev`).
 */
import { createHmac } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { CHAPA_GATEWAY, type ChapaGateway, type VerifiedCharge } from './chapa.client';
import { ChapaService } from './chapa.service';

const SFX = 'e2e-chapa';
const TG = 566000031;
const SECRET = 'CHASECK_TEST-e2e-not-a-real-key';

/** A gateway that answers from a script instead of from Chapa. */
class StubGateway implements ChapaGateway {
  charges: Array<{ channel: string; amountEtb: number; txRef: string; mobile: string }> = [];
  checkouts: Array<{ txRef: string; callbackUrl: string }> = [];
  verifyCalls: string[] = [];

  /** What `verify` should say, keyed by tx_ref. Absent means Chapa never saw it. */
  verdicts = new Map<string, VerifiedCharge>();
  failCharge = false;

  async directCharge(input: {
    channel: string;
    amountEtb: number;
    txRef: string;
    mobile: string;
  }): Promise<{ reference?: string }> {
    if (this.failCharge) throw new Error('Chapa said no');
    this.charges.push(input);
    return { reference: `CHAPA-${this.charges.length}` };
  }

  async hostedCheckout(input: {
    txRef: string;
    callbackUrl: string;
  }): Promise<{ checkoutUrl: string }> {
    this.checkouts.push(input);
    return { checkoutUrl: `https://checkout.chapa.co/checkout/payment/${input.txRef}` };
  }

  async verify(txRef: string): Promise<VerifiedCharge | null> {
    this.verifyCalls.push(txRef);
    return this.verdicts.get(txRef) ?? null;
  }

  paid(txRef: string, amount: number | string): void {
    this.verdicts.set(txRef, { txRef, status: 'success', amount, reference: 'CHAPA-REF-1' });
  }
}

describe('paying through Chapa (T-142, T-143, T-144)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let chapa: ChapaService;
  const gateway = new StubGateway();
  let userId = '';
  let fieldId = '';
  let priceEtb = 0;
  let previousSecret: string | undefined;

  const signed = (body: string): string => createHmac('sha256', SECRET).update(body).digest('hex');

  const wipe = async (): Promise<void> => {
    const users = await prisma.user.findMany({
      where: { telegramId: String(TG) },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    // Payments first: the FK is ON DELETE RESTRICT by design.
    await prisma.payment.deleteMany({ where: { userId: { in: ids } } });
    await prisma.subscription.deleteMany({ where: { userId: { in: ids } } });
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { telegramId: String(TG) } });
    await prisma.field.deleteMany({ where: { slug: { contains: SFX } } });
  };

  beforeAll(async () => {
    previousSecret = process.env.CHAPA_WEBHOOK_SECRET;
    process.env.CHAPA_WEBHOOK_SECRET = SECRET;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CHAPA_GATEWAY)
      .useValue(gateway)
      .compile();
    // `rawBody` is what makes the signature checkable at all — without it the
    // webhook sees a re-serialised body and every signature looks forged.
    app = moduleRef.createNestApplication({ rawBody: true });
    await app.init();

    prisma = app.get(PrismaService);
    chapa = app.get(ChapaService);
    await wipe();

    fieldId = (
      await prisma.field.create({
        data: { name: `F ${SFX}`, slug: `field-${SFX}`, isPublished: true },
      })
    ).id;
    priceEtb = (await prisma.plan.findUniqueOrThrow({ where: { code: 'SIX_MONTH' } })).priceEtb;
  });

  beforeEach(async () => {
    const existing = await prisma.user.findMany({
      where: { telegramId: String(TG) },
      select: { id: true },
    });
    const ids = existing.map((u) => u.id);
    await prisma.payment.deleteMany({ where: { userId: { in: ids } } });
    await prisma.subscription.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { telegramId: String(TG) } });
    userId = (
      await prisma.user.create({
        data: { telegramId: String(TG), displayName: 'ChapaStudent001', fieldId },
      })
    ).id;

    gateway.charges = [];
    gateway.checkouts = [];
    gateway.verifyCalls = [];
    gateway.verdicts.clear();
    gateway.failCharge = false;
  });

  afterAll(async () => {
    await wipe();
    await app.close();
    if (previousSecret === undefined) delete process.env.CHAPA_WEBHOOK_SECRET;
    else process.env.CHAPA_WEBHOOK_SECRET = previousSecret;
  });

  describe('the USSD push (options 1 and 2)', () => {
    it('sends the push and grants nothing yet', async () => {
      const started = await chapa.startDirectCharge(userId, 'SIX_MONTH', 'TELEBIRR', '0911223344');

      expect(gateway.charges).toHaveLength(1);
      expect(gateway.charges[0]).toMatchObject({
        channel: 'TELEBIRR',
        amountEtb: priceEtb,
        mobile: '0911223344',
      });

      // The whole point: a push has been sent, and nothing has been sold.
      const payment = await prisma.payment.findUniqueOrThrow({ where: { txRef: started.txRef } });
      expect(payment.status).toBe('PENDING');
      expect(payment.method).toBe('TELEBIRR');
      const subscription = await prisma.subscription.findUniqueOrThrow({
        where: { id: started.subscriptionId },
      });
      expect(subscription.status).toBe('PENDING');
      expect(subscription.expiresAt).toBeNull();
    });

    it('records CBE Birr as CBE Birr, not as Chapa', async () => {
      const started = await chapa.startDirectCharge(userId, 'SIX_MONTH', 'CBEBIRR', '0911223344');
      const payment = await prisma.payment.findUniqueOrThrow({ where: { txRef: started.txRef } });
      // What the student chose is what their receipt says and what a support
      // conversation will be about.
      expect(payment.method).toBe('CBEBIRR');
    });

    it('keeps the provider’s own reference for reconciliation', async () => {
      const started = await chapa.startDirectCharge(userId, 'SIX_MONTH', 'TELEBIRR', '0911223344');
      const payment = await prisma.payment.findUniqueOrThrow({ where: { txRef: started.txRef } });
      expect(payment.providerRef).toBe('CHAPA-1');
    });

    it('refuses a number that is not an Ethiopian mobile, before charging', async () => {
      await expect(
        chapa.startDirectCharge(userId, 'SIX_MONTH', 'TELEBIRR', '0111223344'),
      ).rejects.toThrow();
      expect(gateway.charges).toHaveLength(0);
      // No half-open purchase left behind.
      expect(await prisma.payment.count({ where: { userId } })).toBe(0);
    });

    /**
     * A row that stays PENDING forever is one an operator has to work out the
     * meaning of months later. Closing it with a reason is the difference.
     */
    it('closes the payment when Chapa refuses to send the push', async () => {
      gateway.failCharge = true;
      await expect(
        chapa.startDirectCharge(userId, 'SIX_MONTH', 'TELEBIRR', '0911223344'),
      ).rejects.toThrow();

      const payment = await prisma.payment.findFirstOrThrow({ where: { userId } });
      expect(payment.status).toBe('REJECTED');
      expect(payment.note).toContain('refused');
    });
  });

  describe('the hosted page (option 3)', () => {
    it('returns a checkout URL and tells Chapa where to call back', async () => {
      const started = await chapa.startHostedCheckout(userId, 'SIX_MONTH', {
        returnUrl: 'http://localhost:3100/checkout/return',
        callbackUrl: 'http://localhost:4000/payments/chapa/webhook',
      });

      expect(started.checkoutUrl).toContain('checkout.chapa.co');
      expect(gateway.checkouts[0]?.callbackUrl).toBe(
        'http://localhost:4000/payments/chapa/webhook',
      );
      const payment = await prisma.payment.findUniqueOrThrow({ where: { txRef: started.txRef } });
      expect(payment.method).toBe('CHAPA');
      expect(payment.status).toBe('PENDING');
    });
  });

  describe('settling', () => {
    const start = async (): Promise<string> => {
      const started = await chapa.startDirectCharge(userId, 'SIX_MONTH', 'TELEBIRR', '0911223344');
      return started.txRef;
    };

    it('grants access once Chapa confirms the money arrived', async () => {
      const txRef = await start();
      gateway.paid(txRef, priceEtb);

      const outcome = await chapa.settle(txRef);
      expect(outcome).toMatchObject({ settled: true });

      const subscription = await prisma.subscription.findFirstOrThrow({ where: { userId } });
      expect(subscription.status).toBe('ACTIVE');
      expect(subscription.expiresAt).not.toBeNull();
    });

    /**
     * The rule the whole module is built around: a claim is not a payment. The
     * webhook here is perfectly signed and says `charge.success`, and it still
     * grants nothing, because Chapa's verify endpoint has never heard of it.
     */
    it('grants nothing when verify does not confirm it, however good the claim looks', async () => {
      const txRef = await start();
      // Deliberately no `gateway.paid(...)`.
      const outcome = await chapa.settle(txRef);

      expect(outcome).toEqual({ settled: false, reason: 'NOT_SUCCESSFUL' });
      const subscription = await prisma.subscription.findFirstOrThrow({ where: { userId } });
      expect(subscription.status).toBe('PENDING');
    });

    it('asks Chapa directly even when a signed webhook already said so', async () => {
      const txRef = await start();
      gateway.paid(txRef, priceEtb);
      const body = JSON.stringify({ event: 'charge.success', tx_ref: txRef, status: 'success' });

      await request(app.getHttpServer())
        .post('/payments/chapa/webhook')
        .set('x-chapa-signature', signed(body))
        .set('content-type', 'application/json')
        .send(body)
        .expect(201);

      expect(gateway.verifyCalls).toContain(txRef);
    });

    /**
     * Providers retry. Two deliveries of the same event must not sell twelve
     * months for one payment (T-144).
     */
    it('extends access once however many times the webhook arrives', async () => {
      const txRef = await start();
      gateway.paid(txRef, priceEtb);
      const body = JSON.stringify({ event: 'charge.success', tx_ref: txRef, status: 'success' });

      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/payments/chapa/webhook')
          .set('x-chapa-signature', signed(body))
          .set('content-type', 'application/json')
          .send(body)
          .expect(201);
      }

      const subscription = await prisma.subscription.findFirstOrThrow({ where: { userId } });
      const first = subscription.expiresAt;
      await chapa.settle(txRef);
      const again = await prisma.subscription.findFirstOrThrow({ where: { userId } });
      expect(again.expiresAt?.toISOString()).toBe(first?.toISOString());
      expect(await prisma.subscription.count({ where: { userId, status: 'ACTIVE' } })).toBe(1);
    });

    /**
     * An underpayment is a conversation, not a grant and not a rejection.
     * Granting sells six months for four; rejecting leaves somebody out of
     * pocket with a closed case and nothing to point at.
     */
    it('leaves an underpayment pending, with the numbers written down', async () => {
      const txRef = await start();
      gateway.paid(txRef, priceEtb - 100);

      const outcome = await chapa.settle(txRef);
      expect(outcome).toEqual({ settled: false, reason: 'UNDERPAID' });

      const payment = await prisma.payment.findUniqueOrThrow({ where: { txRef } });
      expect(payment.status).toBe('PENDING');
      expect(payment.note).toContain(String(priceEtb));
    });

    it('accepts an amount Chapa reports as a decimal string', async () => {
      const txRef = await start();
      gateway.paid(txRef, `${priceEtb}.00`);
      expect(await chapa.settle(txRef)).toMatchObject({ settled: true });
    });

    it('ignores a reference it never minted', async () => {
      expect(await chapa.settle('CHAPA-someone-elses-ref')).toEqual({
        settled: false,
        reason: 'UNKNOWN_REF',
      });
      expect(gateway.verifyCalls).toHaveLength(0);
    });
  });

  describe('the webhook door (T-143)', () => {
    it('turns away a body with no signature', async () => {
      const body = JSON.stringify({
        event: 'charge.success',
        tx_ref: 'lomi-x-y',
        status: 'success',
      });
      await request(app.getHttpServer())
        .post('/payments/chapa/webhook')
        .set('content-type', 'application/json')
        .send(body)
        .expect(400);
    });

    /**
     * The attack this route exists to survive: a well-formed success event for a
     * real reference, signed with the wrong key.
     */
    it('turns away a forged success for a real reference', async () => {
      const started = await chapa.startDirectCharge(userId, 'SIX_MONTH', 'TELEBIRR', '0911223344');
      gateway.paid(started.txRef, priceEtb);
      const body = JSON.stringify({
        event: 'charge.success',
        tx_ref: started.txRef,
        status: 'success',
      });
      const forged = createHmac('sha256', 'wrong-key').update(body).digest('hex');

      await request(app.getHttpServer())
        .post('/payments/chapa/webhook')
        .set('x-chapa-signature', forged)
        .set('content-type', 'application/json')
        .send(body)
        .expect(400);

      const subscription = await prisma.subscription.findFirstOrThrow({ where: { userId } });
      expect(subscription.status).toBe('PENDING');
      expect(gateway.verifyCalls).toHaveLength(0);
    });

    /**
     * A refund and a reversal arrive at the same endpoint as a success. A
     * handler that keys off the presence of a payload activates on one.
     */
    it('does not grant access on a refund or a reversal', async () => {
      const started = await chapa.startDirectCharge(userId, 'SIX_MONTH', 'TELEBIRR', '0911223344');
      gateway.paid(started.txRef, priceEtb);

      for (const name of ['charge.refunded', 'charge.reversed', 'charge.failed']) {
        const body = JSON.stringify({ event: name, tx_ref: started.txRef, status: 'success' });
        await request(app.getHttpServer())
          .post('/payments/chapa/webhook')
          .set('x-chapa-signature', signed(body))
          .set('content-type', 'application/json')
          .send(body)
          .expect(201);
      }

      const subscription = await prisma.subscription.findFirstOrThrow({ where: { userId } });
      expect(subscription.status).toBe('PENDING');
    });

    /**
     * 200 once the signature holds, whatever the event turns out to mean. A
     * non-2xx makes Chapa retry, and retrying will not make an unknown reference
     * known — it just turns one ignorable event into a queue of them.
     */
    it('answers 200 for a signed event about a reference it does not know', async () => {
      const body = JSON.stringify({
        event: 'charge.success',
        tx_ref: 'lomi-nosuchsub-abcdef',
        status: 'success',
      });
      await request(app.getHttpServer())
        .post('/payments/chapa/webhook')
        .set('x-chapa-signature', signed(body))
        .set('content-type', 'application/json')
        .send(body)
        .expect(201);
    });
  });

  describe('what a waiting client is told', () => {
    it('reports CONFIRMED once the money is in, without waiting for a webhook', async () => {
      const started = await chapa.startDirectCharge(userId, 'SIX_MONTH', 'TELEBIRR', '0911223344');
      gateway.paid(started.txRef, priceEtb);

      // No webhook at all — a dropped delivery, or a callback URL that was wrong
      // all along. The student's money has still left their account.
      const status = await chapa.statusOf(userId, started.txRef);
      expect(status.status).toBe('CONFIRMED');
      expect(status.expiresAt).not.toBeNull();
    });

    it('reports PENDING while the handset has not been touched', async () => {
      const started = await chapa.startDirectCharge(userId, 'SIX_MONTH', 'TELEBIRR', '0911223344');
      expect((await chapa.statusOf(userId, started.txRef)).status).toBe('PENDING');
    });

    /**
     * Not found and not yours give the same answer, so this endpoint cannot be
     * used to discover which references exist.
     */
    it('will not tell one student about another’s payment', async () => {
      const started = await chapa.startDirectCharge(userId, 'SIX_MONTH', 'TELEBIRR', '0911223344');
      const other = await prisma.user.create({
        data: { telegramId: String(TG + 1), displayName: 'OtherStudent01', fieldId },
      });

      try {
        await expect(chapa.statusOf(other.id, started.txRef)).rejects.toThrow();
        await expect(chapa.statusOf(other.id, 'lomi-nope-abcdef')).rejects.toThrow();
      } finally {
        await prisma.user.delete({ where: { id: other.id } });
      }
    });
  });
});
