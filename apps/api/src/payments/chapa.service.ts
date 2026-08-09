/**
 * The three Chapa-backed ways to pay (T-142, T-143, T-144).
 *
 * The fourth — a bank transfer with a pasted reference — never touches Chapa and
 * lives in `SubscriptionsService.submitManualPayment`. It is settled by a person
 * looking at a statement (T-145); verify.et automation is held pending D6.
 *
 * **One rule holds all three of these together: nothing here grants access.**
 * Starting a charge creates a `PENDING` payment and returns. Access begins in
 * exactly one place — `settle()` — and only after Chapa's verify endpoint has
 * been asked directly. A student's browser, a redirect back from a checkout page
 * and even a correctly signed webhook are all *claims* about a payment. The
 * verify call is the payment.
 */
import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import {
  buildTxRef,
  coversQuotedAmount,
  isSuccessfulCharge,
  isSuccessfulStatus,
  normaliseEthiopianMobile,
  subscriptionFromTxRef,
  verifyWebhookSignature,
  type ChapaWebhookEvent,
  type DirectChannel,
} from './chapa';
import { CHAPA_GATEWAY, type ChapaGateway } from './chapa.client';
import { SubscriptionsService } from './subscriptions.service';

type PlanCode = 'SIX_MONTH' | 'TWELVE_MONTH';

/** What a settlement attempt concluded, for logs and for the polling endpoint. */
export type SettlementOutcome =
  | { settled: true; expiresAt: Date | null; alreadyDone: boolean }
  | { settled: false; reason: 'UNKNOWN_REF' | 'NOT_SUCCESSFUL' | 'UNDERPAID' | 'ALREADY_REJECTED' };

@Injectable()
export class ChapaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    @Inject(CHAPA_GATEWAY) private readonly chapa: ChapaGateway,
  ) {}

  /**
   * Option 1 and 2: telebirr or CBE Birr, paid by approving a USSD push.
   *
   * Returns as soon as Chapa accepts the charge, which is *before* the student
   * has typed their PIN. There is nothing to wait for here — the handset may
   * take a minute — so the response says "we sent it" and the client polls
   * `statusOf` while the webhook races it. Both paths end in `settle()`.
   */
  async startDirectCharge(
    userId: string,
    code: PlanCode,
    channel: DirectChannel,
    mobile: string,
  ): Promise<{ paymentId: string; subscriptionId: string; txRef: string; pushSentTo: string }> {
    const normalised = normaliseEthiopianMobile(mobile);
    if (normalised === null) {
      throw new UnprocessableEntityException({
        error: 'MOBILE_INVALID',
        message: 'Enter the phone number you pay with, for example 0911223344.',
      });
    }

    const plan = await this.prisma.plan.findUniqueOrThrow({ where: { code } });
    const { subscriptionId, paymentId, txRef } = await this.openPayment(
      userId,
      plan.id,
      plan.priceEtb,
      channel,
    );

    try {
      const { reference } = await this.chapa.directCharge({
        channel,
        amountEtb: plan.priceEtb,
        txRef,
        mobile: normalised,
      });
      if (reference) {
        await this.prisma.payment.update({
          where: { id: paymentId },
          data: { providerRef: reference },
        });
      }
    } catch (error) {
      // Chapa refused to even send the push, so there is no payment to wait
      // for. Close the row rather than leaving a PENDING that an operator will
      // later have to work out the meaning of.
      await this.abandon(paymentId, 'Chapa refused the charge');
      throw error;
    }

    return { paymentId, subscriptionId, txRef, pushSentTo: normalised };
  }

  /**
   * Option 3: Chapa's own checkout page.
   *
   * The student leaves the site and comes back through `returnUrl`. **That
   * return proves nothing** — it is a URL in their browser, reachable by typing
   * it — so the page it lands on shows a pending state and asks `statusOf`,
   * which reads what the webhook and the verify call concluded.
   */
  async startHostedCheckout(
    userId: string,
    code: PlanCode,
    urls: { returnUrl: string; callbackUrl: string },
  ): Promise<{ paymentId: string; subscriptionId: string; txRef: string; checkoutUrl: string }> {
    const plan = await this.prisma.plan.findUniqueOrThrow({ where: { code } });
    const { subscriptionId, paymentId, txRef } = await this.openPayment(
      userId,
      plan.id,
      plan.priceEtb,
      'CHAPA',
    );

    try {
      const { checkoutUrl } = await this.chapa.hostedCheckout({
        amountEtb: plan.priceEtb,
        txRef,
        returnUrl: urls.returnUrl,
        callbackUrl: urls.callbackUrl,
      });
      return { paymentId, subscriptionId, txRef, checkoutUrl };
    } catch (error) {
      await this.abandon(paymentId, 'Chapa refused to open a checkout');
      throw error;
    }
  }

  /**
   * A webhook from Chapa (T-143).
   *
   * The signature is checked against the **raw** body, and a failure is a 400
   * that says nothing useful — an endpoint that explains why a forgery was
   * rejected is an endpoint that helps somebody produce a better one.
   */
  async handleWebhook(
    rawBody: string,
    headers: { payloadSignature?: string | undefined; keySignature?: string | undefined },
  ): Promise<SettlementOutcome> {
    const secret = process.env.CHAPA_WEBHOOK_SECRET ?? process.env.CHAPA_SECRET_KEY ?? '';
    const check = verifyWebhookSignature(rawBody, headers, secret);
    if (!check.ok) {
      throw new BadRequestException({
        error: 'INVALID_SIGNATURE',
        message: 'This request was not accepted.',
      });
    }

    let event: ChapaWebhookEvent;
    try {
      event = JSON.parse(rawBody) as ChapaWebhookEvent;
    } catch {
      throw new BadRequestException({
        error: 'INVALID_PAYLOAD',
        message: 'This request was not accepted.',
      });
    }

    if (!isSuccessfulCharge(event)) {
      // Failures, refunds and reversals arrive here too. Nothing to do but say
      // so — a refund does not un-grant time already sold, and pretending this
      // endpoint only ever carries successes is how it ends up granting on one.
      return { settled: false, reason: 'NOT_SUCCESSFUL' };
    }

    return this.settle(event.tx_ref);
  }

  /**
   * Grants access for a reference, if Chapa agrees the money arrived.
   *
   * **The verify call is not optional and not a second opinion — it is the
   * decision.** Everything that reaches this method is a claim: a webhook body,
   * a student pressing "I've paid", a polling client. Chapa's own documentation
   * asks for the re-query, and the reason is that a message about a transaction
   * and the transaction can disagree.
   *
   * Idempotent throughout. A webhook and a poll routinely arrive at once, and
   * the same reference settling twice must extend nothing (T-144).
   */
  async settle(txRef: string, now: Date = new Date()): Promise<SettlementOutcome> {
    // Ours, or somebody else's? A reference we did not mint has no payment row
    // and cannot be settled, whoever sent it.
    if (subscriptionFromTxRef(txRef) === null) return { settled: false, reason: 'UNKNOWN_REF' };

    const payment = await this.prisma.payment.findUnique({ where: { txRef } });
    if (!payment) return { settled: false, reason: 'UNKNOWN_REF' };
    if (payment.status === 'REJECTED') return { settled: false, reason: 'ALREADY_REJECTED' };
    if (payment.status === 'CONFIRMED') {
      const subscription = await this.prisma.subscription.findUnique({
        where: { id: payment.subscriptionId },
        select: { expiresAt: true },
      });
      return { settled: true, expiresAt: subscription?.expiresAt ?? null, alreadyDone: true };
    }

    const verified = await this.chapa.verify(txRef);
    if (verified === null || !isSuccessfulStatus(verified.status)) {
      return { settled: false, reason: 'NOT_SUCCESSFUL' };
    }

    /*
     * Underpayment is a query, not a grant and not a rejection (T-151).
     *
     * Somebody who sent 400 of 500 birr has a problem a person needs to look
     * at. Granting would sell six months for four; rejecting outright would
     * leave them out of pocket with a closed case and nothing to point at.
     */
    if (!coversQuotedAmount(verified.amount, payment.amountEtb)) {
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: {
          note: `Underpaid: Chapa reports ${String(verified.amount)} against ${payment.amountEtb} quoted.`,
          ...(verified.reference ? { providerRef: verified.reference } : {}),
        },
      });
      return { settled: false, reason: 'UNDERPAID' };
    }

    // Conditional on PENDING in the WHERE, not a read then a write: two
    // settlements landing in the same millisecond is the ordinary case here,
    // not the rare one.
    const claimed = await this.prisma.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: {
        status: 'CONFIRMED',
        settledBy: 'chapa',
        settledAt: now,
        ...(verified.reference ? { providerRef: verified.reference } : {}),
      },
    });

    const result = await this.subscriptions.activate(payment.subscriptionId, now);
    return { settled: true, expiresAt: result.expiresAt, alreadyDone: claimed.count === 0 };
  }

  /**
   * What a waiting client should be told.
   *
   * Asks Chapa when the payment is still pending, so a student whose webhook
   * never arrived — a dropped delivery, a callback URL that was wrong all along
   * — is not left staring at a spinner over money that has left their account.
   */
  async statusOf(
    userId: string,
    txRef: string,
  ): Promise<{ status: 'PENDING' | 'CONFIRMED' | 'REJECTED'; expiresAt: string | null }> {
    const payment = await this.prisma.payment.findUnique({ where: { txRef } });
    // Not found and not yours are the same answer, so this endpoint cannot be
    // used to discover which references exist.
    if (!payment || payment.userId !== userId) {
      throw new ConflictException({
        error: 'UNKNOWN_PAYMENT',
        message: 'We could not find that payment. Check the reference and try again.',
      });
    }

    if (payment.status === 'PENDING') {
      const outcome = await this.settle(txRef);
      if (outcome.settled) {
        return { status: 'CONFIRMED', expiresAt: outcome.expiresAt?.toISOString() ?? null };
      }
      return { status: 'PENDING', expiresAt: null };
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { id: payment.subscriptionId },
      select: { expiresAt: true },
    });
    return { status: payment.status, expiresAt: subscription?.expiresAt?.toISOString() ?? null };
  }

  /**
   * Opens a subscription and its payment together, with a reference of our own.
   *
   * The `tx_ref` is minted **before** the charge, because it is the only thing
   * that identifies this money on both sides of the boundary — and if the call
   * to Chapa fails halfway, the row it names is already there to be closed.
   */
  private async openPayment(
    userId: string,
    planId: string,
    priceEtb: number,
    method: 'CHAPA' | DirectChannel,
  ): Promise<{ subscriptionId: string; paymentId: string; txRef: string }> {
    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.create({
        data: { userId, planId, paidEtb: priceEtb, status: 'PENDING' },
        select: { id: true },
      });
      const txRef = buildTxRef(subscription.id, randomBytes(6).toString('hex'));
      const payment = await tx.payment.create({
        data: { userId, subscriptionId: subscription.id, method, amountEtb: priceEtb, txRef },
        select: { id: true },
      });
      return { subscriptionId: subscription.id, paymentId: payment.id, txRef };
    });
  }

  /**
   * Closes a payment that never started.
   *
   * `REJECTED` with a note rather than a delete: an operator asking "what
   * happened to this attempt" deserves an answer, and a row that vanished is
   * indistinguishable from one that never existed.
   */
  private async abandon(paymentId: string, note: string): Promise<void> {
    await this.prisma.payment.updateMany({
      where: { id: paymentId, status: 'PENDING' },
      data: { status: 'REJECTED', note, settledBy: 'system', settledAt: new Date() },
    });
  }
}
