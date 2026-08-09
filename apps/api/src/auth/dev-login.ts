/**
 * The smoke-test sign-in door, and the lock on it.
 *
 * **This is an authentication bypass.** Telegram deep-link is the only real way
 * in, and it needs a bot, a token and a phone — which makes clicking through a
 * freshly deployed box impossible until all three exist. This route exists to
 * make that possible and for no other reason.
 *
 * Everything here is about making it hard to leave on by accident:
 *
 * - **Off unless `DEV_LOGIN_SECRET` is set.** No default, no fallback, no
 *   "development mode" inference. An unset variable is a closed door, and that
 *   is the state every environment is in until somebody types the variable.
 * - **The secret must be long.** A short one is a secret somebody chose in a
 *   hurry, and this door opens onto every student's account.
 * - **Compared in constant time**, like every other secret in this codebase.
 * - **It cannot reach an existing account.** The route only ever signs in users
 *   it created itself, under a reserved Telegram id range, so a leaked secret
 *   cannot be used to sign in *as* somebody. That is the property that makes the
 *   rest of it survivable.
 *
 * The last one is the important one. A bypass that mints its own throwaway
 * account is a nuisance if it leaks; a bypass that accepts a user id is a
 * complete compromise of every account in the product.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * The shortest secret this will accept.
 *
 * Long enough that nobody types one from memory, which is the actual failure
 * mode — `DEV_LOGIN_SECRET=test` shipped to a public box.
 */
export const MIN_SECRET_LENGTH = 32;

/**
 * Telegram ids reserved for smoke-test accounts.
 *
 * Telegram's own ids are positive. Negative ids therefore cannot collide with a
 * real account, which is what stops this route from ever reaching one — and it
 * is a property of the number, not of a check somebody has to remember.
 */
export const DEV_TELEGRAM_ID_FLOOR = -2_000_000_000;
export const DEV_TELEGRAM_ID_CEILING = -1_000_000_000;

export function isDevLoginEnabled(secret: string | undefined): boolean {
  return typeof secret === 'string' && secret.length >= MIN_SECRET_LENGTH;
}

/** Whether the presented secret is the configured one. Constant time. */
export function secretMatches(presented: string, configured: string | undefined): boolean {
  if (!isDevLoginEnabled(configured)) return false;

  // Hashed before comparison so `timingSafeEqual` gets two equal-length buffers
  // whatever was presented — its length check throws, and a throw on a length
  // mismatch is itself a length oracle.
  const a = createHash('sha256').update(presented).digest();
  const b = createHash('sha256')
    .update(configured as string)
    .digest();
  return timingSafeEqual(a, b);
}

/**
 * The Telegram id for a named smoke-test persona.
 *
 * Derived from the label so "student" is the same account every time — a tester
 * who signs in twice should find yesterday's practice history, not a new
 * account. Hashed into the reserved negative range.
 */
export function devTelegramId(label: string): number {
  const digest = createHash('sha256').update(label.trim().toLowerCase()).digest();
  const span = DEV_TELEGRAM_ID_CEILING - DEV_TELEGRAM_ID_FLOOR;
  return DEV_TELEGRAM_ID_FLOOR + (digest.readUInt32BE(0) % span);
}

/** Whether an id belongs to a smoke-test account rather than a real person. */
export function isDevTelegramId(telegramId: string | number | null | undefined): boolean {
  const id = typeof telegramId === 'string' ? Number(telegramId) : telegramId;
  if (id === null || id === undefined || !Number.isFinite(id)) return false;
  return id >= DEV_TELEGRAM_ID_FLOOR && id < DEV_TELEGRAM_ID_CEILING;
}

/**
 * A label for the log line, not the account's name.
 *
 * The product assigns its own generated display name and takes one from nobody
 * (T-086), which is right and is not worth an exception for a test account. So
 * what marks a smoke-test account in the admin search is its **negative
 * telegram id**, which `isDevTelegramId` answers — a property of the number
 * rather than a naming convention somebody has to keep up.
 *
 * This string only ever reaches the warning written when the door is used.
 */
export function devDisplayName(label: string): string {
  const cleaned = label.trim().replace(/[^A-Za-z0-9]/g, '') || 'tester';
  return `Test-${cleaned.slice(0, 12)}`;
}
