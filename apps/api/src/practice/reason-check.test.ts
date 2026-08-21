/**
 * Unit test — the reason check (T-255).
 *
 * The rules worth pinning are all about what the check refuses to do: it does
 * not invent distractors, it does not offer a coin toss, and it does not leak
 * which choice is right through the id.
 */
import { describe, expect, it } from 'vitest';

import { MIN_DISTRACTORS, buildReasonCheck, isReasonCorrect } from './reason-check';

const SECRET = 'test-secret-not-a-real-one';
/** Identity ordering, so assertions can talk about positions. */
const asIs = <T>(items: T[]): T[] => items;

const question = (over: Partial<Parameters<typeof buildReasonCheck>[2]> = {}) => ({
  conceptLine: 'Oxidation is the loss of electrons.',
  options: [
    { label: 'A', isCorrect: true, whyWrong: null },
    { label: 'B', isCorrect: false, whyWrong: 'That describes reduction, which is the gain.' },
    { label: 'C', isCorrect: false, whyWrong: 'That is a change of state, not of charge.' },
    { label: 'D', isCorrect: false, whyWrong: 'That is the definition of a catalyst.' },
  ],
  ...over,
});

describe('buildReasonCheck', () => {
  it('offers the concept line and the why-wrongs, and nothing invented', () => {
    const check = buildReasonCheck(SECRET, 'att-1', question(), asIs);
    const texts = check!.options.map((o) => o.text);

    expect(texts).toContain('Oxidation is the loss of electrons.');
    expect(texts).toHaveLength(4);
    // Every distractor is a sentence somebody wrote and reviewed. Nothing here
    // is generated, so nothing can be accidentally right.
    for (const text of texts.slice(1)) {
      expect(question().options.map((o) => o.whyWrong)).toContain(text);
    }
  });

  it('refuses when there is no concept line to be right', () => {
    expect(buildReasonCheck(SECRET, 'att-1', question({ conceptLine: null }), asIs)).toBeNull();
    expect(buildReasonCheck(SECRET, 'att-1', question({ conceptLine: '   ' }), asIs)).toBeNull();
  });

  /*
   * The coin-toss rule.
   *
   * One right answer and one wrong one lets half of all guesses count as
   * evidence of understanding — which is the exact failure the check exists to
   * prevent, reintroduced by a question whose content is unfinished.
   */
  it('refuses a coin toss', () => {
    const thin = question({
      options: [
        { label: 'A', isCorrect: true, whyWrong: null },
        { label: 'B', isCorrect: false, whyWrong: 'Only one alternative.' },
        { label: 'C', isCorrect: false, whyWrong: null },
        { label: 'D', isCorrect: false, whyWrong: '' },
      ],
    });
    expect(buildReasonCheck(SECRET, 'att-1', thin, asIs)).toBeNull();
    expect(MIN_DISTRACTORS).toBe(2);
  });

  it('does not offer the same sentence twice', () => {
    const repeated = question({
      options: [
        { label: 'A', isCorrect: true, whyWrong: null },
        { label: 'B', isCorrect: false, whyWrong: 'Same reason.' },
        { label: 'C', isCorrect: false, whyWrong: 'Same reason.' },
        { label: 'D', isCorrect: false, whyWrong: 'A different reason.' },
      ],
    });
    const check = buildReasonCheck(SECRET, 'att-1', repeated, asIs);
    expect(new Set(check!.options.map((o) => o.text)).size).toBe(check!.options.length);
  });

  it('drops a why-wrong that repeats the concept line rather than contradicting it', () => {
    const echoing = question({
      options: [
        { label: 'A', isCorrect: true, whyWrong: null },
        { label: 'B', isCorrect: false, whyWrong: 'Oxidation is the loss of electrons.' },
        { label: 'C', isCorrect: false, whyWrong: 'That is reduction.' },
        { label: 'D', isCorrect: false, whyWrong: 'That is a catalyst.' },
      ],
    });
    const check = buildReasonCheck(SECRET, 'att-1', echoing, asIs);
    // Two identical texts, one graded right and one graded wrong, is a question
    // with no correct answer.
    expect(
      check!.options.filter((o) => o.text === 'Oxidation is the loss of electrons.'),
    ).toHaveLength(1);
  });
});

describe('the id gives nothing away', () => {
  it('is not the source name', () => {
    const check = buildReasonCheck(SECRET, 'att-1', question(), asIs);
    for (const option of check!.options) {
      expect(option.id).not.toContain('concept');
      expect(option.id).not.toContain('why');
      expect(option.id).toMatch(/^[0-9a-f]{16}$/);
    }
  });

  /*
   * The replay rule.
   *
   * If the right id were a function of the text alone, a student could answer
   * one question, note the winning id, and post it against every later attempt
   * on the same question. Keying on the attempt makes each check its own.
   */
  it('differs between attempts on the same question', () => {
    const first = buildReasonCheck(SECRET, 'att-1', question(), asIs)!;
    const second = buildReasonCheck(SECRET, 'att-2', question(), asIs)!;
    expect(first.options[0]!.id).not.toBe(second.options[0]!.id);
    expect(isReasonCorrect(SECRET, 'att-2', question().conceptLine, first.options[0]!.id)).toBe(
      false,
    );
  });
});

describe('isReasonCorrect', () => {
  const concept = question().conceptLine;

  it('accepts the concept line and refuses every distractor', () => {
    const check = buildReasonCheck(SECRET, 'att-1', question(), asIs)!;
    const [right, ...wrong] = check.options;

    expect(isReasonCorrect(SECRET, 'att-1', concept, right!.id)).toBe(true);
    for (const option of wrong) {
      expect(isReasonCorrect(SECRET, 'att-1', concept, option.id)).toBe(false);
    }
  });

  it('refuses a made-up id, and one signed with another secret', () => {
    expect(isReasonCorrect(SECRET, 'att-1', concept, 'deadbeefdeadbeef')).toBe(false);
    const forged = buildReasonCheck('another-secret', 'att-1', question(), asIs)!;
    expect(isReasonCorrect(SECRET, 'att-1', concept, forged.options[0]!.id)).toBe(false);
  });

  it('refuses everything when the question has no concept line', () => {
    expect(isReasonCorrect(SECRET, 'att-1', null, 'anything')).toBe(false);
  });
});
