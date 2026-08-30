/**
 * The reason check does not print its own answers above itself (T-268).
 *
 * **This is the second time.** The check asks which sentence explains why the
 * answer is right; its correct option is the question's `conceptLine` and its
 * distractors are the `whyWrong` texts of the wrong options. `AnswerView`
 * renders both — the concept line in a highlighted box, the notes as a labelled
 * list — a few centimetres above the picker.
 *
 * The concept line half was found and fixed: `withholdConcept`. The distractors
 * were left, so three of the four options were still on screen, each one
 * captioned as the explanation for an option that was wrong. A student could
 * answer by elimination without reading anything.
 *
 * QA reported it as "distractor rationales are printed twice", which is what it
 * looks like from outside — the duplication is the visible symptom of a check
 * that gives itself away.
 *
 * Read as source text: what is being protected is that two particular props are
 * passed on one particular call, which is exactly what was missing.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { stripComments } from '../../lib/strip-comments';
import { en } from '../../lib/i18n/dictionary';

const here = dirname(fileURLToPath(import.meta.url));
const screen = stripComments(readFileSync(resolve(here, 'PracticeScreen.tsx'), 'utf8'));
const answerView = stripComments(
  readFileSync(resolve(here, '../../components/AnswerView.tsx'), 'utf8'),
);

describe('the reason check (T-255, T-268)', () => {
  it('withholds both halves of its own option list', () => {
    for (const prop of ['withholdConcept', 'withholdWhyWrongs'] as const) {
      expect(screen, prop).toContain(prop);
    }
  });

  /*
   * The condition matters as much as the prop: held only while the check is
   * open and unanswered. Withholding them for good would take the explanation
   * away from everybody, which is the thing being sold.
   */
  it('holds them only while the check is unanswered', () => {
    const held = screen.match(/withhold\w+=\{[^}]*\}/g) ?? [];
    expect(held).toHaveLength(2);
    for (const expression of held) {
      expect(expression).toContain('reasonCheck !== null');
      expect(expression).toContain('reason === null');
    }
  });

  it('says the notes are coming rather than leaving a gap', () => {
    expect(answerView).toContain('whyWrongsAfterReason');
    // A student who does not know they are coming assumes there are none.
    expect(en.practice.whyWrongsAfterReason.toLowerCase()).toContain('once you have');
  });

  it('still renders them once the reason is named', () => {
    expect(answerView).toContain('!withholdWhyWrongs && whyWrongs.length > 0');
  });
});
