import { describe, expect, it } from 'vitest';

import { formatReport } from './format-report';
import type { ImportReport } from './import.service';

const report = (over: Partial<ImportReport> = {}): ImportReport => ({
  read: 0,
  created: 0,
  updated: 0,
  rejected: 0,
  rows: [],
  ...over,
});

describe('formatReport (T-056)', () => {
  it('leads with the four counts', () => {
    const out = formatReport(report({ read: 7, created: 5, updated: 1, rejected: 1 }));
    expect(out.split('\n')[0]).toBe('read 7 · created 5 · updated 1 · rejected 1');
  });

  it('lists every rejected row with its reasons', () => {
    const out = formatReport(
      report({
        read: 1,
        rejected: 1,
        rows: [
          {
            stableId: 'AF-9999',
            line: 4,
            action: 'rejected',
            messages: [
              'question_text is blank — there is no question',
              'only 1 option(s) supplied',
            ],
          },
        ],
      }),
    );
    expect(out).toContain('rejected (1) — not imported:');
    expect(out).toContain('AF-9999');
    expect(out).toContain('- question_text is blank');
    expect(out).toContain('- only 1 option(s) supplied');
  });

  it('separates rows that imported but carry notes', () => {
    const out = formatReport(
      report({
        read: 1,
        created: 1,
        rows: [
          {
            stableId: 'GEO-0001',
            line: 3,
            action: 'created',
            messages: ['no course — staged under Unsorted'],
          },
        ],
      }),
    );
    expect(out).toContain('imported with notes (1):');
    expect(out).toContain('staged under Unsorted');
    expect(out).not.toContain('rejected (');
  });

  it('stays quiet when a clean run had nothing to say', () => {
    const out = formatReport(
      report({
        read: 2,
        created: 2,
        rows: [
          { stableId: 'A-1', line: 2, action: 'created', messages: [] },
          { stableId: 'A-2', line: 3, action: 'created', messages: [] },
        ],
      }),
    );
    expect(out).toContain('nothing to report.');
  });

  // On a 500-row ministry file, a note that fires on every row buries the two
  // rows that actually need a human.
  it('states a note shared by many rows once, instead of on every row', () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      stableId: `A-${i}`,
      line: i + 2,
      action: 'created' as const,
      messages: ['difficulty "easy" is not stored yet'],
    }));
    rows[3]!.messages = [...rows[3]!.messages, 'no course — staged under Unsorted'];

    const out = formatReport(report({ read: 12, created: 12, rows }));
    expect(out).toContain('12 rows: difficulty "easy" is not stored yet');
    expect(out).not.toContain('  A-0');
    // The one row that is genuinely different is still called out by name.
    expect(out).toContain('A-3');
    expect(out).toContain('staged under Unsorted');
  });

  it('keeps a note per-row while only a few rows carry it', () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      stableId: `A-${i}`,
      line: i + 2,
      action: 'created' as const,
      messages: ['year "n/a" is not a usable year — dropped'],
    }));
    const out = formatReport(report({ read: 3, created: 3, rows }));
    expect(out).not.toContain('3 rows:');
    expect(out).toContain('A-0');
    expect(out).toContain('A-2');
  });

  it('names both kinds in one run without mixing them up', () => {
    const out = formatReport(
      report({
        read: 2,
        created: 1,
        rejected: 1,
        rows: [
          {
            stableId: 'GOOD-1',
            line: 2,
            action: 'created',
            messages: ['difficulty "easy" is not stored yet'],
          },
          { stableId: 'BAD-1', line: 3, action: 'rejected', messages: ['field is blank'] },
        ],
      }),
    );
    const rejectedAt = out.indexOf('rejected (1)');
    const notesAt = out.indexOf('imported with notes (1)');
    expect(rejectedAt).toBeGreaterThan(-1);
    expect(notesAt).toBeGreaterThan(rejectedAt); // failures first, they are what needs acting on
    expect(out.slice(rejectedAt, notesAt)).toContain('BAD-1');
    expect(out.slice(notesAt)).toContain('GOOD-1');
  });
});
