/**
 * Integration test — the importer against the real database.
 *
 * `map-row.test.ts` proves what the rules decide. This proves the decisions are
 * actually written: that a half-finished row lands as a real, queryable draft
 * carrying the flags a reviewer will search on.
 *
 * Needs Postgres (`npm run db:dev`). CI provides it as a service container.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { IMPORT_COLUMNS } from './csv-schema';
import { formatReport } from './format-report';
import { ImportService, type ImportReport } from './import.service';

function repoFile(relative: string): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = resolve(dir, relative);
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  throw new Error(`could not locate ${relative}`);
}

const SUFFIX = 'e2e-import';
const FIELD = `E2E Import ${SUFFIX}`;

const header = IMPORT_COLUMNS.join(',');
const csv = (...rows: string[]): string => [header, ...rows].join('\n');

/** A complete row, so each test varies exactly one thing. */
const full = `IMP-1-${SUFFIX},${FIELD},Taxation,VAT,Which statement about VAT is correct?,,One,Two,Three,Four,a,Because one.,,authored,2018,ready`;

describe('ImportService (T-053)', () => {
  let service: ImportService;
  let prisma: PrismaService;
  let moduleRef: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;

  const cleanup = async (): Promise<void> => {
    await prisma.option.deleteMany({ where: { question: { stableId: { contains: SUFFIX } } } });
    await prisma.question.deleteMany({ where: { stableId: { contains: SUFFIX } } });
    await prisma.topic.deleteMany({ where: { course: { field: { name: FIELD } } } });
    await prisma.course.deleteMany({ where: { field: { name: FIELD } } });
    await prisma.field.deleteMany({ where: { name: FIELD } });
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    service = moduleRef.get(ImportService);
    prisma = moduleRef.get(PrismaService);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await moduleRef.close();
  });

  const load = async (stableId: string) =>
    prisma.question.findUniqueOrThrow({
      where: { stableId },
      include: { options: { orderBy: { label: 'asc' } }, topic: { include: { course: true } } },
    });

  it('imports a complete row', async () => {
    const report = await service.importCsv(csv(full));
    expect(report).toMatchObject<Partial<ImportReport>>({ read: 1, created: 1, rejected: 0 });

    const q = await load(`IMP-1-${SUFFIX}`);
    expect(q.stem).toBe('Which statement about VAT is correct?');
    expect(q.options).toHaveLength(4);
    expect(q.options.filter((o) => o.isCorrect).map((o) => o.label)).toEqual(['A']);
    expect(q.importFlags).toEqual(['READY']);
  });

  // The task's own test: GEO-0001 is the template's deliberately unfinished row.
  it('stages a row with a blank answer rather than rejecting it', async () => {
    const blank = `IMP-BLANK-${SUFFIX},${FIELD},Research Methods,Sampling,Which sampling method gives every household an equal chance?,,Purposive,Snowball,Simple random,Convenience,,,,exit-2015,,needs_answer;needs_explanation`;
    const report = await service.importCsv(csv(blank));

    expect(report.rejected).toBe(0);
    expect(report.created).toBe(1);

    const q = await load(`IMP-BLANK-${SUFFIX}`);
    expect(q.importFlags).toContain('NEEDS_ANSWER');
    expect(q.importFlags).toContain('NEEDS_EXPLANATION');
    // Staged, not silently answered: four choices, none of them marked correct.
    expect(q.options).toHaveLength(4);
    expect(q.options.some((o) => o.isCorrect)).toBe(false);
    expect(q.explanation).toBeNull();
  });

  it('stages a row with no course under Unsorted, flagged for triage', async () => {
    const noCourse = `IMP-NOCOURSE-${SUFFIX},${FIELD},,,Some question with no home?,,One,Two,Three,Four,b,Because two.,,raw-scan,,raw`;
    const report = await service.importCsv(csv(noCourse));
    expect(report.rejected).toBe(0);

    const q = await load(`IMP-NOCOURSE-${SUFFIX}`);
    expect(q.topic.name).toBe('Unsorted');
    expect(q.topic.course.name).toBe('Unsorted');
    expect(q.importFlags).toContain('NEEDS_TOPIC_REVIEW');
  });

  // What the review queue will actually run.
  it('makes staged rows findable by what they are missing', async () => {
    const needing = await prisma.question.findMany({
      where: { stableId: { contains: SUFFIX }, importFlags: { has: 'NEEDS_ANSWER' } },
      select: { stableId: true },
    });
    expect(needing.map((q) => q.stableId)).toEqual([`IMP-BLANK-${SUFFIX}`]);
  });

  it('reports a rejected row with its reasons, and imports the rest of the file', async () => {
    const unusable = `IMP-BAD-${SUFFIX},${FIELD},Taxation,VAT,,,One,Two,Three,Four,a,x,,src,,raw`;
    const report = await service.importCsv(csv(unusable, full));

    expect(report).toMatchObject({ read: 2, rejected: 1 });
    const bad = report.rows.find((r) => r.action === 'rejected');
    expect(bad?.stableId).toBe(`IMP-BAD-${SUFFIX}`);
    expect(bad?.messages.join(' ')).toContain('there is no question');

    // The good row in the same file still landed — one bad row is not a failed run.
    await expect(load(`IMP-1-${SUFFIX}`)).resolves.toBeTruthy();
    await expect(
      prisma.question.findUnique({ where: { stableId: `IMP-BAD-${SUFFIX}` } }),
    ).resolves.toBeNull();
  });

  // T-057's own test, with the bad row buried so the line number has to be real.
  it('rejects a 3-option row and names the line it is on', async () => {
    const three = `IMP-3OPT-${SUFFIX},${FIELD},Taxation,VAT,A question with a lost option?,,One,Two,Three,,a,Because one.,,scan,,raw`;
    const spans = `IMP-SPAN-${SUFFIX},${FIELD},Taxation,VAT,"A stem that\nspans two lines?",,One,Two,Three,Four,a,Because one.,,scan,,raw`;
    const report = await service.importCsv(csv(full, spans, three));

    expect(report).toMatchObject({ read: 3, rejected: 1 });
    const bad = report.rows.find((r) => r.action === 'rejected');
    expect(bad?.stableId).toBe(`IMP-3OPT-${SUFFIX}`);
    expect(bad?.messages.join(' ')).toContain('option D is missing — a question needs all four');
    // Line 5, not row 3: the row above it spans two lines of the file.
    expect(bad?.line).toBe(5);

    expect(formatReport(report)).toContain(`IMP-3OPT-${SUFFIX} (line 5)`);
    await expect(
      prisma.question.findUnique({ where: { stableId: `IMP-3OPT-${SUFFIX}` } }),
    ).resolves.toBeNull();
  });

  it('creates an unknown field unpublished — an import is not a decision to serve it', async () => {
    const field = await prisma.field.findFirstOrThrow({ where: { name: FIELD } });
    expect(field.isPublished).toBe(false);
  });
});

describe('ImportService never decides the lifecycle (T-054)', () => {
  let service: ImportService;
  let prisma: PrismaService;
  let moduleRef: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;

  const SFX = 'e2e-lifecycle';
  const FLD = `E2E Lifecycle ${SFX}`;
  const line = (id: string, stem: string, status = 'ready'): string =>
    `${id},${FLD},Taxation,VAT,${stem},,One,Two,Three,Four,a,Because one.,,authored,,${status}`;

  const cleanup = async (): Promise<void> => {
    await prisma.option.deleteMany({ where: { question: { stableId: { contains: SFX } } } });
    await prisma.question.deleteMany({ where: { stableId: { contains: SFX } } });
    await prisma.topic.deleteMany({ where: { course: { field: { name: FLD } } } });
    await prisma.course.deleteMany({ where: { field: { name: FLD } } });
    await prisma.field.deleteMany({ where: { name: FLD } });
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    service = moduleRef.get(ImportService);
    prisma = moduleRef.get(PrismaService);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await moduleRef.close();
  });

  const statusOf = async (stableId: string): Promise<string> =>
    (await prisma.question.findUniqueOrThrow({ where: { stableId } })).status;

  // The task's own test.
  it('imports a status=ready row as DRAFT', async () => {
    await service.importCsv(csv(line(`LC-READY-${SFX}`, 'A ready-claimed question?')));
    expect(await statusOf(`LC-READY-${SFX}`)).toBe('DRAFT');
    // The claim is recorded, it just grants nothing.
    const q = await prisma.question.findUniqueOrThrow({ where: { stableId: `LC-READY-${SFX}` } });
    expect(q.importFlags).toContain('READY');
  });

  it('never sets PUBLISHED, for any status the file can carry', async () => {
    for (const status of ['ready', 'raw', 'needs_answer', 'published', 'PUBLISHED']) {
      const id = `LC-${status.toUpperCase()}-${SFX}`;
      await service.importCsv(csv(line(id, 'Some question?', status)));
      expect(await statusOf(id)).toBe('DRAFT');
    }
  });

  // The failure the obvious implementation (`status: 'DRAFT'` on both branches)
  // causes: re-running an import silently withdraws reviewed, working content.
  it('leaves a PUBLISHED question published when the import changes nothing', async () => {
    const id = `LC-PUB-${SFX}`;
    await service.importCsv(csv(line(id, 'A question that gets published?')));
    await prisma.question.update({ where: { stableId: id }, data: { status: 'PUBLISHED' } });

    await service.importCsv(csv(line(id, 'A question that gets published?')));
    expect(await statusOf(id)).toBe('PUBLISHED');
  });

  it('sends a PUBLISHED question back to review when the import changes its text', async () => {
    const id = `LC-EDIT-${SFX}`;
    await service.importCsv(csv(line(id, 'The original wording?')));
    await prisma.question.update({ where: { stableId: id }, data: { status: 'PUBLISHED' } });

    const report = await service.importCsv(csv(line(id, 'The corrected wording?')));
    expect(await statusOf(id)).toBe('IN_REVIEW');

    const q = await prisma.question.findUniqueOrThrow({ where: { stableId: id } });
    expect(q.stem).toBe('The corrected wording?');
    expect(report.rows[0]?.messages.join(' ')).toContain('sent back to review');
  });

  it('leaves a RETIRED question retired — an import is not a case for reinstating it', async () => {
    const id = `LC-RET-${SFX}`;
    await service.importCsv(csv(line(id, 'A withdrawn question?')));
    await prisma.question.update({ where: { stableId: id }, data: { status: 'RETIRED' } });

    await service.importCsv(csv(line(id, 'A withdrawn question?')));
    expect(await statusOf(id)).toBe('RETIRED');
  });

  it('leaves an IN_REVIEW question in review', async () => {
    const id = `LC-REV-${SFX}`;
    await service.importCsv(csv(line(id, 'A question under review?')));
    await prisma.question.update({ where: { stableId: id }, data: { status: 'IN_REVIEW' } });

    await service.importCsv(csv(line(id, 'A question under review?')));
    expect(await statusOf(id)).toBe('IN_REVIEW');
  });
});

describe('ImportService is idempotent (T-055)', () => {
  let service: ImportService;
  let prisma: PrismaService;
  let moduleRef: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;

  const SFX = 'e2e-idem';
  const FLD = `E2E Idempotent ${SFX}`;
  const ID = `IDEM-1-${SFX}`;
  const row = (opts: { b?: string; d?: string; correct?: string } = {}): string =>
    `${ID},${FLD},Taxation,VAT,Which statement about VAT is correct?,,One,${opts.b ?? 'Two'},Three,${opts.d ?? 'Four'},${opts.correct ?? 'a'},Because one.,,authored,,ready`;

  const cleanup = async (): Promise<void> => {
    await prisma.option.deleteMany({ where: { question: { stableId: { contains: SFX } } } });
    await prisma.question.deleteMany({ where: { stableId: { contains: SFX } } });
    await prisma.topic.deleteMany({ where: { course: { field: { name: FLD } } } });
    await prisma.course.deleteMany({ where: { field: { name: FLD } } });
    await prisma.field.deleteMany({ where: { name: FLD } });
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    service = moduleRef.get(ImportService);
    prisma = moduleRef.get(PrismaService);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await moduleRef.close();
  });

  const options = async () =>
    prisma.option.findMany({
      where: { question: { stableId: ID } },
      orderBy: { label: 'asc' },
    });

  // The task's own test — corrected from 6 to 7, the real row count (T-031/T-051).
  it('imports the real template twice and leaves 7 questions, not 14', async () => {
    const template = readFileSync(repoFile('docs/question_import_template.csv'), 'utf8');
    const first = await service.importCsv(template);
    const second = await service.importCsv(template);

    expect(first.read).toBe(7);
    expect(second.read).toBe(7);
    expect(second.created).toBe(0);
    expect(second.updated).toBe(7);

    const stableIds = [
      'CS-0001',
      'GEO-0001',
      'AF-0001',
      'AF-0002',
      'AF-0003',
      'AF-0004',
      'AF-0005',
    ];
    expect(await prisma.question.count({ where: { stableId: { in: stableIds } } })).toBe(7);
    // And no duplicated options either — 4 apiece, not 8.
    expect(await prisma.option.count({ where: { question: { stableId: 'AF-0001' } } })).toBe(4);
  });

  it('reports the second run as updated rather than created', async () => {
    const created = await service.importCsv(csv(row()));
    expect(created).toMatchObject({ created: 1, updated: 0 });

    const updated = await service.importCsv(csv(row()));
    expect(updated).toMatchObject({ created: 0, updated: 1 });
  });

  it('does not churn option rows on an unchanged re-import', async () => {
    await service.importCsv(csv(row()));
    const before = await options();

    await service.importCsv(csv(row()));
    const after = await options();

    expect(after.map((o) => o.id)).toEqual(before.map((o) => o.id));
  });

  // The destructive default: whyWrong is authored in review, exists in no CSV
  // column, and the publish gate requires it. Delete-and-recreate wipes it.
  it("preserves a reviewer's why-wrong notes across a re-import", async () => {
    await service.importCsv(csv(row()));
    await prisma.option.updateMany({
      where: { question: { stableId: ID }, label: 'B' },
      data: { whyWrong: 'B confuses input tax with output tax.' },
    });

    await service.importCsv(csv(row()));

    const b = (await options()).find((o) => o.label === 'B');
    expect(b?.whyWrong).toBe('B confuses input tax with output tax.');
  });

  it('clears a why-wrong note when its own option was reworded', async () => {
    await service.importCsv(csv(row()));
    await prisma.option.updateMany({
      where: { question: { stableId: ID }, label: 'B' },
      data: { whyWrong: 'About the old wording.' },
    });

    // Quoted, so the comma inside it also proves the parser end to end.
    const report = await service.importCsv(csv(row({ b: '"Two, restated"' })));

    const b = (await options()).find((o) => o.label === 'B');
    expect(b?.text).toBe('Two, restated');
    expect(b?.whyWrong).toBeNull();
    expect(report.rows[0]?.messages.join(' ')).toContain('why-wrong note was cleared');
  });

  // T-057 makes this a rejection rather than an edit: a file that lost an option
  // is a file to fix, not a question to quietly shrink under a reviewer.
  it('rejects a re-import that has lost an option, leaving the stored one intact', async () => {
    await service.importCsv(csv(row()));
    expect(await options()).toHaveLength(4);

    const report = await service.importCsv(csv(row({ d: '' })));
    expect(report).toMatchObject({ read: 1, rejected: 1, updated: 0 });
    expect(report.rows[0]?.messages.join(' ')).toContain('option D is missing');
    expect(report.rows[0]?.line).toBe(2);

    expect(await options()).toHaveLength(4);
  });

  // T-056's own test, on the real file. Corrected from 6 to 7 rows.
  it('reports 7 read, 7 created, 0 rejected for a first run of the template', async () => {
    const template = readFileSync(repoFile('docs/question_import_template.csv'), 'utf8');
    const stableIds = [
      'CS-0001',
      'GEO-0001',
      'AF-0001',
      'AF-0002',
      'AF-0003',
      'AF-0004',
      'AF-0005',
    ];

    // A first run means the rows are not there yet. The seed puts them there, so
    // clear them; the import immediately puts them back.
    await prisma.option.deleteMany({ where: { question: { stableId: { in: stableIds } } } });
    await prisma.question.deleteMany({ where: { stableId: { in: stableIds } } });

    const report = await service.importCsv(template);
    expect(report).toMatchObject({ read: 7, created: 7, updated: 0, rejected: 0 });
    expect(report.rows).toHaveLength(7);

    // GEO-0001 imported, and the report says what it is still missing.
    const geo = report.rows.find((r) => r.stableId === 'GEO-0001');
    expect(geo?.action).toBe('created');

    const printed = formatReport(report);
    expect(printed).toContain('read 7 · created 7 · updated 0 · rejected 0');
  });

  it('sends a published question back to review when the answer key moves', async () => {
    await service.importCsv(csv(row({ d: 'Four' })));
    await prisma.question.update({ where: { stableId: ID }, data: { status: 'PUBLISHED' } });

    await service.importCsv(csv(row({ d: 'Four', correct: 'c' })));

    const q = await prisma.question.findUniqueOrThrow({ where: { stableId: ID } });
    expect(q.status).toBe('IN_REVIEW');
    expect((await options()).find((o) => o.isCorrect)?.label).toBe('C');
  });
});

describe('difficulty round-trips (T-053a)', () => {
  let service: ImportService;
  let prisma: PrismaService;
  let moduleRef: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;

  const SFX = 'e2e-difficulty';
  const FLD = `E2E Difficulty ${SFX}`;
  const line = (id: string, difficulty: string): string =>
    `${id},${FLD},Taxation,VAT,Which statement about VAT is correct?,,One,Two,Three,Four,a,Because one.,${difficulty},authored,,ready`;

  const cleanup = async (): Promise<void> => {
    await prisma.option.deleteMany({ where: { question: { stableId: { contains: SFX } } } });
    await prisma.question.deleteMany({ where: { stableId: { contains: SFX } } });
    await prisma.topic.deleteMany({ where: { course: { field: { name: FLD } } } });
    await prisma.course.deleteMany({ where: { field: { name: FLD } } });
    await prisma.field.deleteMany({ where: { name: FLD } });
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    service = moduleRef.get(ImportService);
    prisma = moduleRef.get(PrismaService);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await moduleRef.close();
  });

  it('stores each rating the CSV gives', async () => {
    await service.importCsv(
      csv(
        line(`D-EASY-${SFX}`, 'easy'),
        line(`D-MED-${SFX}`, 'medium'),
        line(`D-HARD-${SFX}`, 'hard'),
      ),
    );
    const rows = await prisma.question.findMany({
      where: { stableId: { contains: SFX } },
      orderBy: { stableId: 'asc' },
      select: { stableId: true, difficulty: true },
    });
    expect(rows.map((r) => r.difficulty)).toEqual(['EASY', 'HARD', 'MEDIUM']);
  });

  it('stores null for a blank rating, and reports an unusable one', async () => {
    const report = await service.importCsv(
      csv(line(`D-BLANK-${SFX}`, ''), line(`D-ODD-${SFX}`, 'moderate')),
    );
    const rows = await prisma.question.findMany({
      where: { stableId: { in: [`D-BLANK-${SFX}`, `D-ODD-${SFX}`] } },
      orderBy: { stableId: 'asc' },
      select: { difficulty: true },
    });
    expect(rows.map((r) => r.difficulty)).toEqual([null, null]);

    const odd = report.rows.find((r) => r.stableId === `D-ODD-${SFX}`);
    expect(odd?.messages.join(' ')).toContain('not one of easy, medium, hard');
  });

  it('carries the real template’s ratings through to the database', async () => {
    await service.importCsv(readFileSync(repoFile('docs/question_import_template.csv'), 'utf8'));
    const rows = await prisma.question.findMany({
      where: { stableId: { in: ['CS-0001', 'AF-0001', 'AF-0005', 'GEO-0001'] } },
      orderBy: { stableId: 'asc' },
      select: { stableId: true, difficulty: true },
    });
    expect(rows).toEqual([
      { stableId: 'AF-0001', difficulty: 'MEDIUM' },
      { stableId: 'AF-0005', difficulty: 'HARD' },
      { stableId: 'CS-0001', difficulty: 'EASY' },
      { stableId: 'GEO-0001', difficulty: null },
    ]);
  });
});
