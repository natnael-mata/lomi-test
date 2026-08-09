import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  type RawBodyRequest,
} from '@nestjs/common';

import { AdminGuard } from '../auth/staff.guard';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { ChapaService } from './chapa.service';
import { SubscriptionsService } from './subscriptions.service';
import type { DirectChannel } from './chapa';
import type { PlanOffer } from './plan';

interface DirectBody {
  planCode?: 'SIX_MONTH' | 'TWELVE_MONTH';
  mobile?: string;
}

/**
 * Buying access (T-142, T-145, T-146).
 *
 * Four ways to pay, and the checkout offers them in this order:
 *
 * 1. `POST /payments/telebirr` — a USSD push to the student's handset
 * 2. `POST /payments/cbebirr` — the same, on CBE Birr
 * 3. `POST /payments/chapa` — Chapa's hosted page, settled by webhook
 * 4. `POST /payments/manual` — any bank, then paste the reference
 *
 * The student half is behind `SessionGuard` and takes the user from the session,
 * never from the body — a payment route that accepts a user id is one that lets
 * anybody buy on somebody else's behalf, or worse, settle on it.
 */
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly chapa: ChapaService,
  ) {}

  /** The plans on sale, with the per-month maths done (T-141a). */
  @Get('plans')
  plans(): Promise<PlanOffer[]> {
    return this.subscriptions.offers();
  }

  /**
   * Option 1: telebirr, paid by approving a USSD push (T-142).
   *
   * Returns before the student has typed their PIN — the handset can take a
   * minute and there is nothing useful to block on. The client shows "check your
   * phone" and polls `GET /payments/status`.
   *
   * Two literal routes rather than one with a `:channel` parameter. The channel
   * is not data the caller supplies; it is which of two products they chose, and
   * a parameter would put the set of acceptable values in a validator somewhere
   * instead of in the route table where the inventory test (T-107) can see it.
   */
  @Post('telebirr')
  @UseGuards(SessionGuard)
  telebirr(@Req() req: AuthedRequest, @Body() body: DirectBody) {
    return this.startDirect(req, 'TELEBIRR', body);
  }

  /** Option 2: CBE Birr, the same USSD flow on a different wallet. */
  @Post('cbebirr')
  @UseGuards(SessionGuard)
  cbebirr(@Req() req: AuthedRequest, @Body() body: DirectBody) {
    return this.startDirect(req, 'CBEBIRR', body);
  }

  private startDirect(req: AuthedRequest, channel: DirectChannel, body: DirectBody) {
    return this.chapa.startDirectCharge(
      req.auth!.userId,
      body?.planCode ?? 'SIX_MONTH',
      channel,
      body?.mobile ?? '',
    );
  }

  /**
   * Option 3: Chapa's hosted checkout page.
   *
   * The student leaves and comes back through `return_url`, which **proves
   * nothing** — it is a URL in their browser. The page they land on shows a
   * pending state and polls; the webhook and the verify call decide.
   */
  @Post('chapa')
  @UseGuards(SessionGuard)
  hosted(@Req() req: AuthedRequest, @Body() body: { planCode?: 'SIX_MONTH' | 'TWELVE_MONTH' }) {
    return this.chapa.startHostedCheckout(req.auth!.userId, body?.planCode ?? 'SIX_MONTH', {
      returnUrl: `${webBaseUrl()}/checkout/return`,
      callbackUrl: `${apiBaseUrl()}/payments/chapa/webhook`,
    });
  }

  /**
   * Records a bank transfer the student says they have made.
   *
   * Grants nothing: the subscription and the payment are both `PENDING` until an
   * operator has looked at the statement (T-146).
   */
  @Post('manual')
  @UseGuards(SessionGuard)
  manual(
    @Req() req: AuthedRequest,
    @Body() body: { planCode?: 'SIX_MONTH' | 'TWELVE_MONTH'; txRef?: string },
  ): Promise<{ paymentId: string; subscriptionId: string; status: 'PENDING' }> {
    return this.subscriptions.submitManualPayment(
      req.auth!.userId,
      body?.planCode ?? 'SIX_MONTH',
      body?.txRef ?? '',
    );
  }

  /** Where a waiting checkout has got to. Only the payer's own (T-144). */
  @Get('status')
  @UseGuards(SessionGuard)
  status(@Req() req: AuthedRequest, @Query('txRef') txRef: string) {
    return this.chapa.statusOf(req.auth!.userId, txRef ?? '');
  }

  /** What this student's access looks like. Their own, from the session. */
  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() req: AuthedRequest) {
    return this.subscriptions.statusFor(req.auth!.userId);
  }
}

/**
 * Chapa's webhook (T-143).
 *
 * **Deliberately outside `PaymentsController` and deliberately unguarded.** It
 * is called by Chapa, which has no session and no bearer token, so the only
 * thing standing between this route and anybody on the internet is the
 * signature. That makes it the one route in the codebase whose authentication is
 * its body, and separating it says so.
 *
 * Always answers 200 once the signature holds. A non-2xx makes Chapa retry, and
 * retrying will not fix "this reference is not ours" or "that charge failed" —
 * it just turns one ignorable event into a queue of them.
 */
@Controller('payments/chapa')
export class ChapaWebhookController {
  constructor(private readonly chapa: ChapaService) {}

  @Post('webhook')
  async webhook(
    @Req() req: RawBodyRequest<AuthedRequest>,
    @Headers('x-chapa-signature') payloadSignature?: string,
    @Headers('chapa-signature') keySignature?: string,
  ): Promise<{ received: true }> {
    // The RAW body, not the parsed one. Re-serialising JSON reorders keys and
    // changes whitespace, and the hash of a re-serialised body is the hash of a
    // different document — which presents as "every webhook is forged".
    const raw = req.rawBody?.toString('utf8') ?? '';
    await this.chapa.handleWebhook(raw, { payloadSignature, keySignature });
    return { received: true };
  }
}

function webBaseUrl(): string {
  return process.env.WEB_BASE_URL ?? 'http://localhost:3100';
}

function apiBaseUrl(): string {
  return process.env.API_BASE_URL ?? 'http://localhost:4000';
}

/**
 * Settling a transfer (T-152's student-visible half).
 *
 * ADMIN only and under `/admin`, so the route inventory test (T-107) keeps
 * holding. The actor comes from the session: a client that names its own actor
 * can name anybody, which makes the record worthless exactly when somebody needs
 * to know who granted access.
 */
@Controller('admin/payments')
@UseGuards(SessionGuard, AdminGuard)
export class AdminPaymentsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Post(':paymentId/confirm')
  confirm(
    @Req() req: AuthedRequest,
    @Param('paymentId') paymentId: string,
    @Body() body: { note?: string },
  ): Promise<{ activated: boolean; expiresAt: Date | null }> {
    return this.subscriptions.confirmManualPayment(paymentId, req.auth!.userId, body?.note);
  }
}
