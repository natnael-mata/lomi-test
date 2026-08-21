/**
 * Unit test — bands and who gets published (T-257).
 *
 * The assertion that matters most is the one about a child: an eleven-year-old
 * who has never been asked must not appear anywhere. It is checked from both
 * directions — the band they are in, and the listing rule that band implies.
 */
import { describe, expect, it } from 'vitest';

import { JUNIOR_MAX_GRADE, bandFor, isListed } from './bands';

describe('bandFor', () => {
  it('puts Grade 6 and Grade 8 together', () => {
    expect(bandFor(6)).toBe('junior');
    expect(bandFor(8)).toBe('junior');
    expect(JUNIOR_MAX_GRADE).toBe(8);
  });

  it('puts Grade 12 with the exit exams', () => {
    expect(bandFor(12)).toBe('senior');
    // No span at all is a degree, whose candidates are graduating adults.
    expect(bandFor(null)).toBe('senior');
  });

  /*
   * The boundary, written out because it is the line a child falls on the wrong
   * side of if `<=` becomes `<`.
   */
  it('draws the line between 8 and 9', () => {
    expect(bandFor(8)).toBe('junior');
    expect(bandFor(9)).toBe('senior');
  });
});

describe('isListed', () => {
  it('lists a senior who has never been asked', () => {
    expect(isListed('senior', null)).toBe(true);
  });

  /*
   * THE rule. T-194's default is right for an adult choosing whether to compete
   * in public and wrong for a child who has not been asked — the parent is the
   * consent, and the parent has not given it.
   */
  it('does not list a junior who has never been asked', () => {
    expect(isListed('junior', null)).toBe(false);
  });

  it('lists a junior who asked to appear', () => {
    expect(isListed('junior', false)).toBe(true);
  });

  it('hides anybody who asked to be hidden, in either band', () => {
    expect(isListed('junior', true)).toBe(false);
    expect(isListed('senior', true)).toBe(false);
  });

  /*
   * "Hide me" is not a default that a rule may override. If this ever inverts,
   * the failure is a student who asked not to be seen being published.
   */
  it('never lets a band rule overrule an explicit hide', () => {
    for (const band of ['junior', 'senior'] as const) {
      expect(isListed(band, true)).toBe(false);
    }
  });
});
