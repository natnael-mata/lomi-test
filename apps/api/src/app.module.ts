import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { ImportModule } from './import/import.module';
import { PrismaModule } from './prisma/prisma.module';
import { QuestionsModule } from './questions/questions.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';

@Module({
  imports: [PrismaModule, TaxonomyModule, QuestionsModule, ImportModule],
  controllers: [HealthController],
})
export class AppModule {}
