import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { PaymentsModule } from '../payments/payments.module';
import { AdminExamsController } from './admin-exams.controller';
import { ExamBuildService } from './exam-build.service';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { SittingLockGuard } from './sitting-lock.guard';

@Module({
  imports: [PaymentsModule, AuditModule, AuthModule, TaxonomyModule],
  controllers: [AdminExamsController, ExamsController],
  providers: [ExamBuildService, ExamsService, SittingLockGuard],
  exports: [ExamBuildService, ExamsService, SittingLockGuard],
})
export class ExamsModule {}
