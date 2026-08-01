import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ImportRow } from './csv-schema';
import { inferQType, mapRow, UNSORTED } from './map-row';
import { parseImportCsv } from './parse-csv';

function repoFile(relative: string): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = resolve(dir, relative);
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  throw new Error(`could not locate ${relative}`);
}

const TEMPLATE = parseImportCsv(
  readFileSync(repoFile('docs/question_import_template.csv'), 'utf8'),
);

function row(overrides: Partial<ImportRow> = {}): ImportRow {
  return {
    question_id: 'T-0001',
    field: 'Accounting & Finance',
    course: 'Taxation',
    topic: 'VAT',
    question_text: 'Which statement about VAT is correct?',
    code_block: '',
    option_a: 'One',
    option_b: 'Two',
    option_c: 'Three',
    option_d: 'Four',
    correct_option: 'a',
    explanation: 'Because one.',
    difficulty: '',
    source: 'authored',
    year: '',
    status: 'ready',
    ...overrides,
  };
}

function mapped(overrides: Partial<ImportRow> = {}) {
  const result = mapRow(row(overrides));
  if (!result.ok) throw new Error(`expected ok, got: ${result.reasons.join('; ')}`);
  return result.row;
}

function rejected(overrides: Partial<ImportRow> = {}) {
  const result = mapRow(row(overrides));
  if (result.ok) throw new Error('expected rejection');
  return result.reasons;
}

describe('mapRow — staging incomplete rows (T-053)', () => {
  it('accepts a blank correct_option and flags NEEDS_ANSWER', () => {
    const m = mapped({ correct_option: '' });
    expect(m.flags).toContain('NEEDS_ANSWER');
    expect(m.options.every((o) => !o.isCorrect)).toBe(true);
  });

  it('accepts a blank explanation and flags NEEDS_EXPLANATION', () => {
    const m = mapped({ explanation: '' });
    expect(m.flags).toContain('NEEDS_EXPLANATION');
    expect(m.explanation).toBeNull();
  });

  it('accepts a blank course, staging it under Unsorted', () => {
    const m = mapped({ course: '' });
    expect(m.course).toBe(UNSORTED);
    expect(m.topic).toBe('VAT');
    expect(m.flags).toContain('NEEDS_TOPIC_REVIEW');
    expect(m.notes.join(' ')).toContain('no course');
  });

  it('accepts a blank topic too', () => {
    const m = mapped({ topic: '' });
    expect(m.topic).toBe(UNSORTED);
    expect(m.flags).toContain('NEEDS_TOPIC_REVIEW');
  });

  it('accepts all three blank at once', () => {
    const m = mapped({ correct_option: '', explanation: '', course: '', topic: '' });
    expect([...m.flags].sort()).toEqual([
      'NEEDS_ANSWER',
      'NEEDS_EXPLANATION',
      'NEEDS_TOPIC_REVIEW',
      'READY',
    ]);
  });

  // The correction that matters: a file's claim loses to what is actually there.
  it('overrides a "ready" claim when the answer is missing', () => {
    const m = mapped({ status: 'ready', correct_option: '' });
    expect(m.flags).toContain('READY');
    expect(m.flags).toContain('NEEDS_ANSWER');
  });

  it("carries the file's own flags through", () => {
    const m = mapped({ status: 'needs_topic_review', correct_option: 'a', explanation: 'x' });
    expect(m.flags).toEqual(['NEEDS_TOPIC_REVIEW']);
  });

  it('returns flags in a stable order so two runs compare equal', () => {
    const a = mapped({ status: 'needs_explanation;raw', explanation: '' }).flags;
    const b = mapped({ status: 'raw;needs_explanation', explanation: '' }).flags;
    expect(a).toEqual(b);
  });
});

describe('mapRow — rejections are for rows nobody could finish', () => {
  it('rejects a blank question_id', () => {
    expect(rejected({ question_id: '  ' }).join(' ')).toContain('question_id is blank');
  });

  it('rejects a blank question_text', () => {
    expect(rejected({ question_text: '' }).join(' ')).toContain('there is no question');
  });

  it('rejects a blank field, because a question in no programme is unservable', () => {
    expect(rejected({ field: '' }).join(' ')).toContain('field is blank');
  });

  it('rejects a field with nothing sluggable in it', () => {
    expect(rejected({ field: '???' }).join(' ')).toContain('no letters or digits');
  });

  it('rejects fewer than two options', () => {
    const reasons = rejected({ option_b: '', option_c: '', option_d: '', correct_option: 'a' });
    expect(reasons.join(' ')).toContain('only 1 option(s)');
  });

  it('rejects a correct_option outside a–d', () => {
    expect(rejected({ correct_option: 'e' }).join(' ')).toContain('not one of a, b, c, d');
  });

  it('rejects an answer that points at an empty option', () => {
    expect(rejected({ option_d: '', correct_option: 'd' }).join(' ')).toContain('has no text');
  });

  it('reports every reason at once, not just the first', () => {
    const reasons = rejected({ question_id: '', question_text: '', field: '' });
    expect(reasons).toHaveLength(3);
  });

  it('names the row even when the id is what is missing', () => {
    const result = mapRow(row({ question_id: '' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.stableId).toBe('(no id)');
  });
});

describe('mapRow — field handling', () => {
  it('trims surrounding whitespace, which spreadsheets add freely', () => {
    const m = mapped({ question_id: ' T-9 ', field: ' Geography ', question_text: ' Why? ' });
    expect(m.stableId).toBe('T-9');
    expect(m.field).toBe('Geography');
    expect(m.stem).toBe('Why?');
  });

  it('marks only the named option correct, case-insensitively', () => {
    const m = mapped({ correct_option: 'C' });
    expect(m.options.filter((o) => o.isCorrect).map((o) => o.label)).toEqual(['C']);
  });

  it('omits empty options rather than storing blank choices', () => {
    const m = mapped({ option_d: '', correct_option: 'a' });
    expect(m.options.map((o) => o.label)).toEqual(['A', 'B', 'C']);
  });

  it('keeps a usable year and drops an unusable one with a note', () => {
    expect(mapped({ year: '2018' }).year).toBe(2018);
    const bad = mapped({ year: 'n/a' });
    expect(bad.year).toBeNull();
    expect(bad.notes.join(' ')).toContain('not a usable year');
  });

  it('says out loud that difficulty is not stored yet', () => {
    expect(mapped({ difficulty: 'easy' }).notes.join(' ')).toContain('difficulty');
  });

  it('nulls empty optional text rather than storing an empty string', () => {
    const m = mapped({ code_block: '', explanation: '', source: '' });
    expect(m.codeBlock).toBeNull();
    expect(m.explanation).toBeNull();
    expect(m.sourceRef).toBeNull();
  });
});

describe('inferQType', () => {
  it('reads a quantity question as CALCULATION', () => {
    expect(inferQType('How much VAT is contained in that amount?', [])).toBe('CALCULATION');
    expect(inferQType('What is the VAT liability/refund?', [])).toBe('CALCULATION');
  });

  it('reads numeric options as CALCULATION even when the stem is plain', () => {
    expect(inferQType('Select the amount.', ['172,500', 'Br 150,000', '15,000', 'None'])).toBe(
      'CALCULATION',
    );
  });

  it('reads a prose question with prose options as CONCEPT', () => {
    expect(
      inferQType('What problem does this CSS solve?', ['Removes bullets', 'Aligns right']),
    ).toBe('CONCEPT');
  });

  it('classifies the real template exactly: 5 calculations, 2 concepts', () => {
    const byType = TEMPLATE.map((r) => {
      const m = mapRow(r);
      if (!m.ok) throw new Error(`template row ${r.question_id} rejected`);
      return [r.question_id, m.row.qType] as const;
    });
    expect(byType).toEqual([
      ['CS-0001', 'CONCEPT'],
      ['GEO-0001', 'CONCEPT'],
      ['AF-0001', 'CALCULATION'],
      ['AF-0002', 'CALCULATION'],
      ['AF-0003', 'CALCULATION'],
      ['AF-0004', 'CALCULATION'],
      ['AF-0005', 'CALCULATION'],
    ]);
  });

  it('applies the D4 pacing budget that follows from the type', () => {
    expect(mapped({ question_text: 'How much VAT?' }).timeLimitSec).toBe(180);
    expect(mapped().timeLimitSec).toBe(60);
  });
});

describe('mapRow — the real template', () => {
  it('accepts all 7 rows', () => {
    expect(TEMPLATE.map(mapRow).filter((r) => r.ok)).toHaveLength(7);
  });

  it('stages GEO-0001, the deliberately unfinished row', () => {
    const geo = mapRow(TEMPLATE.find((r) => r.question_id === 'GEO-0001')!);
    expect(geo.ok).toBe(true);
    if (!geo.ok) return;
    expect(geo.row.flags).toContain('NEEDS_ANSWER');
    expect(geo.row.flags).toContain('NEEDS_EXPLANATION');
    expect(geo.row.options).toHaveLength(4);
    expect(geo.row.options.some((o) => o.isCorrect)).toBe(false);
  });

  it('leaves the finished Accounting rows with no outstanding work', () => {
    const af = mapRow(TEMPLATE.find((r) => r.question_id === 'AF-0001')!);
    if (!af.ok) throw new Error('AF-0001 rejected');
    expect(af.row.flags).toEqual(['READY']);
  });
});
