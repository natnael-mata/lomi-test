/**
 * What `/progress` may say twice, and what it may not (T-269).
 *
 * This screen carries more figures than any other in the product, and an audit
 * found it repeating most of them: the mock papers listed three times, and every
 * topic's score printed once in the readiness rows and again under "What each
 * score rests on". On a screen whose whole claim is that each number can be
 * checked, a number appearing twice in two framings is read as two facts.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { stripComments } from '../../lib/strip-comments';
import { en } from '../../lib/i18n/dictionary';

const here = dirname(fileURLToPath(import.meta.url));
const screen = stripComments(readFileSync(resolve(here, 'ProgressScreen.tsx'), 'utf8'));
/*
 * The evidence moved into each topic's row in the redesign, so the per row
 * rules are checked where the row is drawn.
 */
const statement = stripComments(
  readFileSync(resolve(here, '../../components/ReadinessStatement.tsx'), 'utf8'),
);

describe('the progress screen (T-269)', () => {
  /**
   * The evidence section carries the count, not the score again.
   *
   * It read "40% from 5 answers" while the readiness rows above already printed
   * "Depreciation 40% · 25% share of past papers". The section is not a
   * duplicate — it holds the one fact those rows cannot, which is how much each
   * score rests on — but it was saying that fact *and* repeating the score.
   */
  it('states how much a score rests on without reprinting the score', () => {
    expect(statement).toContain('c.progress.fromAnswers(row.answered)');
    expect(screen).toContain('answered: t.answered');
    expect(en.progress.fromAnswers(5)).toBe('from 5 answers');
    expect(en.progress.fromAnswers(5)).not.toContain('%');
    // One answer is singular. A caveat that reads "1 answers" undermines the
    // caution it exists to give.
    expect(en.progress.fromAnswers(1)).toBe('from 1 answer');
  });

  /**
   * The caveat itself survives, because it is the point of the section.
   *
   * A topic can read 100% off a single mock question, and one more answer can
   * move the headline twenty points.
   */
  it('flags a score resting on too little', () => {
    expect(statement).toContain('c.progress.thinEvidence');
    expect(en.progress.thinEvidence.length).toBeGreaterThan(4);
  });

  /**
   * Readiness and coverage are told apart wherever both are on screen.
   *
   * They answer different questions and can differ wildly — seven questions all
   * right reads 41% coverage and 100% readiness — and side by side with nothing
   * between them they look like a product that cannot count.
   */
  it('distinguishes the two big percentages', () => {
    expect(screen).toContain('c.progress.readinessVsCoverage');
    const line = en.progress.readinessVsCoverage.toLowerCase();
    expect(line).toContain('coverage');
    expect(line).toContain('tried');
  });

  /**
   * The redesign's figures (handoff, § Progress), each read and each with
   * how it was worked out.
   */
  it('leads with coverage, the checkable figure', () => {
    const coverageAt = screen.indexOf('c.progress.kpiCoverage');
    const readinessAt = screen.indexOf('c.progress.kpiReadiness');
    expect(coverageAt).toBeGreaterThan(-1);
    expect(coverageAt).toBeLessThan(readinessAt);
  });

  /** "Day streak" in the handoff; the API counts days shown up, not in a row. */
  it('never calls the study day count a streak in a row', () => {
    expect(en.progress.kpiStudyDays.toLowerCase()).not.toContain('streak');
    expect(en.progress.kpiStudyDaysHow.toLowerCase()).not.toContain('in a row');
  });

  /** D5: a share of past papers, never "% of exam", which the handoff writes. */
  it('frames topic weights as a share of past papers', () => {
    expect(statement).toContain('c.progress.shareOf(');
    expect(en.progress.shareOf(25)).toBe('25% share of past papers');
    expect(JSON.stringify(en.progress)).not.toMatch(/of exam/i);
  });

  /** Activity comes only from the guarded ledger reading, never a guess. */
  it('draws activity only when the ledger can vouch for it', () => {
    expect(screen).toContain('activityFrom(');
    expect(screen).toContain('cells ? <Activity');
  });

  /** Mocks lists every paper now; printing them here too was a second copy. */
  it('does not reprint the paper history Mocks already shows', () => {
    expect(screen).not.toContain('SittingHistory');
    expect(screen).not.toContain('ScoreTrend');
    expect(screen).toContain('href="/mocks"');
  });

  it('keeps Standing linked, now that it is out of the navigation', () => {
    expect(screen).toContain('href="/standing"');
  });
});
