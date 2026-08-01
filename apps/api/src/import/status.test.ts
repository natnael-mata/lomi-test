import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseImportCsv } from './parse-csv';
import { claimsReady, parseStatuses } from './status';

function repoFile(relative: string): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = resolve(dir, relative);
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  throw new Error(`could not locate ${relative}`);
}

describe('parseStatuses (T-052)', () => {
  it('parses a semicolon-combined cell into a 2-element array', () => {
    const { statuses } = parseStatuses('needs_answer;needs_explanation');
    expect(statuses).toEqual(['needs_answer', 'needs_explanation']);
    expect(statuses).toHaveLength(2);
  });

  it('parses the real template row that carries three flags', () => {
    const rows = parseImportCsv(
      readFileSync(repoFile('docs/question_import_template.csv'), 'utf8'),
    ).map((p) => p.row);
    const geo = rows.find((r) => r.question_id === 'GEO-0001')!;
    expect(parseStatuses(geo.status).statuses).toEqual([
      'needs_answer',
      'needs_explanation',
      'needs_topic_review',
    ]);
  });

  it('parses every status cell in the real template without an unknown value', () => {
    const rows = parseImportCsv(
      readFileSync(repoFile('docs/question_import_template.csv'), 'utf8'),
    ).map((p) => p.row);
    for (const row of rows) {
      expect(parseStatuses(row.status).unknown).toEqual([]);
    }
  });

  it('parses a single value', () => {
    expect(parseStatuses('ready').statuses).toEqual(['ready']);
  });

  it('tolerates spacing and case, which spreadsheets introduce freely', () => {
    expect(parseStatuses(' Needs_Answer ; RAW ').statuses).toEqual(['raw', 'needs_answer']);
  });

  it('returns flags in canonical order regardless of the order in the file', () => {
    const a = parseStatuses('needs_topic_review;needs_answer').statuses;
    const b = parseStatuses('needs_answer;needs_topic_review').statuses;
    expect(a).toEqual(b);
  });

  it('dedupes a repeated flag', () => {
    expect(parseStatuses('needs_answer;needs_answer').statuses).toEqual(['needs_answer']);
  });

  it('ignores empty segments from a trailing or doubled separator', () => {
    expect(parseStatuses('raw;;').statuses).toEqual(['raw']);
  });

  // Silence must never be read as approval.
  it('treats a blank cell as raw, not ready', () => {
    for (const blank of ['', '   ', ';']) {
      expect(parseStatuses(blank).statuses).toEqual(['raw']);
    }
  });

  it('keeps an unrecognised value for the report instead of dropping it silently', () => {
    const { statuses, unknown } = parseStatuses('needs_answer;needs_pictures');
    expect(unknown).toEqual(['needs_pictures']);
    expect(statuses).toEqual(['needs_answer']);
  });

  it('falls back to raw when nothing in the cell was recognised', () => {
    const { statuses, unknown } = parseStatuses('done;approved');
    expect(statuses).toEqual(['raw']);
    expect(unknown).toEqual(['done', 'approved']);
  });

  it('dedupes a repeated unknown value', () => {
    expect(parseStatuses('nope;nope').unknown).toEqual(['nope']);
  });

  it('flags "ready" combined with outstanding work, without rejecting the row', () => {
    const { statuses, contradictions } = parseStatuses('ready;needs_answer');
    expect(statuses).toEqual(['needs_answer', 'ready']);
    expect(contradictions).toHaveLength(1);
    expect(contradictions[0]).toContain('needs_answer');
  });

  it('reports no contradiction for a plain ready row', () => {
    expect(parseStatuses('ready').contradictions).toEqual([]);
  });
});

describe('claimsReady', () => {
  it('is true only for a clean ready', () => {
    expect(claimsReady(parseStatuses('ready').statuses)).toBe(true);
  });

  it('is false when work is still outstanding, even if ready is present', () => {
    expect(claimsReady(parseStatuses('ready;needs_explanation').statuses)).toBe(false);
  });

  it('is false for raw and for a blank cell', () => {
    expect(claimsReady(parseStatuses('raw').statuses)).toBe(false);
    expect(claimsReady(parseStatuses('').statuses)).toBe(false);
  });
});
