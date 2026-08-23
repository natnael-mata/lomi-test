/**
 * One-time codes, and the rules around them (T-264).
 *
 * Pure — no database, no clock of its own, no randomness it did not receive. The
 * awkward cases here are all about *time* and *counting*, and both are testable
 * in milliseconds when they are arguments rather than ambient.
 *
 * **Every constant below is a cost decision, not a preference.** An SMS costs
 * money and a telecom balance is finite; an unthrottled send endpoint is how it
 * disappears overnight, and that is a documented failure mode of products doing
 * exactly this, not a hypothetical.
 */
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Six digits.
 *
 * Long enough that guessing is a million-to-one against a capped attempt count,
 * short enough to be read off a lock screen and typed with one thumb. Four
 * digits would be ten thousand, which five guesses gets uncomfortably close to
 * over a large enough user base.
 */
export const CODE_LENGTH = 6;

/**
 * How long a code lives.
 *
 * Ten minutes covers a slow SMS on a rural network with room to spare, and a
 * code that lives for an hour is fifty extra minutes of somebody else's guesses.
 */
export const CODE_TTL_SEC = 600;

/**
 * Wrong guesses allowed against one code.
 *
 * Five, then the code is dead and a new one must be sent. A million
 * possibilities is only a million if the attempts are counted — uncounted, six
 * digits is a formality.
 */
export const MAX_ATTEMPTS = 5;

/**
 * The wait before a second code may be sent to the same number.
 *
 * Sixty seconds. Short enough that a student whose SMS is genuinely slow can
 * ask again without giving up, long enough that "resend" is not a button that
 * spends money as fast as it can be pressed.
 */
export const RESEND_COOLDOWN_SEC = 60;

/** A six-digit code, zero-padded, from a cryptographic source. */
export function generateCode(): string {
  // `randomInt` and not `Math.random()`: the latter is seeded and predictable,
  // and a predictable one-time code is not one.
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0');
}

/**
 * The stored form of a code.
 *
 * Plain SHA-256 rather than a slow KDF, and that is deliberate. A password hash
 * must survive an offline attack for years; this must survive ten minutes
 * against six digits, which no hash can — the defence is the attempt cap and
 * the expiry, not the cost of hashing. Making it slow would only add latency to
 * every verification while changing nothing an attacker faces.
 */
export function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/** Constant-time comparison, so a partial match leaks nothing through timing. */
export function codeMatches(supplied: string, storedHash: string): boolean {
  const a = Buffer.from(hashCode(supplied), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** What a stored code looks like to the rules below. */
export interface StoredCode {
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
  createdAt: Date;
}

export type CodeVerdict =
  { ok: true } | { ok: false; reason: 'expired' | 'consumed' | 'exhausted' | 'wrong' };

/**
 * Whether a supplied code may be accepted.
 *
 * The order matters and is not alphabetical: expiry and consumption are checked
 * **before** the code is compared, so a spent or stale code costs an attacker
 * nothing to discover and tells them nothing about whether their digits were
 * right.
 */
export function checkCode(supplied: string, stored: StoredCode, now: Date): CodeVerdict {
  if (stored.consumedAt !== null) return { ok: false, reason: 'consumed' };
  if (stored.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: 'expired' };
  if (stored.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'exhausted' };
  if (!codeMatches(supplied, stored.codeHash)) return { ok: false, reason: 'wrong' };
  return { ok: true };
}

/**
 * Seconds a caller must wait before another code may be sent, or 0.
 *
 * Takes the newest code for the number, or null when there is none.
 */
export function cooldownRemainingSec(newest: { createdAt: Date } | null, now: Date): number {
  if (newest === null) return 0;
  const elapsed = (now.getTime() - newest.createdAt.getTime()) / 1000;
  return Math.max(0, Math.ceil(RESEND_COOLDOWN_SEC - elapsed));
}

/** When a code created now should stop being accepted. */
export function expiryFrom(now: Date): Date {
  return new Date(now.getTime() + CODE_TTL_SEC * 1000);
}
