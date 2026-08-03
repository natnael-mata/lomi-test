import { describe, expect, it } from 'vitest';

import {
  ANSWER_SECTIONS,
  isOwnAnswer,
  orderWhyWrongs,
  verdictFor,
  verdictWord,
  type AnswerOption,
} from './answer-order';

const option = (label: string, isCorrect = false): AnswerOption => ({
  label,
  text: `text ${label}`,
  isCorrect,
  whyWrong: isCorrect ? null : `why ${label} is wrong`,
});

const OPTIONS = [option('A'), option('B', true), option('C'), option('D')];

describe('the fixed answer order (T-113)', () => {
  it('is verdict, concept, solution, why-wrongs', () => {
    expect([...ANSWER_SECTIONS]).toEqual(['verdict', 'concept', 'solution', 'why-wrongs']);
  });
});

describe('orderWhyWrongs (T-115)', () => {
  // The card explaining the mistake they actually made comes first; third means
  // scanning four cards while already feeling stupid.
  it('puts the student’s own wrong answer first', () => {
    expect(orderWhyWrongs(OPTIONS, 'D').map((o) => o.label)).toEqual(['D', 'A', 'C']);
    expect(orderWhyWrongs(OPTIONS, 'C').map((o) => o.label)).toEqual(['C', 'A', 'D']);
  });

  it('keeps the rest in A–D order, so the list stays predictable', () => {
    expect(orderWhyWrongs(OPTIONS, 'A').map((o) => o.label)).toEqual(['A', 'C', 'D']);
  });

  // The right answer is not a why-wrong. It is not wrong.
  it('never includes the correct option', () => {
    for (const chosen of ['A', 'B', 'C', 'D', null]) {
      expect(orderWhyWrongs(OPTIONS, chosen).map((o) => o.label)).not.toContain('B');
    }
  });

  it('falls back to A–D when the student got it right', () => {
    expect(orderWhyWrongs(OPTIONS, 'B').map((o) => o.label)).toEqual(['A', 'C', 'D']);
  });

  it('handles no choice at all — a reviewer looking at the question', () => {
    expect(orderWhyWrongs(OPTIONS, null).map((o) => o.label)).toEqual(['A', 'C', 'D']);
  });

  it('does not mutate the input', () => {
    const input = [...OPTIONS];
    orderWhyWrongs(input, 'D');
    expect(input.map((o) => o.label)).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('isOwnAnswer', () => {
  it('marks only the chosen card', () => {
    expect(isOwnAnswer(option('D'), 'D')).toBe(true);
    expect(isOwnAnswer(option('A'), 'D')).toBe(false);
    expect(isOwnAnswer(option('D'), null)).toBe(false);
  });
});

describe('verdictFor', () => {
  it('is correct when right and within the budget', () => {
    expect(verdictFor(true, 'within')).toBe('correct');
    expect(verdictFor(true, 'unknown')).toBe('correct');
  });

  // Over time is pacing, never failure — a student who got it right slowly has
  // still got it right.
  it('is pending, not wrong, when right but over time', () => {
    expect(verdictFor(true, 'over')).toBe('pending');
    expect(verdictWord('pending')).toContain('Correct');
  });

  it('is wrong when wrong, whatever the pacing', () => {
    for (const pacing of ['within', 'over', 'unknown']) {
      expect(verdictFor(false, pacing)).toBe('wrong');
    }
  });

  it('never calls a correct answer a failure', () => {
    for (const pacing of ['within', 'over', 'unknown']) {
      expect(verdictWord(verdictFor(true, pacing))).toMatch(/^Correct/);
    }
  });
});
