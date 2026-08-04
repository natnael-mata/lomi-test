import { Module } from '@nestjs/common';

import { AdminWeightsController } from './admin-weights.controller';
import { TaxonomyService } from './taxonomy.service';
import { WeightsService } from './weights.service';

@Module({
  controllers: [AdminWeightsController],
  providers: [TaxonomyService, WeightsService],
  exports: [TaxonomyService, WeightsService],
})
export class TaxonomyModule {}
