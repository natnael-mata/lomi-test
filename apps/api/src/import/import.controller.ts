import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { AdminGuard } from '../auth/staff.guard';
import { SessionGuard } from '../auth/session.guard';
import { ImportService, type ImportReport } from './import.service';

/**
 * Bulk question upload (PLAN.md § 4.6).
 *
 * *"Content: upload questions (bulk import — CSV/Excel with columns for field,
 * course, topic, question, options, answer, explanation), edit, retire."*
 *
 * **This module's comment used to say there should be no controller**, on the
 * grounds that "a public import endpoint is a way to write questions into the
 * bank without review". That concern is right and this route does not raise it:
 *
 * - It is **ADMIN-guarded**, not public. The same guard as every other `/admin`
 *   route, and the sweep in `admin-sweep.e2e.test.ts` covers it.
 * - The importer **never publishes** (T-054). Every row lands `DRAFT` whatever
 *   the file claims, so an upload cannot put an unreviewed question in front of
 *   a student. Publishing stays a reviewer's action through the gate.
 *
 * Without this, loading questions requires shell access to the server — which
 * means the people who own the content cannot do their own job.
 */
@Controller('admin/questions')
@UseGuards(SessionGuard, AdminGuard)
export class ImportController {
  constructor(private readonly imports: ImportService) {}

  /**
   * Takes the CSV as text rather than a multipart upload.
   *
   * The file is a few hundred kilobytes of UTF-8 at most, the browser can read
   * it with `FileReader`, and text keeps the request debuggable — an operator
   * describing a failed import can paste exactly what they sent.
   */
  @Post('import')
  import(@Body() body: { csv?: string }): Promise<ImportReport> {
    return this.imports.importCsv(body?.csv ?? '');
  }
}
