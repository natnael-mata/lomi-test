/**
 * The programme chooser (T-166, redesigned 2026-10-01).
 *
 * Read as source text rather than mounted, like the other screen guards here:
 * what these protect is that a particular branch exists around a particular
 * piece of copy, which is exactly the kind of thing that regresses when a screen
 * is restyled.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { stripComments } from '../../lib/strip-comments';
import { en } from '../../lib/i18n/dictionary';

const screen = stripComments(
  readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), 'ChooseProgrammeScreen.tsx'),
    'utf8',
  ),
);

describe('choosing a programme', () => {
  it('still has code left after the comments are stripped', () => {
    expect(screen).toContain('api.chooseField');
    expect(screen.length).toBeGreaterThan(1500);
  });

  /**
   * The grid is still a radio group (redesign).
   *
   * The handoff draws the programmes as pressable tiles, and the obvious way to
   * build a tile is `<button>`. That would cost the whole group: one tab stop
   * rather than eight, arrow-key movement, and a screen reader announcing "radio
   * group, 3 of 8". The input is `sr-only` — hidden, never removed.
   */
  it('keeps real radios under the tiles', () => {
    expect(screen).toContain('type="radio"');
    expect(screen).toContain('sr-only');
    expect(screen).toContain('<fieldset');
    expect(screen).toContain('<legend');
    // The thing that would quietly throw the semantics away.
    expect(screen).not.toMatch(/<button[^>]*onClick=\{\(\) => setChosen/);
  });

  /**
   * The retaker question is asked only where there is an exam to have sat
   * (T-268).
   *
   * It used to be on screen whatever was selected, including Grade 6 and Grade
   * 8. And nothing is sent for a school track, so `isRetaker` stays unset rather
   * than being recorded as a `false` from somebody never asked.
   */
  it('does not ask a Grade 6 pupil about retaking the exit exam', () => {
    expect(screen).toContain('isSchoolTrack ? null :');
    expect(screen).toContain('maxGrade != null');
    expect(screen).toContain('schoolTrack ? undefined :');
  });

  /**
   * The exam-day note is read from the field, never assumed.
   *
   * The handoff prints "Exam day: Thursday, November 12. That's 43 days, so your
   * plan covers every topic at least twice" as settled fact, on a screen where
   * nothing has been chosen yet. Most programmes here have no date at all, and
   * the plan does not exist until this screen is saved — so the date comes from
   * the selected field, and a programme without one says so.
   */
  it('shows a sitting date only when the chosen programme has one', () => {
    expect(screen).toContain('selected.examDate');
    expect(screen).toContain('c.choose.examDayUnset');
    // No hard-coded date or day count anywhere, which is what copying the
    // handoff's sentence would have meant.
    expect(screen).not.toMatch(/November|43 days/);
  });

  /** The handoff's coverage promise is not made, because nothing can keep it. */
  it('does not promise what the plan will cover', () => {
    for (const line of [en.choose.examDayIn(43), en.choose.examDayUnset]) {
      expect(line.toLowerCase()).not.toContain('twice');
      expect(line.toLowerCase()).not.toContain('every topic');
    }
  });

  /**
   * The countdown is floored to midnight on both sides.
   *
   * Subtracting raw instants makes "in 20 days" turn into 19 at some hour of the
   * afternoon — a countdown that disagrees with itself between two taps.
   */
  it('counts whole days', () => {
    expect(screen).toContain('midnight(');
    expect(screen).toContain('Math.round(');
  });

  it('takes its words from the dictionary rather than the file', () => {
    const sentences = screen.match(/>[A-Z][a-z]+ [a-z]{2,}[^<>{}]*</g) ?? [];
    expect(sentences).toEqual([]);
  });
});
