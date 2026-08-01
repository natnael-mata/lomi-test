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

describe('publish gate — why-wrong on every distractor (T-041)', () => {
  it('names the option whose why-wrong is missing', () => {
    const q = question({
      options: [
        opt('A', false),
        opt('B', true),
        { label: 'C', text: 'option C', isCorrect: false, whyWrong: '' },
        opt('D', false),
      ],
    });
    expect(gateBlockers(q)).toEqual(['Option C: why it is wrong is missing.']);
  });

  it('treats whitespace as missing', () => {
    const q = question({
      options: [
        opt('A', false),
        opt('B', true),
        { label: 'C', text: 'option C', isCorrect: false, whyWrong: '   \n  ' },
        opt('D', false),
      ],
    });
    expect(gateBlockers(q)).toEqual(['Option C: why it is wrong is missing.']);
  });

  it('treats null and undefined as missing', () => {
    const q = question({
      options: [
        { label: 'A', text: 'a', isCorrect: false, whyWrong: null },
        opt('B', true),
        { label: 'C', text: 'c', isCorrect: false },
        opt('D', false),
      ],
    });
    expect(gateBlockers(q)).toHaveLength(2);
  });

  // The count is what the submit button shows: "3 why-wrongs missing".
  it('reports one blocker per offending option, not a single summary', () => {
    const q = question({
      options: [
        { label: 'A', text: 'a', isCorrect: false, whyWrong: '' },
        opt('B', true),
        { label: 'C', text: 'c', isCorrect: false, whyWrong: '' },
        { label: 'D', text: 'd', isCorrect: false, whyWrong: '' },
      ],
    });
    expect(gateBlockers(q)).toHaveLength(3);
  });

  it('does not require a why-wrong on the correct option', () => {
    const q = question({
      options: [
        opt('A', false),
        { label: 'B', text: 'b', isCorrect: true, whyWrong: null },
        opt('C', false),
        opt('D', false),
      ],
    });
    expect(gateBlockers(q)).toEqual([]);
  });

  // Real imported content: CONTENT-PIPELINE.md says no source file carries any
  // authored explanation, so a freshly imported question blocks on every
  // distractor. This test pins that expectation rather than leaving it a surprise.
  it('blocks a freshly imported question on all three distractors', () => {
    const imported = question({
      options: [
        { label: 'A', text: '172,500', isCorrect: false },
        { label: 'B', text: '150,000', isCorrect: true },
        { label: 'C', text: '15,000', isCorrect: false },
        { label: 'D', text: '1,000,000', isCorrect: false },
      ],
    });
    expect(gateBlockers(imported)).toEqual([
      'Option A: why it is wrong is missing.',
      'Option C: why it is wrong is missing.',
      'Option D: why it is wrong is missing.',
    ]);
  });
});

describe('publish gate — single-sentence concept line (T-042)', () => {
  const withConcept = (conceptLine: string | null) => gateBlockers(question({ conceptLine }));

  it('accepts a single sentence', () => {
    expect(withConcept('A single sentence.')).toEqual([]);
  });

  it('rejects two sentences', () => {
    expect(withConcept('A. B.')).toEqual([
      'Concept line must be a single sentence — split it or shorten it.',
    ]);
  });

  it('rejects a missing concept line', () => {
    expect(withConcept('')).toEqual(['Concept line is missing.']);
    expect(withConcept(null)).toEqual(['Concept line is missing.']);
    expect(withConcept('   ')).toEqual(['Concept line is missing.']);
  });

  it('accepts a sentence with no terminal punctuation', () => {
    expect(withConcept('VAT inside an inclusive price is extracted with ×15/115')).toEqual([]);
  });

  // A decimal is not a sentence boundary — there is no space after the point.
  it('accepts a sentence containing a decimal', () => {
    expect(withConcept('Divide the inclusive amount by 1.15 to strip VAT.')).toEqual([]);
  });

  // A naive /[.!?]\s+\S/ would call this two sentences and reject a good line.
  it('accepts abbreviations that end in a period', () => {
    expect(withConcept('Extract with ×15/115, e.g. 1,150,000 becomes 150,000.')).toEqual([]);
    expect(withConcept('Use the inclusive divisor, i.e. 1.15, not 0.85.')).toEqual([]);
    expect(withConcept('Applies to VAT, sales tax, etc. in the same way.')).toEqual([]);
  });

  it('still rejects two real sentences that also contain an abbreviation', () => {
    expect(
      withConcept('Divide by 1.15, e.g. 977,500 becomes 850,000. Never multiply by 0.85.'),
    ).toEqual(['Concept line must be a single sentence — split it or shorten it.']);
  });

  it('rejects a question mark followed by another sentence', () => {
    expect(withConcept('What is the divisor? It is 1.15.')).toEqual([
      'Concept line must be a single sentence — split it or shorten it.',
    ]);
  });

  // Regression: "no" was on the abbreviation list, which masked the sentence
  // end in "The answer is no." and let two plain sentences through. Every entry
  // on that list costs real detection, so common words must stay off it.
  it('does not let a common word ending in a period hide a second sentence', () => {
    expect(withConcept('The answer is no. It is not deductible.')).toEqual([
      'Concept line must be a single sentence — split it or shorten it.',
    ]);
  });
});
