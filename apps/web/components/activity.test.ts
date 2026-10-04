import { describe, expect, it } from 'vitest';

import { activityFrom, levelOf } from './activity';

// Saturday 3 October 2026, 10:00 in Addis (07:00 UTC).
const NOW = Date.parse('2026-10-03T07:00:00Z');
const row = (day: string, ruleId = 'answered') => ({ ruleId, day });

describe('activity, from the ledger', () => {
  it('draws five whole weeks, Monday first, ending on this Sunday', () => {
    const cells = activityFrom([], NOW, 200)!;
    expect(cells).toHaveLength(35);
    expect(cells[0]!.day).toBe('2026-08-31'); // a Monday, four weeks before this one
    expect(cells[34]!.day).toBe('2026-10-04'); // this Sunday
    expect(cells.find((c) => c.today)!.day).toBe('2026-10-03');
    expect(cells.filter((c) => c.future).map((c) => c.day)).toEqual(['2026-10-04']);
  });

  it('counts only answers, per Addis day', () => {
    const cells = activityFrom(
      [row('2026-10-03'), row('2026-10-03'), row('2026-10-03', 'correct'), row('2026-10-01')],
      NOW,
      200,
    )!;
    const count = (day: string) => cells.find((c) => c.day === day)!.answered;
    expect(count('2026-10-03')).toBe(2);
    expect(count('2026-10-01')).toBe(1);
    expect(count('2026-10-02')).toBe(0);
  });

  /**
   * The rule that keeps the grid honest: a full page that stops short of the
   * first day would draw studied days as empty.
   */
  it('gives up rather than drawing a short page', () => {
    const full = Array.from({ length: 200 }, () => row('2026-10-02'));
    expect(activityFrom(full, NOW, 200)).toBeNull();
  });

  it('trusts a full page that reaches past the first day', () => {
    const full = [...Array.from({ length: 199 }, () => row('2026-10-02')), row('2026-08-20')];
    expect(activityFrom(full, NOW, 200)).not.toBeNull();
  });

  it('shades by stated thresholds, the last at the smallest daily target', () => {
    expect([0, 1, 5, 6, 11, 12, 40].map(levelOf)).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });
});
