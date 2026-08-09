import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';

import { AdminGuard } from '../auth/staff.guard';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { SubscriptionsService } from './subscriptions.service';
import type { PlanOffer } from './plan';

/**
 * Buying access (T-145, T-146).
 *
 * The student half is behind `SessionGuard` and takes the user from the session,
 * never from the body — a payment route that accepts a user id is one that lets
 * anybody buy on somebody else's behalf, or worse, settle on it.
 */
@Controller('payments')
export class PaymentsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  /** The plans on sale, with the per-month maths done (T-141a). */
  @Get('plans')
  plans(): Promise<PlanOffer[]> {
    return this.subscriptions.offers();
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

  /** What this student's access looks like. Their own, from the session. */
  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() req: AuthedRequest) {
    return this.subscriptions.statusFor(req.auth!.userId);
  }
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
