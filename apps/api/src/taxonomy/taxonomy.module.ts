import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AdminWeightsController } from './admin-weights.controller';
import { TaxonomyService } from './taxonomy.service';
import { WeightsService } from './weights.service';

@Module({
  imports: [AuditModule],
  controllers: [AdminWeightsController],
  providers: [TaxonomyService, WeightsService],
  exports: [TaxonomyService, WeightsService],
})
export class TaxonomyModule {}
