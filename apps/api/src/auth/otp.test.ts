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
  LOCKOUT_SEC,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_SEC,
  checkCode,
  codeMatches,
  cooldownRemainingSec,
  expiryFrom,
  generateCode,
  hashCode,
  lockUntil,
} from './otp';

const now = new Date('2026-08-23T10:00:00Z');
const stored = (over: Partial<Parameters<typeof checkCode>[1]> = {}) => ({
  codeHash: hashCode('123456'),
  expiresAt: new Date('2026-08-23T10:05:00Z'),
  attempts: 0,
  consumedAt: null,
  createdAt: new Date('2026-08-23T09:55:00Z'),
  lockedUntil: null,
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

  it('refuses the wrong one, and says how many guesses are left', () => {
    // Three tries, so a first wrong guess leaves two. The student is told,
    // because somebody who does not know how many remain cannot decide whether
    // to guess again or ask for a new code — so they guess, which is the
    // behaviour the cap exists to stop.
    expect(checkCode('000000', stored(), now)).toEqual({
      ok: false,
      reason: 'wrong',
      triesLeft: 2,
    });
    expect(checkCode('000000', stored({ attempts: 1 }), now).ok).toBe(false);
    const second = checkCode('000000', stored({ attempts: 1 }), now);
    if (!second.ok) expect(second.triesLeft).toBe(1);
  });

  it('refuses an expired code', () => {
    const late = new Date('2026-08-23T10:06:00Z');
    expect(checkCode('123456', stored(), late)).toEqual({
      ok: false,
      reason: 'expired',
      triesLeft: 0,
    });
  });

  it('refuses a code that has already been spent', () => {
    expect(checkCode('123456', stored({ consumedAt: now }), now)).toEqual({
      ok: false,
      reason: 'consumed',
      triesLeft: 0,
    });
  });

  it('refuses once the attempts are used up', () => {
    expect(checkCode('123456', stored({ attempts: MAX_ATTEMPTS }), now)).toEqual({
      ok: false,
      reason: 'exhausted',
      triesLeft: 0,
    });
    // Three, per the design table. A million combinations against three
    // guesses; five was this module's own invention and the looser of the two.
    expect(MAX_ATTEMPTS).toBe(3);
  });

  it('refuses a locked number before anything else', () => {
    const locked = stored({ lockedUntil: new Date('2026-08-23T10:15:00Z') });
    // Even with the right code: the lock is on the number, and burning through
    // three guesses must not be escapable by then getting one right.
    expect(checkCode('123456', locked, now)).toEqual({
      ok: false,
      reason: 'locked',
      triesLeft: 0,
    });
  });

  it('lets a number back in once the lock has passed', () => {
    const expired = stored({ lockedUntil: new Date('2026-08-23T09:59:00Z') });
    expect(checkCode('123456', expired, now)).toEqual({ ok: true });
  });

  it('says when the door reopens', () => {
    // A clock time, never "later" — see LOCKOUT_SEC.
    expect(lockUntil(now).getTime() - now.getTime()).toBe(LOCKOUT_SEC * 1000);
  });

  /*
   * Order matters, and what it protects is narrower than it once claimed.
   *
   * A spent, stale or locked code is refused **before** the digits are compared,
   * so discovering it is dead costs nothing and reveals nothing about whether
   * the digits were right. That is the property, and it still holds.
   *
   * What this file used to also assert — that expired and wrong are
   * indistinguishable — was over-cautious, and the design overrules it. Expiry
   * is decided by the clock alone, before any comparison, so telling somebody
   * their code expired leaks nothing they did not already know: they know when
   * they asked for it. Meanwhile the student who is told "wrong code" about a
   * code that simply timed out goes looking for a mistake they did not make.
   */
  it('does not compare the digits of a dead code', () => {
    expect(checkCode('123456', stored({ consumedAt: now }), now).ok).toBe(false);
    const late = new Date('2026-08-23T11:00:00Z');
    const outcome = checkCode('000000', stored(), late);
    expect(outcome.ok).toBe(false);
    // 'expired', not 'wrong': the row died on the clock, and the digits were
    // never looked at.
    if (!outcome.ok) expect(outcome.reason).toBe('expired');
  });

  it('never reports a negative number of tries', () => {
    const outcome = checkCode('000000', stored({ attempts: 99 }), now);
    expect(outcome.ok).toBe(false);
    // A UI handed -96 renders it.
    if (!outcome.ok) expect(outcome.triesLeft).toBeGreaterThanOrEqual(0);
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
