import { describe, expect, it } from 'vitest';

import { gateBlockers, isPublishable, type DraftOption, type DraftQuestion } from './publish-gate';

const opt = (label: DraftOption['label'], isCorrect: boolean): DraftOption => ({
  label,
  text: `option ${label}`,
  isCorrect,
  whyWrong: isCorrect ? null : `why ${label} is wrong`,
});

/** AF-0003's shape: four options, exactly one correct. */
const question = (overrides: Partial<DraftQuestion> = {}): DraftQuestion => ({
  qType: 'CONCEPT',
  stem: 'A retailer sells goods for Br 1,150,000 VAT inclusive (15%). How much VAT?',
  conceptLine: 'VAT inside an inclusive price is extracted with ×15/115.',
  explanation: 'Extract with ×15/115, not 15% of the gross.',
  timeLimitSec: 60,
  options: [opt('A', false), opt('B', true), opt('C', false), opt('D', false)],
  ...overrides,
});

describe('publish gate — exactly one correct option (T-040)', () => {
  it('passes with exactly one correct option', () => {
    expect(gateBlockers(question())).toEqual([]);
    expect(isPublishable(question())).toBe(true);
  });

  it('blocks when no option is marked correct', () => {
    const q = question({
      options: [opt('A', false), opt('B', false), opt('C', false), opt('D', false)],
    });
    expect(isPublishable(q)).toBe(false);
    expect(gateBlockers(q)[0]).toContain('No correct option marked');
  });

  // Two correct answers is worse than none: a student who picks the "other"
  // correct option is marked wrong and shown a why-wrong for an answer that was
  // right. Nothing surfaces this to a reviewer except the gate.
  it('blocks when two options are marked correct, naming which', () => {
    const q = question({
      options: [opt('A', true), opt('B', true), opt('C', false), opt('D', false)],
    });
    expect(isPublishable(q)).toBe(false);
    expect(gateBlockers(q)[0]).toContain('have 2: A, B');
  });

  it('blocks when every option is marked correct', () => {
    const q = question({
      options: [opt('A', true), opt('B', true), opt('C', true), opt('D', true)],
    });
    expect(gateBlockers(q)[0]).toContain('have 4: A, B, C, D');
  });

  it('returns all blockers rather than throwing on the first', () => {
    // The reviewer UI lists what is left; a gate that throws shows one at a time.
    expect(Array.isArray(gateBlockers(question()))).toBe(true);
  });
});
