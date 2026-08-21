/**
 * Integration test — `sourceGrade` and the track it must belong to (T-253).
 *
 * **The column exists to make a diagnostic actionable.** "Your weakness is
 * Chemistry" is a shrug; "your weakness is Grade 10 Chemistry" names the
 * textbook to open. That only holds if the grade on a question is true, and
 * nothing downstream can tell a wrong grade from a right one — a Grade 8
 * question filed under Grade 6 puts a question the student will never be asked
 * into the denominator of their coverage figure and corrupts the per-year
 * breakdown in the same stroke, silently, forever.
 *
 * So it is checked where the file meets the track, and a mismatch is a
 * **rejection** rather than a note: a wrong year on `source` costs a line in a
 * report, this costs the figure the product is built around.
 *
 * The other half of the suite is the compatibility guarantee. Sixteen-column
 * spreadsheets were being uploaded the week this column was added, and a schema
 * change that invalidates the work already done is not one anybody can afford.
 *
 * Needs Postgres (`npm run db:dev`).
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { ImportService } from './import.service';
import { IMPORT_COLUMNS, REQUIRED_COLUMNS } from './csv-schema';

const SFX = 'e2e-source-grade';
/** Grade 12: the exam draws on years 9 to 12. */
const TRACK = `Grade 12 Natural ${SFX}`;
/** No year span at all — a degree, not a school year. */
const EXIT = `Exit Track ${SFX}`;

const WIDE = IMPORT_COLUMNS.join(',');
const NARROW = REQUIRED_COLUMNS.join(',');

/** One row at the full width. `grade` is the 17th cell. */
const wideRow = (id: string, field: string, grade: string): string =>
  [
    id,
    field,
    'Chemistry',
    'Redox',
    'Which species is oxidised?',
    '',
    'The one that loses electrons',
    'The one that gains electrons',
    'Neither',
    'Both',
    'a',
    'Oxidation is loss of electrons.',
    'medium',
    'Source',
    '2018',
    'ready',
    grade,
  ].join(',');

/** The same row as a file written before the column existed. */
const narrowRow = (id: string, field: string): string =>
  wideRow(id, field, '').split(',').slice(0, REQUIRED_COLUMNS.length).join(',');

describe('sourceGrade belongs to its track (T-253)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let imports: ImportService;

  const wipe = async (): Promise<void> => {
    await prisma.option.deleteMany({ where: { question: { stableId: { contains: SFX } } } });
    await prisma.question.deleteMany({ where: { stableId: { contains: SFX } } });
    await prisma.topic.deleteMany({ where: { course: { field: { name: { contains: SFX } } } } });
    await prisma.course.deleteMany({ where: { field: { name: { contains: SFX } } } });
    await prisma.field.deleteMany({ where: { name: { contains: SFX } } });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    imports = app.get(ImportService);
    await wipe();

    await prisma.field.create({
      data: { name: TRACK, slug: `grade-12-natural-${SFX}`, minGrade: 9, maxGrade: 12 },
    });
    await prisma.field.create({ data: { name: EXIT, slug: `exit-${SFX}` } });
  });

  afterAll(async () => {
    await wipe();
    await app.close();
  });

  const run = (header: string, ...rows: string[]) =>
    imports.importCsv([header, ...rows].join('\n'));

  it('accepts a grade inside the track, and reads it back', async () => {
    const report = await run(WIDE, wideRow(`SG-IN-${SFX}`, TRACK, '10'));
    expect(report.rejected).toBe(0);
    expect(report.created).toBe(1);

    const stored = await prisma.question.findUniqueOrThrow({
      where: { stableId: `SG-IN-${SFX}` },
      select: { sourceGrade: true },
    });
    expect(stored.sourceGrade).toBe(10);
  });

  it('rejects a grade outside the track, and names why', async () => {
    const report = await run(WIDE, wideRow(`SG-OUT-${SFX}`, TRACK, '8'));
    expect(report.rejected).toBe(1);
    expect(report.created).toBe(0);

    const [row] = report.rows;
    expect(row?.action).toBe('rejected');
    // Named: the value, the track, and the span it had to fall in. "Invalid
    // source_grade" would leave an operator with 500 rows and no idea which
    // file they had open.
    const said = row?.messages.join(' ') ?? '';
    expect(said).toContain('8');
    expect(said).toContain(TRACK);
    expect(said).toContain('9');
    expect(said).toContain('12');

    // And nothing was written. A rejection that half-lands is worse than one
    // that does not land at all.
    expect(await prisma.question.count({ where: { stableId: `SG-OUT-${SFX}` } })).toBe(0);
  });

  it('rejects any grade at all on a track that has no school years', async () => {
    const report = await run(WIDE, wideRow(`SG-EXIT-${SFX}`, EXIT, '11'));
    expect(report.rejected).toBe(1);
    expect(report.rows[0]?.messages.join(' ')).toContain('does not draw on school years');
  });

  it('accepts a blank grade on an exit track', async () => {
    const report = await run(WIDE, wideRow(`SG-EXIT-OK-${SFX}`, EXIT, ''));
    expect(report.rejected).toBe(0);
    const stored = await prisma.question.findUniqueOrThrow({
      where: { stableId: `SG-EXIT-OK-${SFX}` },
      select: { sourceGrade: true },
    });
    expect(stored.sourceGrade).toBeNull();
  });

  it('refuses a value that is not a school year, before any track is consulted', async () => {
    const report = await run(WIDE, wideRow(`SG-JUNK-${SFX}`, TRACK, '2018'));
    expect(report.rejected).toBe(1);
    // The mistake this catches is somebody pasting the `year` column twice.
    expect(report.rows[0]?.messages.join(' ')).toContain('between 1 and 12');
  });

  /*
   * The compatibility half.
   *
   * Sixteen-column files were being uploaded the week this column landed.
   * Rejecting them at the header would have invalidated the bank in progress.
   */
  it('still reads a file written before the column existed', async () => {
    const report = await run(NARROW, narrowRow(`SG-LEGACY-${SFX}`, TRACK));
    expect(report.rejected).toBe(0);
    expect(report.created).toBe(1);

    const stored = await prisma.question.findUniqueOrThrow({
      where: { stableId: `SG-LEGACY-${SFX}` },
      select: { sourceGrade: true },
    });
    // Absent, not zero and not guessed. Unknown is the honest reading.
    expect(stored.sourceGrade).toBeNull();
  });

  it('fills the grade in on re-import at the wider width', async () => {
    const report = await run(WIDE, wideRow(`SG-LEGACY-${SFX}`, TRACK, '11'));
    expect(report.updated).toBe(1);
    const stored = await prisma.question.findUniqueOrThrow({
      where: { stableId: `SG-LEGACY-${SFX}` },
      select: { sourceGrade: true },
    });
    expect(stored.sourceGrade).toBe(11);
  });
});
