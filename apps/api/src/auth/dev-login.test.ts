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
  devDisplayName,
  devTelegramId,
  isDevTelegramId,
} from './dev-login';


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

    // The persona is labelled `userb` and the test brief calls it "User B".
    // Typing the name the tester was handed used to mint a different, empty
    // account — so the two have to be one.
    expect(devTelegramId('userb')).toBe(devTelegramId('User B'));
    expect(devTelegramId('userb')).toBe(devTelegramId('user-b'));
    // Distinct personas stay distinct through the same normalising.
    expect(devTelegramId('User A')).not.toBe(devTelegramId('User B'));
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
