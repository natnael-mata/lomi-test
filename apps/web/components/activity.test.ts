import { describe, expect, it } from 'vitest';

import { ACTIVITY_DAYS, activityFrom, levelOf } from './activity';

// Saturday 3 October 2026, 10:00 in Addis (07:00 UTC).
const NOW = Date.parse('2026-10-03T07:00:00Z');
describe('activity, from GET /me/activity', () => {
  it('draws five whole weeks, Monday first, ending on this Sunday', () => {
    const cells = activityFrom([], NOW);
    expect(cells).toHaveLength(35);
    expect(cells[0]!.day).toBe('2026-08-31'); // a Monday, four weeks before this one
    expect(cells[34]!.day).toBe('2026-10-04'); // this Sunday
    expect(cells.find((c) => c.today)!.day).toBe('2026-10-03');
    expect(cells.filter((c) => c.future).map((c) => c.day)).toEqual(['2026-10-04']);
  });

  it('places each day the server counted', () => {
    const cells = activityFrom(
      [
        { day: '2026-10-03', answered: 2 },
        { day: '2026-10-01', answered: 1 },
        { day: '2026-10-02', answered: 0 },
      ],
      NOW,
    );
    const count = (day: string) => cells.find((c) => c.day === day)!.answered;
    expect(count('2026-10-03')).toBe(2);
    expect(count('2026-10-01')).toBe(1);
    expect(count('2026-10-02')).toBe(0);
    // A day the server did not send is drawn as nothing done, never omitted.
    expect(count('2026-09-01')).toBe(0);
  });

  it('asks for enough days to reach the first Monday from any weekday', () => {
    // On a Sunday the grid's first cell is 34 days back, the furthest it goes.
    expect(ACTIVITY_DAYS).toBeGreaterThanOrEqual(35);
  });

  it('shades by stated thresholds, the last at the smallest daily target', () => {
    expect([0, 1, 5, 6, 11, 12, 40].map(levelOf)).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });
});
