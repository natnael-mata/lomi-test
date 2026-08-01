import { Module } from '@nestjs/common';

import { ImportService } from './import.service';

/**
 * No controller yet, deliberately. Importing is an operator action run against a
 * file, not something the app exposes over HTTP — a public import endpoint is a
 * way to write questions into the bank without review.
 */
@Module({
  providers: [ImportService],
  exports: [ImportService],
})
export class ImportModule {}
