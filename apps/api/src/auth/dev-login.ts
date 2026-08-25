/**
 * Identity for the seeded test personas.
 *
 * **The authentication bypass this file used to hold is gone (T-206a).** It was
 * `POST /auth/dev-login`: present a shared secret, receive a session, no
 * password involved. It existed because Telegram deep-link was once the only
 * way in, which made clicking through a freshly deployed box impossible without
 * a bot, a token and a phone. Phone-and-password sign-in removed that excuse,
 * so the door, the secret, `isDevLoginEnabled` and `secretMatches` went with it.
 *
 * What remains is not a door and cannot open one: a stable way to name the
 * smoke-test accounts. `dev:testers` derives each persona's Telegram id — and
 * from it, their phone number — by hashing the label, so a persona's identity
 * depends on nothing but its own name and the list can be reordered freely.
 *
 * **The reserved id range is a safety property, not a leftover.** Telegram's
 * own ids are positive, so a negative id cannot collide with a real account.
 * That is what lets `dev:testers` delete and rewrite rows without any chance of
 * touching a student, even pointed at a database that has some — and it is a
 * property of the number rather than of a check somebody has to remember.
 */
import { createHash } from 'node:crypto';

/**
 * Telegram ids reserved for smoke-test accounts.
 *
 * Telegram's own ids are positive. Negative ids therefore cannot collide with a
 * real account, which is what stops this route from ever reaching one — and it
 * is a property of the number, not of a check somebody has to remember.
 */
export const DEV_TELEGRAM_ID_FLOOR = -2_000_000_000;
export const DEV_TELEGRAM_ID_CEILING = -1_000_000_000;


/**
 * The Telegram id for a named smoke-test persona.
 *
 * Derived from the label so "student" is the same account every time — a tester
 * who signs in twice should find yesterday's practice history, not a new
 * account. Hashed into the reserved negative range.
 *
 * **Spacing and punctuation are stripped before hashing**, so "User B", "userb"
 * and "user-b" are one account rather than three. They were three: the seeded
 * personas are labelled `userb`, testers are handed a brief that calls them
 * "User B", and typing the name they were given quietly minted a brand-new
 * empty account with a generated display name. The account was fine, the
 * history was gone, and nothing said why — every seeded state a tester was
 * asked to check was unreachable by the name they had for it.
 *
 * Nothing rests on this being hard to guess: the door is closed unless
 * `DEV_LOGIN_SECRET` is set, and the range it hashes into can only ever hold
 * smoke-test accounts.
 */
/**
 * The personas this door will open, and nothing else.
 *
 * It used to mint an account for whatever arrived. QA typed a few names that
 * were not on the page, got a silent 201 each time, and left junk accounts —
 * one called "KindLantern3166" — sitting in the provider activity feed and the
 * admin user list, indistinguishable from a real signup at a glance.
 *
 * Minting on demand was deliberate and is still right for the twelve seeded
 * states; it is *unbounded* minting that has no defence. An allowlist keeps the
 * property that matters — every account lands in the reserved negative range,
 * so a leaked secret is a nuisance rather than a takeover — and adds the one
 * that was missing: a name nobody put here is a mistake, and gets told so.
 *
 * `student` is the generic tester the automated suites use.
 */
export const DEV_PERSONAS = [
  'usera',
  'userb',
  'userc',
  'userd',
  'usere',
  'userf',
  'userg',
  'userh',
  'useri',
  'userj',
  'userk',
  'userl',
  'userm',
  'usern',
  'usero',
  'admin',
  'provider',
  'student',
] as const;

/** Normalised the way `devTelegramId` normalises, so "User B" matches `userb`. */
export function personaKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function isKnownPersona(label: string): boolean {
  return (DEV_PERSONAS as readonly string[]).includes(personaKey(label));
}

export function devTelegramId(label: string): number {
  const key = personaKey(label);
  const digest = createHash('sha256').update(key).digest();
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
