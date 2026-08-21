import { Module } from '@nestjs/common';

import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { CoverageService } from './coverage.service';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';

@Module({
  imports: [TaxonomyModule],
  controllers: [ProgressController],
  providers: [ProgressService, CoverageService],
  exports: [ProgressService, CoverageService],
})
export class ProgressModule {}
