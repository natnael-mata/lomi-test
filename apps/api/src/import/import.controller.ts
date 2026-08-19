import { Body, Controller, Post, UnprocessableEntityException, UseGuards } from '@nestjs/common';

import { AdminGuard } from '../auth/staff.guard';
import { SessionGuard } from '../auth/session.guard';
import { CsvError } from './parse-csv';
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
  async import(@Body() body: { csv?: string }): Promise<ImportReport> {
    try {
      return await this.imports.importCsv(body?.csv ?? '');
    } catch (error) {
      /*
       * A file this malformed has no rows to reject one at a time.
       *
       * `CsvError` is a plain Error, so it used to leave here as Nest's bare
       * `{"statusCode":500}` — an operator with a stray quote or a renamed
       * column was told the server had broken, which is both wrong and the
       * least actionable thing the product could have said. The parser already
       * knows what went wrong and on which line; this hands that over intact.
       *
       * 422 and not 400: the request was well-formed, the file inside it was
       * not. It is also the status the admin screen already renders in the
       * operator's own words rather than as a failure.
       */
      if (error instanceof CsvError) {
        throw new UnprocessableEntityException({
          message:
            error.line === undefined
              ? `This file could not be read: ${error.message}`
              : `This file could not be read at line ${error.line}: ${error.message}`,
          line: error.line ?? null,
        });
      }
      throw error;
    }
  }
}
