import { Module } from '@nestjs/common';

import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';

@Module({
  imports: [TaxonomyModule],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
