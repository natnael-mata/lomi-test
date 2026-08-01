/**
 * Seeds the worked examples from `docs/question_import_template.csv`.
 *
 * Runs the real importer (T-053) rather than its own copy of the mapping. The
 * seed had a private copy of both the parser and the row mapping until T-051 and
 * T-053; two implementations of "what does this CSV mean" is two answers, and
 * the seed's answer is the one nobody tests.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient } from '@prisma/client';

import { ImportService } from '../src/import/import.service';
import type { PrismaService } from '../src/prisma/prisma.service';

const CSV = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../docs/question_import_template.csv',
);

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // The service only needs the client's query surface; the Nest lifecycle hooks
  // are irrelevant to a script that opens and closes its own connection.
  const importer = new ImportService(prisma as PrismaService);
  const report = await importer.importCsv(readFileSync(CSV, 'utf8'));

  console.log(
    `seeded ${report.created + report.updated} sample questions ` +
      `(${report.created} created, ${report.updated} updated, ${report.rejected} rejected)`,
  );
  for (const row of report.rows) {
    if (row.action === 'rejected')
      console.error(`  rejected ${row.stableId}: ${row.messages.join('; ')}`);
  }
  if (report.rejected > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
