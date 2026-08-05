/**
 * The practice CTA, and the rule that every analytics view carries one (T-139).
 *
 * DESIGN.md: "Every statement ends in a practice action." That is a claim about
 * a set of components, not about one of them, so the enforcing test below walks
 * the set — otherwise the rule holds for the three screens somebody remembered
 * and quietly fails on the fourth one added next month.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PracticeCta, practiceHref } from './PracticeCta';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (file: string): string => readFileSync(resolve(HERE, file), 'utf8');

describe('PracticeCta (T-139)', () => {
  it('renders with and without a topic', () => {
    expect(() => PracticeCta({ topicId: 't1', topicName: 'Taxation' })).not.toThrow();
    expect(() => PracticeCta({ topicId: null, topicName: null })).not.toThrow();
  });

  /** T-139's stated test: the href carries the topic's id. */
  it('puts the topic’s id in the href', () => {
    expect(practiceHref('ckt0p1c1d')).toBe('/practice?topic=ckt0p1c1d');
  });

  /**
   * The id, not the name.
   *
   * Names get renamed, collide across fields, and arrive in Ethiopic — all of
   * which break a link built from one. The id still resolves next term.
   */
  it('escapes an id rather than trusting it into a URL', () => {
    expect(practiceHref('a b&c=d')).toBe('/practice?topic=a%20b%26c%3Dd');
  });

  // A student with no answers yet is exactly the one who should be practising.
  // The action stays; it just stops pretending to know what to practise.
  it('still offers practice when there is nothing to recommend', () => {
    const source = read('PracticeCta.tsx');
    expect(source).toContain('href="/practice"');
    expect(source).toContain('Start practising');
  });
});

/**
 * The rule, enforced across the set.
 *
 * A component is an analytics view if it reports a student's own performance
 * back to them. Adding one to this list is the cost of adding a view — and a
 * new view that forgets the CTA fails here rather than shipping as a screen
 * that diagnoses somebody and leaves.
 */
describe('every analytics view ends in a practice action (T-139)', () => {
  const VIEWS = ['ReadinessStatement.tsx', 'SessionSummary.tsx', 'ExamSummary.tsx'];

  it('has views to check', () => {
    // Guards the loop: an empty list passes forever.
    expect(VIEWS.length).toBeGreaterThanOrEqual(3);
  });

  it.each(VIEWS)('%s renders a PracticeCta', (file) => {
    const source = read(file);
    expect(source).toContain("from './PracticeCta'");
    expect(source).toContain('<PracticeCta');
  });

  /**
   * At the end, not in the middle. "Ends in a practice action" is about where a
   * student's eye finishes, and a CTA above the topic rows is a button they
   * scroll past on the way to the numbers.
   */
  it.each(VIEWS)('%s puts it last', (file) => {
    const source = read(file);
    const cta = source.lastIndexOf('<PracticeCta');
    const rows = Math.max(source.lastIndexOf('</ul>'), source.lastIndexOf('</li>'));
    expect(cta, `${file} has no CTA`).toBeGreaterThan(-1);
    expect(cta, `${file} shows the CTA before its rows`).toBeGreaterThan(rows);
  });

  // The CTA targets by id, so every view has to have an id to give it.
  it.each(VIEWS)('%s passes an id, never just a name', (file) => {
    const source = read(file);
    expect(source).toMatch(/topicId=\{/);
  });
});

describe('the trend is a sequence, not a timeline (T-138)', () => {
  const source = readFileSync(join(HERE, 'ScoreTrend.tsx'), 'utf8');

  /**
   * Never a formatted date on the axis. Calendar spacing makes the chart about
   * a student's holiday rather than their revision, and Ethiopia runs its own
   * calendar alongside the Gregorian one — so a formatted date has a wrong
   * answer per student where an ordinal has none.
   */
  it('formats no date anywhere', () => {
    for (const banned of ['toLocaleDateString', 'toLocaleString', 'Intl.DateTimeFormat']) {
      expect(source, `${banned} would put a date on the axis`).not.toContain(banned);
    }
  });

  it('labels points by their given label, which is "Mock N"', () => {
    expect(source).toContain('{point.label}');
  });

  // The chart is decoration for anyone not looking at it; the numbers are the
  // content, so they are also written out.
  it('restates every bar in words', () => {
    expect(source).toContain('data-trend-rows');
    expect(source).toContain('{point.scoreCorrect}');
  });
});
