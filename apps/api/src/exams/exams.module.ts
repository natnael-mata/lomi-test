import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { AdminExamsController } from './admin-exams.controller';
import { ExamBuildService } from './exam-build.service';

@Module({
  imports: [AuthModule, TaxonomyModule],
  controllers: [AdminExamsController],
  providers: [ExamBuildService],
  exports: [ExamBuildService],
})
export class ExamsModule {}
