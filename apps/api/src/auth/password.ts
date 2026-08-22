/**
 * Password hashing (T-263).
 *
 * **`scrypt`, from Node's own crypto.** Not a new dependency, and not a choice
 * made to avoid one: scrypt is a memory-hard KDF designed for exactly this, it
 * is in the standard library of the runtime already deployed, and a password
 * hash is the last thing in a codebase that should depend on a package whose
 * native build can fail on the machine you are deploying from. bcrypt and argon2
 * are both fine and both need a compiler on the VPS.
 *
 * **Never store, log or return a password.** Only the derived hash is written,
 * and the format below carries its own parameters so a future increase in cost
 * can verify old hashes while writing stronger new ones — a hash format with no
 * version in it is one nobody can ever change.
 *
 * Pure, no database and no clock, so every branch is testable in milliseconds.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * `scrypt` as a promise, typed for the options form.
 *
 * Hand-wrapped rather than `promisify`d: `promisify` picks the three-argument
 * overload and drops the one that takes cost parameters, so the options object
 * this file depends on becomes a type error. Wrapping keeps the signature the
 * code actually uses.
 */
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derived) =>
      err ? reject(err) : resolve(derived),
    );
  });
}

/**
 * Cost parameters.
 *
 * `N = 2^15` is roughly 100ms and 32MB per hash on a modest VPS — slow enough
 * that guessing a stolen table is expensive, fast enough that a student signing
 * in on a bad connection never notices it. It is written into every hash, so
 * raising it later does not invalidate what is already stored.
 */
const COST = { N: 32_768, r: 8, p: 1 } as const;

/**
 * The memory scrypt is allowed to use, computed rather than guessed.
 *
 * scrypt needs roughly `128 × N × r` bytes — 33.5MB at the cost above — and
 * Node's default ceiling is 32MB, so the parameters this file chose threw
 * `memory limit exceeded` on every hash. Caught by its own unit test before it
 * reached a sign-in route, which is the only good place to find it.
 *
 * Doubled, so raising `N` one notch does not require remembering this line.
 */
const maxmemFor = (N: number, r: number): number => 128 * N * r * 2;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/**
 * The shortest password this product will accept.
 *
 * Eight, and no composition rules. **Requiring a symbol and a capital produces
 * `Password1!` on every account in the country** — a rule that is trivially
 * satisfiable in one predictable way is a rule an attacker's dictionary already
 * knows. Length is the property that actually costs a guesser something, and it
 * is the only one a student can satisfy in a way we cannot predict.
 *
 * Eight rather than twelve because this is a phone-first product for teenagers
 * typing on a handset, the account holds practice history rather than money, and
 * a floor people work around by writing it on the desk is worse than a lower one
 * they can keep in their head.
 */
export const MIN_PASSWORD_LENGTH = 8;

export interface PasswordProblem {
  ok: false;
  reasons: string[];
}

export type PasswordCheck = { ok: true } | PasswordProblem;

/** Whether a password may be set. Says everything wrong with it at once. */
export function checkPassword(password: unknown): PasswordCheck {
  const reasons: string[] = [];
  if (typeof password !== 'string' || password.length === 0) {
    return { ok: false, reasons: ['A password is required.'] };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    reasons.push(`A password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  /*
   * Trimmed ends are refused rather than silently stripped.
   *
   * A password with a trailing space typed on a phone keyboard is nearly always
   * the autocorrect, and silently trimming it means the one they set and the one
   * they type next week differ by a character nobody can see.
   */
  if (password !== password.trim()) {
    reasons.push('A password cannot begin or end with a space.');
  }
  return reasons.length > 0 ? { ok: false, reasons } : { ok: true };
}

/**
 * `scrypt$N$r$p$salt$hash`, all hex.
 *
 * Self-describing on purpose: `verify` reads the cost out of the stored string
 * rather than assuming today's constants, so a hash written before a cost
 * increase still verifies afterwards.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password, salt, KEY_LENGTH, {
    ...COST,
    maxmem: maxmemFor(COST.N, COST.r),
  });
  return ['scrypt', COST.N, COST.r, COST.p, salt.toString('hex'), derived.toString('hex')].join(
    '$',
  );
}

/**
 * Whether a password matches a stored hash.
 *
 * **Returns false rather than throwing on a malformed hash.** A row with a
 * corrupt or truncated hash must fail to sign in, not crash the route — the
 * second is a way to tell an attacker that the account exists.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, n, r, p, saltHex, hashHex] = parts;
  const N = Number(n);
  const rr = Number(r);
  const pp = Number(p);
  if (!Number.isInteger(N) || !Number.isInteger(rr) || !Number.isInteger(pp)) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex!, 'hex');
    expected = Buffer.from(hashHex!, 'hex');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  let derived: Buffer;
  try {
    derived = await scrypt(password, salt, expected.length, {
      N,
      r: rr,
      p: pp,
      maxmem: maxmemFor(N, rr),
    });
  } catch {
    // A stored cost this machine cannot afford (`N` beyond the memory limit)
    // must read as "wrong password", not as a 500 naming the account.
    return false;
  }

  // Constant time. A `===` here leaks how much of the hash matched, one byte at
  // a time, to anybody who can measure the response.
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
