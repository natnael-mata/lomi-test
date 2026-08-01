/**
 * Runs an import from the command line:
 *
 *     npm run import:csv -w api -- ../../docs/question_import_template.csv
 *
 * A CLI rather than an HTTP endpoint on purpose (see `import.module.ts`):
 * importing writes questions into the bank, and an operator running a file is a
 * decision someone makes, not a request the app should accept.
 *
 * Exits non-zero when any row was rejected. A rejected row is a question that
 * silently never made it in, so it has to be able to fail a script.
 */
import { readFileSync } from 'node:fs';

import { PrismaClient } from '@prisma/client';

import type { PrismaService } from '../prisma/prisma.service';
import { formatReport } from './format-report';
import { ImportService } from './import.service';

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: import:csv <path-to-csv>');
    process.exitCode = 2;
    return;
  }

  const prisma = new PrismaClient();
  try {
    const importer = new ImportService(prisma as PrismaService);
    const report = await importer.importCsv(readFileSync(path, 'utf8'));
    console.log(formatReport(report));
    if (report.rejected > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((e: unknown) => {
  // A parse failure kills the whole file, by design — a CSV whose header does
  // not match the schema is not a file to half-import.
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
