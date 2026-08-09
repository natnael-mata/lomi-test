import { Module } from '@nestjs/common';

import { SUBSCRIPTION_ACCESS } from '../practice/subscription-access';
import { SubscriptionsService } from './subscriptions.service';

/**
 * Payments and paid access (Phase 8).
 *
 * Exports `SUBSCRIPTION_ACCESS` bound to the real implementation, which is the
 * whole of T-111a: `practice/` and `exams/` already ask the question through
 * that token, so nothing in either changes now that there is a real answer.
 */
@Module({
  providers: [
    SubscriptionsService,
    { provide: SUBSCRIPTION_ACCESS, useExisting: SubscriptionsService },
  ],
  exports: [SubscriptionsService, SUBSCRIPTION_ACCESS],
})
export class PaymentsModule {}
