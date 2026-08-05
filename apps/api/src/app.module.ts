import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ExamsModule } from './exams/exams.module';
import { HealthController } from './health/health.controller';
import { ImportModule } from './import/import.module';
import { PracticeModule } from './practice/practice.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProgressModule } from './progress/progress.module';
import { QuestionsModule } from './questions/questions.module';
import { ReviewModule } from './review/review.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthModule,
    TaxonomyModule,
    QuestionsModule,
    ImportModule,
    ReviewModule,
    PracticeModule,
    ExamsModule,
    ProgressModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
