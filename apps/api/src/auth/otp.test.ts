/**
 * Unit test — one-time code rules (T-264).
 *
 * The three that matter are all about what the code refuses: a spent code, a
 * stale one, and one that has been guessed at too often. Each is checked before
 * the digits are compared, so none of them costs an attacker information.
 */
import { describe, expect, it } from 'vitest';

import {
  CODE_LENGTH,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_SEC,
  checkCode,
  codeMatches,
  cooldownRemainingSec,
  expiryFrom,
  generateCode,
  hashCode,
} from './otp';

const now = new Date('2026-08-23T10:00:00Z');
const stored = (over: Partial<Parameters<typeof checkCode>[1]> = {}) => ({
  codeHash: hashCode('123456'),
  expiresAt: new Date('2026-08-23T10:05:00Z'),
  attempts: 0,
  consumedAt: null,
  createdAt: new Date('2026-08-23T09:55:00Z'),
  ...over,
});

describe('generateCode', () => {
  it('is six digits, zero-padded', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(code).toHaveLength(CODE_LENGTH);
    }
  });

  it('is not the same code twice in a row', () => {
    const codes = new Set(Array.from({ length: 50 }, generateCode));
    // A generator returning one value would pass every other test in this file.
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('hashCode', () => {
  it('never contains the code', () => {
    expect(hashCode('123456')).not.toContain('123456');
  });

  it('matches only the code it was made from', () => {
    expect(codeMatches('123456', hashCode('123456'))).toBe(true);
    expect(codeMatches('123457', hashCode('123456'))).toBe(false);
    expect(codeMatches('', hashCode('123456'))).toBe(false);
  });
});

describe('checkCode', () => {
  it('accepts the right code', () => {
    expect(checkCode('123456', stored(), now)).toEqual({ ok: true });
  });

  it('refuses the wrong one', () => {
    expect(checkCode('000000', stored(), now)).toEqual({ ok: false, reason: 'wrong' });
  });

  it('refuses an expired code', () => {
    const late = new Date('2026-08-23T10:06:00Z');
    expect(checkCode('123456', stored(), late)).toEqual({ ok: false, reason: 'expired' });
  });

  it('refuses a code that has already been spent', () => {
    expect(checkCode('123456', stored({ consumedAt: now }), now)).toEqual({
      ok: false,
      reason: 'consumed',
    });
  });

  it('refuses once the attempts are used up', () => {
    expect(checkCode('123456', stored({ attempts: MAX_ATTEMPTS }), now)).toEqual({
      ok: false,
      reason: 'exhausted',
    });
    expect(MAX_ATTEMPTS).toBe(5);
  });

  /*
   * Order matters. A spent or stale code is refused *before* the digits are
   * compared, so discovering it is dead costs nothing and reveals nothing about
   * whether the digits were right.
   */
  it('does not compare the digits of a dead code', () => {
    // The right code against a consumed row still reports `consumed`, not `ok`;
    // the wrong code against an expired row still reports `expired`, not
    // `wrong`. Either leak would turn a dead code into an oracle.
    expect(checkCode('123456', stored({ consumedAt: now }), now).ok).toBe(false);
    const late = new Date('2026-08-23T11:00:00Z');
    expect(checkCode('000000', stored(), late)).toEqual({ ok: false, reason: 'expired' });
  });
});

describe('the resend cooldown', () => {
  it('is open when no code has been sent', () => {
    expect(cooldownRemainingSec(null, now)).toBe(0);
  });

  it('holds for a minute after one has', () => {
    expect(cooldownRemainingSec({ createdAt: now }, now)).toBe(RESEND_COOLDOWN_SEC);
    const halfway = new Date(now.getTime() + 30_000);
    expect(cooldownRemainingSec({ createdAt: now }, halfway)).toBe(30);
  });

  it('opens again once it has passed', () => {
    const after = new Date(now.getTime() + (RESEND_COOLDOWN_SEC + 1) * 1000);
    expect(cooldownRemainingSec({ createdAt: now }, after)).toBe(0);
  });

  /*
   * Every send costs money. A resend button with no cooldown is a way to spend
   * a telecom balance as fast as it can be pressed, which is a documented
   * failure of products doing exactly this.
   */
  it('never returns a negative wait', () => {
    const longAfter = new Date(now.getTime() + 86_400_000);
    expect(cooldownRemainingSec({ createdAt: now }, longAfter)).toBe(0);
  });
});

describe('expiryFrom', () => {
  it('is ten minutes out, and always after creation', () => {
    const expires = expiryFrom(now);
    expect(expires.getTime() - now.getTime()).toBe(600_000);
    // The database CHECK says the same thing; this is the half that fails fast.
    expect(expires.getTime()).toBeGreaterThan(now.getTime());
  });
});
