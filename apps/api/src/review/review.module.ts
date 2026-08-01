import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { QuestionsModule } from '../questions/questions.module';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  imports: [AuditModule, QuestionsModule],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
