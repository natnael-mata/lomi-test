import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ExamsModule } from '../exams/exams.module';
import {
  AttemptsController,
  PracticeController,
  PracticeSummaryController,
} from './practice.controller';
import { PracticeService } from './practice.service';
import { NoSubscriptionsYet, SUBSCRIPTION_ACCESS } from './subscription-access';

@Module({
  imports: [AuthModule, ExamsModule],
  controllers: [PracticeController, AttemptsController, PracticeSummaryController],
  providers: [
    PracticeService,
    // The Phase 8 seam. When Subscription lands, this one line points at the
    // real implementation and nothing else in practice/ changes.
    { provide: SUBSCRIPTION_ACCESS, useClass: NoSubscriptionsYet },
  ],
  exports: [PracticeService],
})
export class PracticeModule {}
