import { Module } from '@nestjs/common';

import { TaxonomyService } from './taxonomy.service';

@Module({
  providers: [TaxonomyService],
  exports: [TaxonomyService],
})
export class TaxonomyModule {}
