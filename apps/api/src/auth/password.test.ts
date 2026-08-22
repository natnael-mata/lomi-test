/**
 * Unit test — password hashing (T-263).
 *
 * The properties worth pinning are the ones whose absence is invisible: a hash
 * that is the same every time, a verify that throws on a bad row, a comparison
 * that leaks its progress.
 */
import { describe, expect, it } from 'vitest';

import { MIN_PASSWORD_LENGTH, checkPassword, hashPassword, verifyPassword } from './password';

describe('checkPassword', () => {
  it('accepts a plain eight-character password', () => {
    expect(checkPassword('lemonade')).toEqual({ ok: true });
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });

  it('refuses one that is too short, and says how short', () => {
    const check = checkPassword('lemon');
    expect(check.ok).toBe(false);
    expect(check.ok === false && check.reasons[0]).toContain('8');
  });

  /*
   * No composition rules, on purpose. "Must contain a symbol and a capital"
   * produces `Password1!` on every account in the country — trivially
   * satisfiable in one predictable way, which is the shape a dictionary already
   * has. Length is the only property a student satisfies unpredictably.
   */
  it('does not demand a symbol, a digit or a capital', () => {
    expect(checkPassword('abcdefgh')).toEqual({ ok: true });
    expect(checkPassword('አማርኛየይለፍቃል')).toEqual({ ok: true });
  });

  it('refuses a leading or trailing space rather than trimming it', () => {
    // Silently trimming means the password they set and the one they type next
    // week differ by a character neither of us can see.
    expect(checkPassword(' lemonade').ok).toBe(false);
    expect(checkPassword('lemonade ').ok).toBe(false);
  });

  it('refuses a missing password without pretending it was short', () => {
    expect(checkPassword(undefined)).toEqual({ ok: false, reasons: ['A password is required.'] });
    expect(checkPassword('')).toEqual({ ok: false, reasons: ['A password is required.'] });
  });
});

describe('hashPassword', () => {
  it('never returns the password', async () => {
    const hash = await hashPassword('lemonade');
    expect(hash).not.toContain('lemonade');
  });

  /*
   * Salted. Two students who pick the same password must not have the same row
   * — otherwise a stolen table shows an attacker which accounts to try first.
   */
  it('is different every time, for the same password', async () => {
    const [a, b] = await Promise.all([hashPassword('lemonade'), hashPassword('lemonade')]);
    expect(a).not.toBe(b);
    expect(await verifyPassword('lemonade', a)).toBe(true);
    expect(await verifyPassword('lemonade', b)).toBe(true);
  });

  it('carries its own cost, so the cost can be raised later', async () => {
    const hash = await hashPassword('lemonade');
    const [scheme, n, r, p] = hash.split('$');
    expect(scheme).toBe('scrypt');
    expect(Number(n)).toBeGreaterThanOrEqual(16_384);
    expect(Number(r)).toBeGreaterThan(0);
    expect(Number(p)).toBeGreaterThan(0);
  });
});

describe('verifyPassword', () => {
  it('accepts the right password and refuses the wrong one', async () => {
    const hash = await hashPassword('lemonade');
    expect(await verifyPassword('lemonade', hash)).toBe(true);
    expect(await verifyPassword('lemonad', hash)).toBe(false);
    expect(await verifyPassword('Lemonade', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  /*
   * A corrupt row must read as "wrong password", never as a crash. A 500 on one
   * account and a 401 on another tells an attacker which accounts exist.
   */
  it('refuses a malformed hash rather than throwing', async () => {
    for (const bad of ['', 'nonsense', 'scrypt$only$four$parts', 'bcrypt$1$2$3$aa$bb']) {
      await expect(verifyPassword('lemonade', bad)).resolves.toBe(false);
    }
  });

  it('refuses a hash whose cost this machine cannot afford', async () => {
    // N beyond the memory limit throws inside scrypt; it must surface as a
    // failed sign-in, not as a stack trace naming the account.
    const absurd = `scrypt$1073741824$8$1$${'aa'.repeat(16)}$${'bb'.repeat(64)}`;
    await expect(verifyPassword('lemonade', absurd)).resolves.toBe(false);
  });

  it('verifies a hash written at a different cost', async () => {
    // The format is self-describing, so raising the cost must not lock anybody
    // out of the account they already have.
    const { scrypt } = await import('node:crypto');
    const salt = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
    const cheap: Buffer = await new Promise((res, rej) =>
      scrypt('lemonade', salt, 64, { N: 16_384, r: 8, p: 1 }, (e, k) =>
        e ? rej(e) : res(k as Buffer),
      ),
    );
    const stored = `scrypt$16384$8$1$${salt.toString('hex')}$${cheap.toString('hex')}`;
    expect(await verifyPassword('lemonade', stored)).toBe(true);
    expect(await verifyPassword('wrong', stored)).toBe(false);
  });
});
