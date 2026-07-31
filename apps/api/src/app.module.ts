import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';

@Module({
  imports: [PrismaModule, TaxonomyModule],
  controllers: [HealthController],
})
export class AppModule {}
