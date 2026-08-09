import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ExamsModule } from '../exams/exams.module';
import {
  AttemptsController,
  PracticeController,
  PracticeSummaryController,
} from './practice.controller';
import { PracticeService } from './practice.service';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PaymentsModule, AuthModule, ExamsModule],
  controllers: [PracticeController, AttemptsController, PracticeSummaryController],
  providers: [PracticeService],
  exports: [PracticeService],
})
export class PracticeModule {}
