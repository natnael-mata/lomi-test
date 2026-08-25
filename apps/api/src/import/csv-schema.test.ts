import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseImportCsv } from './parse-csv';

import {
  IMPORT_COLUMNS,
  REQUIRED_COLUMNS,
  IMPORT_STATUSES,
  _columnsCoverType,
  _typeCoversColumns,
  type ImportRow,
} from './csv-schema';

/**
 * Walk up from the working directory to the repo root.
 *
 * Not `import.meta.url`: `apps/api` compiles as CommonJS (NestJS needs decorator
 * metadata), and `import.meta` is a syntax error under that module setting even
 * though Vitest would happily run it — a gap only `npm run typecheck` catches.
 */
function repoFile(relative: string): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = resolve(dir, relative);
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  throw new Error(`could not locate ${relative} from ${process.cwd()}`);
}

const TEMPLATE = repoFile('docs/question_import_template.csv');

/** The header line of the real template, split on commas (no quoted headers). */
function templateHeader(): string[] {
  return readFileSync(TEMPLATE, 'utf8').split('\n')[0]!.trim().split(',');
}

describe('canonical import schema (T-050)', () => {
  it('declares exactly 22 columns, six of them optional', () => {
    expect(IMPORT_COLUMNS).toHaveLength(22);
    /*
     * Sixteen were the original schema. `source_grade` was appended by T-253;
     * the concept line and the four why-wrongs by T-212, which is what made the
     * importer able to produce a *publishable* question rather than a draft with
     * four blockers on it.
     *
     * Asserted as a count and as the exact difference, so appending a column
     * without deciding whether it is optional fails here rather than in
     * somebody's spreadsheet.
     */
    expect(REQUIRED_COLUMNS).toHaveLength(16);
    expect(IMPORT_COLUMNS.filter((c) => !REQUIRED_COLUMNS.includes(c))).toEqual([
      'source_grade',
      'concept_line',
      'why_wrong_a',
      'why_wrong_b',
      'why_wrong_c',
      'why_wrong_d',
    ]);
  });

  /*
   * The optional tail is a TAIL.
   *
   * A column that may be absent has to be last, or a file that omits it shifts
   * every cell to its right — the importer would accept the row and file the
   * explanation under `difficulty`, silently. This is the assertion that stops
   * somebody inserting the next optional column in the middle.
   */
  it('keeps every optional column at the end of the schema', () => {
    const firstOptional = IMPORT_COLUMNS.findIndex((c) => !REQUIRED_COLUMNS.includes(c));
    if (firstOptional === -1) return;
    expect(IMPORT_COLUMNS.slice(firstOptional).every((c) => !REQUIRED_COLUMNS.includes(c))).toBe(
      true,
    );
  });

  // The assertion that matters: the declared schema is checked against the
  // actual file, in order. A renamed or reordered column fails here rather than
  // being silently read as a different field during an import.
  it('matches the real template header exactly, in order', () => {
    expect([...IMPORT_COLUMNS]).toEqual(templateHeader());
  });

  it('has no duplicate column names', () => {
    expect(new Set(IMPORT_COLUMNS).size).toBe(IMPORT_COLUMNS.length);
  });

  // These are compile-time guards; if the type and the tuple ever disagree,
  // `npm run typecheck` fails before this test ever runs. Asserted here too so
  // the intent is visible to a reader.
  it('keeps the type and the column tuple in step', () => {
    expect(_columnsCoverType).toBe(true);
    expect(_typeCoversColumns).toBe(true);
  });

  // Written as a literal, not built by cast: this is the one place the
  // interface's field list is exercised directly, so a field added to the tuple
  // but forgotten in the interface fails to compile right here.
  it('types every cell as a string, since coercion happens later', () => {
    const row: ImportRow = {
      question_id: 'AF-0003',
      field: 'Accounting & Finance',
      course: 'Taxation',
      topic: 'VAT',
      question_text: 'How much VAT is contained in that amount?',
      code_block: '',
      option_a: '172,500',
      option_b: '150,000',
      option_c: '15,000',
      option_d: '1,000,000',
      correct_option: 'b',
      explanation: 'Extract with ×15/115.',
      difficulty: 'easy',
      source: 'authored',
      year: '',
      status: 'ready',
      source_grade: '',
      concept_line: '',
      why_wrong_a: '',
      why_wrong_b: '',
      why_wrong_c: '',
      why_wrong_d: '',
    };
    expect(Object.keys(row)).toHaveLength(22);
    expect(Object.keys(row).sort()).toEqual([...IMPORT_COLUMNS].sort());
  });

  it('covers every status the template uses', () => {
    /*
     * Read by column name, not by position.
     *
     * This took "the last column" and sliced at the final comma. `status` was
     * last when the test was written; `source_grade` moved it and the test
     * survived only because that column is empty in the template, so the slice
     * returned '' and `filter(Boolean)` dropped it. T-212's why-wrongs are not
     * empty, and the test started asserting that a sentence about CSS was a
     * valid status.
     *
     * Parsing properly costs one function call and cannot drift again.
     */
    const used = new Set(
      parseImportCsv(readFileSync(TEMPLATE, 'utf8'))
        .map((p) => p.row.status.trim())
        .flatMap((s) => s.split(';'))
        .filter(Boolean),
    );
    for (const s of used) {
      expect(IMPORT_STATUSES).toContain(s);
    }
  });
});
