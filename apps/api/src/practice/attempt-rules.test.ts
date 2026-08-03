import { describe, expect, it } from 'vitest';

import {
  FREE_ATTEMPTS_PER_FIELD,
  freeRemaining,
  MAX_TIME_TAKEN_SEC,
  pacingFor,
  validateSubmission,
} from './attempt-rules';

const ok = (body: object) => {
  const r = validateSubmission(body);
  if (!r.ok) throw new Error(`expected ok, got: ${r.reasons.join('; ')}`);
  return r.submission;
};
const bad = (body: object) => {
  const r = validateSubmission(body);
  if (r.ok) throw new Error('expected rejection');
  return r.reasons;
};

describe('validateSubmission (T-108)', () => {
  it('accepts a well-formed submission', () => {
    const s = ok({ questionId: 'q1', chosenLabel: 'b', timeTakenSec: 42 });
    expect(s).toMatchObject({ questionId: 'q1', chosenLabel: 'B', timeTakenSec: 42 });
    expect(s.timeNote).toBeNull();
  });

  it('requires a question', () => {
    expect(bad({ chosenLabel: 'A' }).join(' ')).toContain('questionId is required');
    expect(bad({ questionId: '  ', chosenLabel: 'A' }).join(' ')).toContain('questionId');
  });

  // An attempt with no answer is a question that was displayed, not an attempt.
  it('requires an answer', () => {
    expect(bad({ questionId: 'q1' }).join(' ')).toContain('not an attempt');
    expect(bad({ questionId: 'q1', chosenLabel: '' }).join(' ')).toContain('not an attempt');
  });

  it('rejects a label outside A–D', () => {
    for (const label of ['E', 'AA', '1', 'a b']) {
      expect(bad({ questionId: 'q1', chosenLabel: label }).join(' ')).toContain('not one of');
    }
  });

  it('rejects a non-string label rather than coercing it', () => {
    expect(bad({ questionId: 'q1', chosenLabel: 1 }).join(' ')).toContain('not an attempt');
  });
});

describe('validateSubmission — duration is clamped, never fatal', () => {
  // timeTakenSec is used only for pacing, never for scoring, so a nonsense
  // duration must not cost a student the answer they just earned.
  const cases: [label: string, input: unknown, expected: number, note: RegExp][] = [
    ['missing', undefined, 0, /no duration/],
    ['null', null, 0, /no duration/],
    ['a string', '30', 0, /not a number/],
    ['NaN', Number.NaN, 0, /not a number/],
    ['Infinity', Number.POSITIVE_INFINITY, 0, /not a number/],
    ['negative', -5, 0, /negative/],
    ['absurd', 999_999, MAX_TIME_TAKEN_SEC, /clamped/],
  ];

  it.each(cases)('accepts a submission with %s duration', (_label, input, expected, note) => {
    const s = ok({ questionId: 'q1', chosenLabel: 'A', timeTakenSec: input });
    expect(s.timeTakenSec).toBe(expected);
    expect(s.timeNote).toMatch(note);
  });

  it('rounds a fractional duration', () => {
    expect(ok({ questionId: 'q1', chosenLabel: 'A', timeTakenSec: 41.6 }).timeTakenSec).toBe(42);
  });

  it('accepts zero as a real duration', () => {
    const s = ok({ questionId: 'q1', chosenLabel: 'A', timeTakenSec: 0 });
    expect(s.timeTakenSec).toBe(0);
    expect(s.timeNote).toBeNull();
  });
});

describe('pacingFor (T-109)', () => {
  it('is within the budget at or under the limit', () => {
    expect(pacingFor(59, 60, true)).toBe('within');
    expect(pacingFor(60, 60, true)).toBe('within');
  });

  it('is over past the limit', () => {
    expect(pacingFor(61, 60, true)).toBe('over');
  });

  // Over the limit is never failure — a student can be over time and correct.
  it('says nothing about correctness', () => {
    expect(pacingFor(300, 60, true)).toBe('over');
    expect(['within', 'over', 'unknown']).toContain(pacingFor(300, 60, true));
  });

  // Better than claiming they were within the limit on the strength of a zero
  // we invented.
  it('is unknown when no usable duration arrived', () => {
    expect(pacingFor(0, 60, false)).toBe('unknown');
    expect(pacingFor(9999, 60, false)).toBe('unknown');
  });
});

describe('freeRemaining (T-111)', () => {
  it('counts down from the allowance', () => {
    expect(freeRemaining(0)).toBe(FREE_ATTEMPTS_PER_FIELD);
    expect(freeRemaining(1)).toBe(9);
    expect(freeRemaining(9)).toBe(1);
    expect(freeRemaining(10)).toBe(0);
  });

  // A limit that reports -3 invites a UI to render "-3 left".
  it('never goes negative', () => {
    expect(freeRemaining(11)).toBe(0);
    expect(freeRemaining(500)).toBe(0);
  });

  it('allows exactly ten', () => {
    expect(FREE_ATTEMPTS_PER_FIELD).toBe(10);
    const used = [...Array(FREE_ATTEMPTS_PER_FIELD).keys()].map((i) => freeRemaining(i));
    expect(used.every((n) => n > 0)).toBe(true);
    expect(freeRemaining(FREE_ATTEMPTS_PER_FIELD)).toBe(0);
  });
});
