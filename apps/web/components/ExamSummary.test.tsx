/**
 * The post-exam summary's rendered contract (T-130).
 *
 * The ranking rule is proved on the API side, in `exam-summary.test.ts`. What is
 * checked here is what the screen says about it: that the weakest topic is
 * labelled, that an unweighted topic says so rather than showing a zero, and
 * that the wording never promises this year's paper.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { stripComments } from '../lib/strip-comments';
import { ExamSummary, type ExamSummaryData } from './ExamSummary';
import { en } from '../lib/i18n/dictionary';

const source = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), 'ExamSummary.tsx'),
  'utf8',
);

const copy = stripComments(source);

const summary: ExamSummaryData = {
  scoreCorrect: 4,
  answeredCount: 7,
  totalQuestions: 8,
  scorePct: 50,
  weakestTopic: 'Algorithms',
  weakestTopicId: 'id-Algorithms',
  topics: [
    {
      topicId: 'id-Algorithms',
      topic: 'Algorithms',
      asked: 4,
      correct: 3,
      scorePct: 75,
      weightPct: 40,
      weightedGapPct: 10,
    },
    {
      topicId: 'id-Databases',
      topic: 'Databases',
      asked: 4,
      correct: 1,
      scorePct: 25,
      weightPct: 10,
      weightedGapPct: 7.5,
    },
  ],
};

describe('ExamSummary (T-130)', () => {
  it('renders', () => {
    expect(() => ExamSummary({ summary })).not.toThrow();
  });

  it('renders a paper with no questions without dividing by zero', () => {
    expect(() =>
      ExamSummary({
        summary: {
          scoreCorrect: 0,
          answeredCount: 0,
          totalQuestions: 0,
          scorePct: 0,
          weakestTopic: null,
          weakestTopicId: null,
          topics: [],
        },
      }),
    ).not.toThrow();
  });

  // Guards the stripping: if it ate everything, every check below passes forever.
  it('still sees the component after comments are stripped', () => {
    expect(copy).toContain('ExamSummary');
    expect(copy.length).toBeGreaterThan(400);
  });

  /*
   * The wording assertions below read the DICTIONARY, not this component.
   * Since T-210 the words live in one place, which makes these exact rather
   * than a search of JSX — and a component that stopped using a key would fail
   * the no-literals lint instead.
   */

  // "Revise next", not "worst" — the screen is a study plan, not a scoreboard.
  it('names the topic to revise rather than ranking weaknesses', () => {
    expect(en.summary.reviseNext).toBe('Revise next');
    expect(JSON.stringify(en)).not.toMatch(/\bworst\b/i);
  });

  /**
   * Weights describe what has appeared on past papers. The negative half of this
   * rule — never "% of the exam" — is enforced across every file by
   * `copy.test.ts`; what is checked here is that this screen states the positive
   * form rather than captioning a weight with no framing at all.
   */
  it('frames a weight as a share of past papers', () => {
    expect(en.summary.shareOfPastPapers(40)).toContain('share of past papers');
  });

  // Unknown is not zero, on the screen as much as in the calculation.
  it('says a missing weight is missing instead of showing a zero', () => {
    expect(en.summary.shareNotWorkedOut).toContain('not worked out yet');
  });

  // Anyone who counted their own red marks will otherwise think it picked wrong.
  it('explains why the named topic is not the one with the most misses', () => {
    expect(en.practice.whyRanked).toContain('not the number of misses');
  });

  // An unanswered question is not a wrong one, and the difference is the student's.
  it('reports what was left unanswered rather than folding it into the score', () => {
    expect(en.summary.ofThePaperWithUnanswered(50, 1)).toContain('left unanswered');
  });
});
