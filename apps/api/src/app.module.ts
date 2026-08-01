import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { ImportModule } from './import/import.module';
import { PrismaModule } from './prisma/prisma.module';
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
  ],
  controllers: [HealthController],
})
export class AppModule {}
