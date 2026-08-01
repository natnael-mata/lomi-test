/**
 * Integration test — the importer against the real database.
 *
 * `map-row.test.ts` proves what the rules decide. This proves the decisions are
 * actually written: that a half-finished row lands as a real, queryable draft
 * carrying the flags a reviewer will search on.
 *
 * Needs Postgres (`npm run db:dev`). CI provides it as a service container.
 */
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { IMPORT_COLUMNS } from './csv-schema';
import { ImportService, type ImportReport } from './import.service';

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

  it('creates an unknown field unpublished — an import is not a decision to serve it', async () => {
    const field = await prisma.field.findFirstOrThrow({ where: { name: FIELD } });
    expect(field.isPublished).toBe(false);
  });
});
