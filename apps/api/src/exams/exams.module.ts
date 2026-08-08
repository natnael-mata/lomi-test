import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { NoSubscriptionsYet, SUBSCRIPTION_ACCESS } from '../practice/subscription-access';
import { AdminExamsController } from './admin-exams.controller';
import { ExamBuildService } from './exam-build.service';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { SittingLockGuard } from './sitting-lock.guard';

@Module({
  imports: [AuditModule, AuthModule, TaxonomyModule],
  controllers: [AdminExamsController, ExamsController],
  providers: [
    ExamBuildService,
    ExamsService,
    SittingLockGuard,
    // The Phase 8 seam again. Until a Subscription model exists this answers
    // false for everyone, so nobody can start a mock — the safe direction, and
    // not the binding constraint anyway while no bank can form a paper.
    { provide: SUBSCRIPTION_ACCESS, useClass: NoSubscriptionsYet },
  ],
  exports: [ExamBuildService, ExamsService, SittingLockGuard],
})
export class ExamsModule {}
