import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SUBSCRIPTION_ACCESS } from '../practice/subscription-access';
import { CHAPA_GATEWAY, HttpChapaGateway } from './chapa.client';
import { ChapaService } from './chapa.service';
import {
  AdminPaymentsController,
  ChapaWebhookController,
  PaymentsController,
} from './payments.controller';
import { SubscriptionsService } from './subscriptions.service';

/**
 * Payments and paid access (Phase 8).
 *
 * Exports `SUBSCRIPTION_ACCESS` bound to the real implementation, which is the
 * whole of T-111a: `practice/` and `exams/` already ask the question through
 * that token, so nothing in either changes now that there is a real answer.
 *
 * The Chapa gateway is bound behind a token so a test can supply one that never
 * opens a socket. That is the only reason it is a token — the alternative is
 * either a test suite that talks to a real payment provider or one that stubs
 * `fetch` globally and quietly stops testing the request it builds.
 */
@Module({
  imports: [AuthModule],
  controllers: [PaymentsController, ChapaWebhookController, AdminPaymentsController],
  providers: [
    SubscriptionsService,
    ChapaService,
    { provide: CHAPA_GATEWAY, useClass: HttpChapaGateway },
    { provide: SUBSCRIPTION_ACCESS, useExisting: SubscriptionsService },
  ],
  exports: [SubscriptionsService, SUBSCRIPTION_ACCESS],
})
export class PaymentsModule {}
