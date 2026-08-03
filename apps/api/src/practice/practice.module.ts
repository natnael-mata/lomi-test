import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AttemptsController, PracticeController } from './practice.controller';
import { PracticeService } from './practice.service';
import { NoSubscriptionsYet, SUBSCRIPTION_ACCESS } from './subscription-access';

@Module({
  imports: [AuthModule],
  controllers: [PracticeController, AttemptsController],
  providers: [
    PracticeService,
    // The Phase 8 seam. When Subscription lands, this one line points at the
    // real implementation and nothing else in practice/ changes.
    { provide: SUBSCRIPTION_ACCESS, useClass: NoSubscriptionsYet },
  ],
  exports: [PracticeService],
})
export class PracticeModule {}
