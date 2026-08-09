/**
 * The lock on the smoke-test door (T-206a).
 *
 * This is the one deliberate authentication bypass in the codebase, so it gets
 * the tests an auth bypass deserves. Three properties, in order of how much
 * they matter:
 *
 * 1. It is **shut** unless somebody sets a long secret. No default, no
 *    inference from `NODE_ENV`, no development fallback.
 * 2. It **cannot reach a real account**, whatever is presented. That is what
 *    makes a leaked secret a nuisance rather than a takeover of the product.
 * 3. The comparison leaks nothing about the secret.
 */
import { describe, expect, it } from 'vitest';

import {
  DEV_TELEGRAM_ID_CEILING,
  DEV_TELEGRAM_ID_FLOOR,
  MIN_SECRET_LENGTH,
  devDisplayName,
  devTelegramId,
  isDevLoginEnabled,
  isDevTelegramId,
  secretMatches,
} from './dev-login';

const GOOD = 'x'.repeat(MIN_SECRET_LENGTH);

describe('whether the door is open at all', () => {
  /**
   * The property that matters most. Every environment that has not been told
   * about this route is closed, including production, including a box somebody
   * deployed in a hurry.
   */
  it('is shut when no secret is configured', () => {
    for (const secret of [undefined, '', '   ']) {
      expect(isDevLoginEnabled(secret as string | undefined), String(secret)).toBe(false);
    }
  });

  /**
   * The real failure mode is not a cryptographic attack — it is
   * `DEV_LOGIN_SECRET=test` typed once and shipped to a public box.
   */
  it('refuses a secret short enough to have been typed from memory', () => {
    for (const secret of ['test', 'password', 'letmein', 'a'.repeat(MIN_SECRET_LENGTH - 1)]) {
      expect(isDevLoginEnabled(secret), secret).toBe(false);
      // And a short *configured* secret cannot be matched, so a careless
      // deployment fails closed rather than opening on a guessable string.
      expect(secretMatches(secret, secret), secret).toBe(false);
    }
  });

  it('opens only for the configured secret', () => {
    expect(secretMatches(GOOD, GOOD)).toBe(true);
    expect(secretMatches(`${GOOD}x`, GOOD)).toBe(false);
    expect(secretMatches(GOOD.slice(0, -1), GOOD)).toBe(false);
    expect(secretMatches('', GOOD)).toBe(false);
  });

  /**
   * `timingSafeEqual` throws on a length mismatch, and a throw on a length
   * mismatch is itself a length oracle. Hashing first gives it two equal-length
   * buffers whatever arrives.
   */
  it('does not throw on a presented secret of the wrong length', () => {
    for (const presented of ['', 'a', 'z'.repeat(4096)]) {
      expect(() => secretMatches(presented, GOOD)).not.toThrow();
      expect(secretMatches(presented, GOOD)).toBe(false);
    }
  });
});

describe('what it can reach', () => {
  /**
   * **The property that makes the whole thing survivable.** Telegram's own ids
   * are positive, so an account minted in the negative range cannot collide
   * with a real person's — and that is a fact about the number, not a check
   * somebody has to remember to write.
   */
  it('mints ids that cannot collide with a real Telegram account', () => {
    for (const label of ['student', 'admin', 'reviewer', '', '  ', 'ስም', 'a'.repeat(200)]) {
      const id = devTelegramId(label);
      expect(id, label).toBeLessThan(0);
      expect(id, label).toBeGreaterThanOrEqual(DEV_TELEGRAM_ID_FLOOR);
      expect(id, label).toBeLessThan(DEV_TELEGRAM_ID_CEILING);
      expect(isDevTelegramId(id), label).toBe(true);
    }
  });

  it('does not mistake a real Telegram id for a test one', () => {
    // Real ids, including one past 2^32 — Telegram has been issuing those for
    // years, which is why the column is a string.
    for (const real of [1, 566000010, 7_000_000_000, 8_123_456_789]) {
      expect(isDevTelegramId(real), String(real)).toBe(false);
      expect(isDevTelegramId(String(real)), String(real)).toBe(false);
    }
  });

  it('survives nonsense rather than treating it as a test account', () => {
    for (const junk of [null, undefined, '', 'abc', 'NaN']) {
      expect(isDevTelegramId(junk as string | null), String(junk)).toBe(false);
    }
  });

  /**
   * The same persona is the same account. A tester who signs back in should
   * find yesterday's practice history rather than a fresh account, which is
   * also what makes a two-day manual test possible at all.
   */
  it('gives one persona one account, however it is capitalised', () => {
    expect(devTelegramId('student')).toBe(devTelegramId('student'));
    expect(devTelegramId('student')).toBe(devTelegramId('  STUDENT '));
    expect(devTelegramId('student')).not.toBe(devTelegramId('reviewer'));
  });
});

describe('the log label', () => {
  /**
   * Not the account's name — the product generates those and takes one from
   * nobody (T-086). This is what the warning line says when the door is used,
   * and the thing that marks a test account in the admin search is its negative
   * telegram id, above.
   */
  it('names the persona the door was opened for', () => {
    expect(devDisplayName('student')).toBe('Test-student');
    expect(devDisplayName('  Reviewer ')).toBe('Test-Reviewer');
  });

  it('produces a usable name from an unusable label', () => {
    for (const label of ['', '   ', '!!!', 'ስም']) {
      const name = devDisplayName(label);
      expect(name.startsWith('Test-'), label).toBe(true);
      expect(name.length, label).toBeGreaterThan(5);
    }
  });

  // Display names are bounded everywhere else in the product; this is not the
  // one place a 200-character name gets into the database.
  it('does not let a long label become a long name', () => {
    expect(devDisplayName('a'.repeat(200)).length).toBeLessThanOrEqual(17);
  });
});
