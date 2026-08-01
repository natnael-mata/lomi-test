import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { IMPORT_COLUMNS } from './csv-schema';
import { CsvError, parseImportCsv, splitRows } from './parse-csv';

function repoFile(relative: string): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = resolve(dir, relative);
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  throw new Error(`could not locate ${relative}`);
}

const TEMPLATE = readFileSync(repoFile('docs/question_import_template.csv'), 'utf8');

/** Most tests care about the cells; the line number has its own block below. */
const parseRows = (text: string) => parseImportCsv(text).map((p) => p.row);
const header = IMPORT_COLUMNS.join(',');

describe('parseImportCsv — the real template (T-051)', () => {
  const rows = parseRows(TEMPLATE);

  // The task text said 6. The template has 7 — six in launch fields plus
  // GEO-0001, which is the deliberate `needs_answer` example.
  it('parses all 7 rows', () => {
    expect(rows).toHaveLength(7);
    expect(rows.map((r) => r.question_id)).toEqual([
      'CS-0001',
      'GEO-0001',
      'AF-0001',
      'AF-0002',
      'AF-0003',
      'AF-0004',
      'AF-0005',
    ]);
  });

  // The reason a hand-rolled split(',') is not good enough: these explanations
  // are full of commas, both in prose and inside numbers like "1,150,000".
  it("keeps the commas inside AF-0001's explanation", () => {
    const af1 = rows.find((r) => r.question_id === 'AF-0001')!;
    expect(af1.explanation).toContain('30,000');
    expect(af1.explanation.split(',').length).toBeGreaterThan(3);
    expect(af1.explanation).not.toContain('"');
  });

  it('keeps commas inside the question text', () => {
    const af3 = rows.find((r) => r.question_id === 'AF-0003')!;
    expect(af3.question_text).toContain('Br 1,150,000');
  });

  it('preserves an empty optional cell as an empty string, not undefined', () => {
    const geo = rows.find((r) => r.question_id === 'GEO-0001')!;
    expect(geo.correct_option).toBe('');
    expect(geo.explanation).toBe('');
    expect(geo.code_block).toBe('');
  });

  it('reads the multi-value status column verbatim', () => {
    const geo = rows.find((r) => r.question_id === 'GEO-0001')!;
    expect(geo.status).toBe('needs_answer;needs_explanation;needs_topic_review');
  });
});

describe('parseImportCsv — quoting rules', () => {
  it('handles a newline inside a quoted field', () => {
    const csv = `${header}\nQ-1,F,C,T,"line one\nline two",,a,b,c,d,a,expl,easy,src,2018,ready`;
    const [row] = parseRows(csv);
    expect(row!.question_text).toBe('line one\nline two');
  });

  it('handles escaped double quotes', () => {
    const csv = `${header}\nQ-1,F,C,T,"He said ""no"" firmly",,a,b,c,d,a,expl,easy,src,2018,ready`;
    const [row] = parseRows(csv);
    expect(row!.question_text).toBe('He said "no" firmly');
  });

  it('handles CRLF line endings', () => {
    const csv = `${header}\r\nQ-1,F,C,T,stem,,a,b,c,d,a,expl,easy,src,2018,ready\r\n`;
    expect(parseRows(csv)).toHaveLength(1);
    expect(parseRows(csv)[0]!.question_text).toBe('stem');
  });

  it('strips a UTF-8 BOM so the first column still matches', () => {
    const csv = `\uFEFF${header}\nQ-1,F,C,T,stem,,a,b,c,d,a,expl,easy,src,2018,ready`;
    expect(() => parseImportCsv(csv)).not.toThrow();
    expect(parseRows(csv)[0]!.question_id).toBe('Q-1');
  });

  it('ignores a trailing newline rather than emitting a blank row', () => {
    const csv = `${header}\nQ-1,F,C,T,stem,,a,b,c,d,a,expl,easy,src,2018,ready\n\n`;
    expect(parseRows(csv)).toHaveLength(1);
  });
});

describe('parseImportCsv — malformed input', () => {
  it('rejects a header that does not match the schema, naming what is missing', () => {
    const bad = header.replace('explanation', 'rationale');
    expect(() => parseImportCsv(`${bad}\n`)).toThrow(/missing: explanation/);
    expect(() => parseImportCsv(`${bad}\n`)).toThrow(/unexpected: rationale/);
  });

  it('rejects reordered columns even when every name is present', () => {
    const swapped = [...IMPORT_COLUMNS];
    [swapped[1], swapped[2]] = [swapped[2]!, swapped[1]!];
    expect(() => parseImportCsv(`${swapped.join(',')}\n`)).toThrow(/out of order/);
  });

  it('rejects a ragged row and names the line number', () => {
    const csv = `${header}\nQ-1,F,C\n`;
    expect(() => parseImportCsv(csv)).toThrow(/Row has 3 cells, expected 16/);
    try {
      parseImportCsv(csv);
    } catch (e) {
      expect((e as CsvError).line).toBe(2);
    }
  });

  it('rejects a file that ends mid-quote', () => {
    const csv = `${header}\nQ-1,F,C,T,"unterminated,,a,b,c,d,a,e,easy,s,2018,ready`;
    expect(() => parseImportCsv(csv)).toThrow(/Unterminated quoted field/);
  });

  it('rejects an empty file', () => {
    expect(() => parseImportCsv('')).toThrow(/File is empty/);
  });
});

describe('parseImportCsv — line numbers (T-057)', () => {
  it('numbers rows from 2, the header being line 1', () => {
    const csv = `${header}\nQ-1,F,C,T,one,,a,b,c,d,a,e,easy,s,2018,ready\nQ-2,F,C,T,two,,a,b,c,d,a,e,easy,s,2018,ready`;
    expect(parseImportCsv(csv).map((p) => p.line)).toEqual([2, 3]);
  });

  // Row index is not line number, and reporting the wrong one sends somebody to
  // edit an innocent row.
  it('counts the newlines inside a quoted field', () => {
    const csv = `${header}\nQ-1,F,C,T,"spans\nthree\nlines",,a,b,c,d,a,e,easy,s,2018,ready\nQ-2,F,C,T,after,,a,b,c,d,a,e,easy,s,2018,ready`;
    const parsed = parseImportCsv(csv);
    expect(parsed[0]!.line).toBe(2);
    expect(parsed[1]!.line).toBe(5);
  });

  it('counts blank lines that were skipped', () => {
    const csv = `${header}\n\n\nQ-1,F,C,T,one,,a,b,c,d,a,e,easy,s,2018,ready`;
    expect(parseImportCsv(csv)[0]!.line).toBe(4);
  });

  it('gives the real template rows their true lines', () => {
    const parsed = parseImportCsv(TEMPLATE);
    expect(parsed[0]!.line).toBe(2);
    // Ascending, and never past the number of lines in the file.
    const lines = parsed.map((p) => p.line);
    expect([...lines].sort((a, b) => a - b)).toEqual(lines);
    expect(Math.max(...lines)).toBeLessThanOrEqual(TEMPLATE.split('\n').length);
  });
});

describe('splitRows', () => {
  it('drops rows that are entirely blank', () => {
    expect(splitRows('a,b\n\n\nc,d\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('keeps a quoted empty field as a real cell', () => {
    expect(splitRows('a,"",c')).toEqual([['a', '', 'c']]);
  });
});
