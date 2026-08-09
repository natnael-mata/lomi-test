import { describe, expect, it } from 'vitest';

import {
  expiresAtFrom,
  isLive,
  offersFrom,
  perMonthEtb,
  renewalStartsAt,
  type PlanShape,
} from './plan';

const SIX: PlanShape = { code: 'SIX_MONTH', months: 6, priceEtb: 500 };
const TWELVE: PlanShape = { code: 'TWELVE_MONTH', months: 12, priceEtb: 800 };

const at = (iso: string): Date => new Date(iso);

describe('when access runs out (T-140a)', () => {
  /** T-140a's stated test. */
  it('adds the plan’s months to the activation date', () => {
    expect(expiresAtFrom(at('2026-01-15T00:00:00.000Z'), 6).toISOString()).toBe(
      '2026-07-15T00:00:00.000Z',
    );
  });

  it('handles twelve months across a year boundary', () => {
    expect(expiresAtFrom(at('2026-03-01T09:30:00.000Z'), 12).toISOString()).toBe(
      '2027-03-01T09:30:00.000Z',
    );
  });

  /**
   * The month-end rule, and the reason this is a function rather than a
   * `setMonth` call.
   *
   * 31 August plus six months is 31 February, which does not exist. JavaScript
   * rolls that silently to 2 or 3 March depending on the year — so a naive
   * implementation hands out two or three free days, inconsistently, and only to
   * people who happen to buy on the 29th, 30th or 31st.
   */
  it('clamps to the last day of the target month rather than overflowing', () => {
    expect(expiresAtFrom(at('2026-08-31T00:00:00.000Z'), 6).toISOString()).toBe(
      '2027-02-28T00:00:00.000Z',
    );
  });

  it('clamps to 29 February in a leap year', () => {
    // 2028 is a leap year: 31 August 2027 + 6 months.
    expect(expiresAtFrom(at('2027-08-31T00:00:00.000Z'), 6).toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    );
  });

  it('never grants more time than was sold', () => {
    // Every day of a long month, six months out, must land inside the target
    // month — never spill into the one after it.
    for (let day = 26; day <= 31; day++) {
      const start = at(`2026-08-${String(day).padStart(2, '0')}T00:00:00.000Z`);
      const end = expiresAtFrom(start, 6);
      expect(end.getUTCMonth(), `${start.toISOString()} spilled past February`).toBe(1);
    }
  });

  it('keeps the time of day, so a purchase does not gain or lose hours', () => {
    const end = expiresAtFrom(at('2026-01-15T21:45:13.250Z'), 6);
    expect(end.toISOString()).toBe('2026-07-15T21:45:13.250Z');
  });

  /**
   * UTC throughout. The instant is what matters, not a wall clock — a student
   * buying at 23:00 in Addis and a server in another zone must agree about when
   * the six months are up.
   */
  it('does not depend on the server’s timezone', () => {
    const before = process.env.TZ;
    try {
      process.env.TZ = 'Pacific/Kiritimati';
      const east = expiresAtFrom(at('2026-01-15T00:00:00.000Z'), 6).toISOString();
      process.env.TZ = 'Pacific/Midway';
      const west = expiresAtFrom(at('2026-01-15T00:00:00.000Z'), 6).toISOString();
      expect(east).toBe(west);
      expect(east).toBe('2026-07-15T00:00:00.000Z');
    } finally {
      if (before === undefined) delete process.env.TZ;
      else process.env.TZ = before;
    }
  });

  describe('whether it is still live', () => {
    it('is live before the expiry and not after', () => {
      const expires = at('2026-07-15T00:00:00.000Z');
      expect(isLive(expires, at('2026-07-14T23:59:59.000Z'))).toBe(true);
      expect(isLive(expires, at('2026-07-15T00:00:01.000Z'))).toBe(false);
    });

    // Not live at the instant it expires. The alternative gives a millisecond of
    // access nobody paid for, and the boundary has to fall on one side.
    it('is not live at the exact moment it expires', () => {
      const expires = at('2026-07-15T00:00:00.000Z');
      expect(isLive(expires, expires)).toBe(false);
    });

    /** No expiry means never activated, which is not the same as expired. */
    it('is not live when there is no expiry at all', () => {
      expect(isLive(null)).toBe(false);
    });
  });
});

describe('what the picker shows (T-141a)', () => {
  /** T-141a's stated test: both plans, with the maths done. */
  it('computes a per-month figure from the data', () => {
    expect(perMonthEtb(SIX)).toBe(83); // 500 / 6
    expect(perMonthEtb(TWELVE)).toBe(67); // 800 / 12
  });

  it('offers both plans', () => {
    const offers = offersFrom([SIX, TWELVE]);
    expect(offers.map((o) => o.code)).toEqual(['TWELVE_MONTH', 'SIX_MONTH']);
  });

  /**
   * Cheapest per month first. The picker's job is to make the better deal
   * legible, not to lead with the smaller number — Br 800 looks worse than
   * Br 500 until you see it is Br 67 a month against Br 83.
   */
  it('leads with the better value, not the smaller price', () => {
    const [first] = offersFrom([SIX, TWELVE]);
    expect(first?.code).toBe('TWELVE_MONTH');
    expect(first?.bestValue).toBe(true);
    expect(first?.priceEtb).toBeGreaterThan(SIX.priceEtb);
  });

  /**
   * The saving is measured against the dearest plan actually on offer, so a
   * student can check it from the two numbers in front of them. A discount
   * against a price nobody ever charged is the oldest trick in retail, and this
   * product does not do it.
   */
  it('measures the saving against a price that is really charged', () => {
    const twelve = offersFrom([SIX, TWELVE]).find((o) => o.code === 'TWELVE_MONTH');
    // (83 - 67) / 83 ≈ 19%
    expect(twelve?.savingPct).toBe(19);
  });

  it('claims no saving on the dearest plan', () => {
    const six = offersFrom([SIX, TWELVE]).find((o) => o.code === 'SIX_MONTH');
    expect(six?.savingPct).toBe(0);
    expect(six?.bestValue).toBe(false);
  });

  // With one plan, nothing is "best value" — saying so would be a claim about
  // nothing, and a badge on the only option is just decoration.
  it('marks nothing best value when there is nothing to compare', () => {
    expect(offersFrom([SIX])[0]?.bestValue).toBe(false);
    expect(offersFrom([SIX])[0]?.savingPct).toBe(0);
  });

  it('marks nothing best value when two plans cost the same per month', () => {
    const same: PlanShape = { code: 'OTHER', months: 12, priceEtb: 996 }; // 83/mo
    expect(offersFrom([SIX, same]).every((o) => !o.bestValue)).toBe(true);
  });

  it('survives an empty catalogue rather than dividing by nothing', () => {
    expect(offersFrom([])).toEqual([]);
  });

  it('survives a zero-month plan without dividing by zero', () => {
    expect(perMonthEtb({ code: 'BROKEN', months: 0, priceEtb: 500 })).toBe(500);
    expect(Number.isFinite(perMonthEtb({ code: 'BROKEN', months: 0, priceEtb: 500 }))).toBe(true);
  });

  /**
   * Derived, never stored. A second number that has to be kept in step with a
   * price is a second number that will one day disagree with it.
   */
  it('recomputes from the price rather than remembering', () => {
    const cheaper = offersFrom([{ ...TWELVE, priceEtb: 600 }])[0];
    expect(cheaper?.perMonthEtb).toBe(50);
  });
});

describe('renewing (T-146a)', () => {
  /**
   * T-146a's stated test. A student who renews a week early would otherwise
   * lose that week — and the lesson that teaches is to wait until access has
   * actually lapsed before paying, which is worse for them and worse for the
   * product.
   */
  it('counts from the existing expiry, not from today', () => {
    const expiry = at('2026-07-15T00:00:00.000Z');
    const renewsOn = at('2026-06-15T00:00:00.000Z'); // 30 days early
    const start = renewalStartsAt(expiry, renewsOn);

    expect(start.toISOString()).toBe(expiry.toISOString());
    // The full six months land on top of the existing date, not on today.
    expect(expiresAtFrom(start, 6).toISOString()).toBe('2027-01-15T00:00:00.000Z');
  });

  it('adds the whole plan length however early the renewal is', () => {
    const expiry = at('2026-07-15T00:00:00.000Z');
    for (const early of ['2026-07-14', '2026-06-01', '2026-02-20']) {
      const start = renewalStartsAt(expiry, at(`${early}T00:00:00.000Z`));
      expect(expiresAtFrom(start, 12).toISOString()).toBe('2027-07-15T00:00:00.000Z');
    }
  });

  /**
   * Once access HAS lapsed the clock starts now. Backdating a June renewal to a
   * March expiry would sell somebody three months they cannot use.
   */
  it('starts from today once access has already lapsed', () => {
    const expired = at('2026-03-01T00:00:00.000Z');
    const renewsOn = at('2026-06-01T00:00:00.000Z');
    expect(renewalStartsAt(expired, renewsOn).toISOString()).toBe(renewsOn.toISOString());
  });

  it('starts from today for a first purchase', () => {
    const now = at('2026-06-01T00:00:00.000Z');
    expect(renewalStartsAt(null, now).toISOString()).toBe(now.toISOString());
  });

  // The boundary has to fall somewhere: an expiry exactly now is spent.
  it('treats an expiry falling exactly now as spent', () => {
    const now = at('2026-06-01T00:00:00.000Z');
    expect(renewalStartsAt(now, now).toISOString()).toBe(now.toISOString());
  });
});
