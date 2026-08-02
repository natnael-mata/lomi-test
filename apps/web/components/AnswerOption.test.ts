import { describe, expect, it } from 'vitest';

import { ariaCheckedFor, verdictWordFor, type OptionState } from './AnswerOption';
import { tabStopIndex } from './AnswerOptionGroup';

const STATES: OptionState[] = ['default', 'selected', 'correct', 'wrong'];

describe('ariaCheckedFor (T-094)', () => {
  // The rule the component exists to hold: what is painted and what is
  // announced are derived from one value, so they cannot drift.
  it('announces a selected row as checked', () => {
    expect(ariaCheckedFor('selected', false)).toBe(true);
  });

  it('announces an untouched row as unchecked', () => {
    expect(ariaCheckedFor('default', false)).toBe(false);
  });

  it("announces the student's wrong row as checked — it is what they chose", () => {
    expect(ariaCheckedFor('wrong', true)).toBe(true);
  });

  // The case that would otherwise tell a student they picked the right answer
  // when they did not.
  it('does not announce the correct row as checked unless it was chosen', () => {
    expect(ariaCheckedFor('correct', false)).toBe(false);
    expect(ariaCheckedFor('correct', true)).toBe(true);
  });

  it('answers for every state', () => {
    for (const state of STATES) {
      expect(typeof ariaCheckedFor(state, false)).toBe('boolean');
      expect(typeof ariaCheckedFor(state, true)).toBe('boolean');
    }
  });
});

describe('verdictWordFor', () => {
  it('labels the correct row', () => {
    expect(verdictWordFor('correct', false)).toBe('Correct');
    expect(verdictWordFor('correct', true)).toBe('Correct');
  });

  it("labels the student's own wrong row", () => {
    expect(verdictWordFor('wrong', true)).toBe('Yours');
  });

  // A distractor nobody picked is just a distractor; "Yours" on it would be a
  // lie about what happened.
  it('says nothing on a wrong row the student did not choose', () => {
    expect(verdictWordFor('wrong', false)).toBeNull();
  });

  it('says nothing before the question is answered', () => {
    expect(verdictWordFor('default', false)).toBeNull();
    expect(verdictWordFor('selected', true)).toBeNull();
  });
});

describe('tabStopIndex (T-094)', () => {
  const choice = (label: 'A' | 'B' | 'C' | 'D', state?: OptionState, wasChosen?: boolean) => ({
    label,
    text: label,
    ...(state ? { state } : {}),
    ...(wasChosen !== undefined ? { wasChosen } : {}),
  });

  it('is the first row when nothing is chosen', () => {
    expect(tabStopIndex([choice('A'), choice('B'), choice('C'), choice('D')])).toBe(0);
  });

  // The bug this function exists to prevent: computed per-option, both A and the
  // selected row claimed tabIndex 0, so the group had two tab stops.
  it('is the selected row, not also the first', () => {
    const choices = [choice('A'), choice('B', 'selected'), choice('C'), choice('D')];
    expect(tabStopIndex(choices)).toBe(1);
  });

  it("is the student's own row after answering", () => {
    const choices = [choice('A'), choice('B', 'wrong', true), choice('C', 'correct'), choice('D')];
    expect(tabStopIndex(choices)).toBe(1);
  });

  it('never returns more than one stop, for any single-selection arrangement', () => {
    const arrangements: OptionState[][] = [
      ['default', 'default', 'default', 'default'],
      ['selected', 'default', 'default', 'default'],
      ['default', 'default', 'default', 'selected'],
      ['default', 'wrong', 'correct', 'default'],
    ];
    for (const states of arrangements) {
      const choices = states.map((state, i) =>
        choice((['A', 'B', 'C', 'D'] as const)[i]!, state, state === 'wrong'),
      );
      const index = tabStopIndex(choices);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(4);
    }
  });
});
