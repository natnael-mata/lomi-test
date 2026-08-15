import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

/**
 * The controller is ADMIN-guarded, which is what makes it safe.
 *
 * This module previously carried no controller, reasoning that "a public import
 * endpoint is a way to write questions into the bank without review". The
 * concern stands; the route answers it. It sits behind the staff guard, and the
 * importer never publishes (T-054) — every row lands DRAFT whatever the file
 * says, so an upload cannot reach a student without a reviewer.
 *
 * PLAN.md 4.6 asks for exactly this, and without it the people who own the
 * content need shell access to do their job.
 */
@Module({
  imports: [AuthModule],
  controllers: [ImportController],
  providers: [ImportService],
  exports: [ImportService],
})
export class ImportModule {}
