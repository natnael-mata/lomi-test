/**
 * Mocks, the simulator and results (redesign step 8).
 *
 * Read as source text, like the other screen guards here: what these protect is
 * that a particular branch or call exists, which is exactly what a restyle
 * quietly drops.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PASS_MARK_PCT } from '../../lib/pass-mark';
import { en } from '../../lib/i18n/dictionary';
import { stripComments } from '../../lib/strip-comments';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => stripComments(readFileSync(resolve(here, path), 'utf8'));
const mocks = read('MocksScreen.tsx');
const exam = read('../exam/ExamScreen.tsx');
const results = read('../exam/ExamReview.tsx');

describe('Mocks', () => {
  it('still has code left after the comments are stripped', () => {
    expect(mocks).toContain('api.examPreview(');
    expect(mocks).toContain('api.trend(');
  });

  /**
   * Starting is the simulator's job. It replays answers queued offline,
   * settles an expired paper and resumes at the right question; a second copy
   * of that here is the first thing to disagree with it.
   */
  it('hands the start to the simulator rather than starting a paper itself', () => {
    expect(mocks).toContain('/exam?start=1');
    expect(mocks).not.toContain('api.startExam(');
  });

  it('links every past paper to its results', () => {
    expect(mocks).toContain('/exam/review/${paper.sittingId}');
  });
});

/**
 * No pass mark until there is one.
 *
 * The handoff prints "graded against the 50% pass mark". Nothing in this
 * product states a pass mark, and the school tracks are not sat against the
 * university exit exam's, so the figure is a typed constant that renders
 * nothing while it is null.
 */
describe('the pass mark', () => {
  it('is not stated yet', () => {
    expect(PASS_MARK_PCT).toBeNull();
  });

  it('is never written into a screen as a literal', () => {
    for (const source of [mocks, results]) {
      expect(source).not.toMatch(/50\s*%|pass mark/i);
      expect(source).toContain('PASS_MARK_PCT');
    }
  });
});

describe('the simulator', () => {
  /**
   * Nothing starts a three hour clock because somebody typed an address. A
   * plain visit with nothing open shows the card; only the Mocks button
   * (`?start=1`) or a paper already running starts or resumes on its own.
   */
  it('starts on its own only when asked to, or to resume', () => {
    expect(exam).toContain("get('start') === '1'");
    expect(exam).toContain('if (!asked && !preview?.open) return;');
  });

  /**
   * The keyboard yields to everything that should win: a modifier (browser
   * shortcuts), an editable field, and a control that already handled the key
   * (the answer options move between themselves with the arrows).
   */
  it('keeps its shortcuts out of the way', () => {
    expect(exam).toContain('event.defaultPrevented');
    expect(exam).toContain('event.ctrlKey');
    expect(exam).toContain('event.metaKey');
    expect(exam).toMatch(/closest\('input, textarea/);
  });

  /**
   * DESIGN.md: emergency retire is "the only modal in the system". The submit
   * confirmation replaces the question in place.
   */
  it('confirms a submission without a modal', () => {
    expect(exam).toContain('role="alertdialog"');
    expect(exam).not.toMatch(/fixed inset-0|<dialog/);
  });

  /** A control that says "Get full access" goes somewhere. */
  it('links the subscription refusal to checkout', () => {
    const at = exam.indexOf("'SUBSCRIPTION_REQUIRED'");
    expect(at).toBeGreaterThan(-1);
    expect(exam.slice(at, at + 200)).toContain('href="/checkout"');
  });

  it('sends a closed paper to its results page', () => {
    expect(exam).toContain('/exam/review/${');
  });
});

describe('results', () => {
  /**
   * "Time used" is in the handoff and not in the result: there is no start
   * time on it to subtract from. Blank, which the result does carry, takes
   * the slot.
   */
  it('shows only figures the result carries', () => {
    expect(results).not.toMatch(/time used/i);
    expect(results).toContain('c.results.blank');
  });

  it('lists the missed questions first, and keeps every question reachable', () => {
    expect(results).toContain("useState<'missed' | 'all'>('missed')");
    expect(results).toContain('<details');
  });

  it('says what each missed question was, in words', () => {
    expect(en.results.youChose('A', 'B')).toBe('You chose A. The answer is B.');
    expect(en.results.youChose(null, 'C')).toBe('Left blank. The answer is C.');
  });
});
