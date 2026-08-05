/**
 * The Telegram deep-link sign-in (T-075–T-078), with no database involved.
 *
 * **Why this replaced SMS.** A bot cannot message a phone number — Telegram only
 * lets a bot write to someone who has already opened a chat with it, and there
 * is no phone-to-user lookup. So the SMS shape ("type your number, receive a
 * code") does not port. What ports is better: the browser asks for a link, the
 * student taps it, the bot answers with an identity Telegram itself signed, and
 * there is no code to type at all.
 *
 * **The attack this is built around.** The obvious implementation puts a nonce
 * in a link and hands a session to whoever presents that nonce. Then an attacker
 * opens Lomi-Test on their own machine, forwards the resulting link to a
 * student — "here, sign in" — and the moment the student taps it, the attacker's
 * browser is signed in as them. Nothing about that requires any skill.
 *
 * Two things stop it, and both are needed:
 *
 * 1. **A secret that never travels in the link.** The browser keeps
 *    `pollSecret`; only the nonce goes to Telegram. Presenting the nonce proves
 *    nothing, so the session can only be collected by the browser that asked.
 *    That alone still loses to the forwarding attack above — the attacker *is*
 *    the browser that asked — which is why there is also:
 *
 * 2. **A confirmation naming a pairing code.** The web page shows a short code
 *    and the bot repeats it, so a student is confirming a specific request they
 *    can see rather than tapping Yes on an unlabelled prompt. It does not defeat
 *    a full phishing page, which nothing at this layer can; it defeats the
 *    forwarded-link version, which is the one that needs no infrastructure.
 *
 * Everything else is the cheap stuff that has to be right anyway: two-minute
 * expiry, single use, and the sign-in landing in the devices list so it is
 * visible and revocable (T-083, T-084).
 */

/** Two minutes. A login link is a session sitting in a chat log. */
export const LOGIN_REQUEST_TTL_SEC = 120;

/** The deep-link payload prefix. `/start` payloads are shared with referrals (T-180). */
export const LOGIN_PAYLOAD_PREFIX = 'login_';

/**
 * Telegram's `start` payload is limited to 64 characters and to this alphabet.
 * A nonce that overflows either produces a link that silently does not work.
 */
export const START_PAYLOAD_MAX = 64;
const START_PAYLOAD_ALLOWED = /^[A-Za-z0-9_-]+$/;

export type RequestState = 'pending' | 'approved' | 'declined' | 'claimed' | 'expired';

export interface LoginRequestRow {
  expiresAt: Date;
  approvedAt: Date | null;
  declinedAt: Date | null;
  claimedAt: Date | null;
}

/**
 * What a login request currently is.
 *
 * **Settled outcomes beat the clock.** A request that was declined stays
 * declined after it expires, and a claimed one stays claimed — otherwise the
 * record of "somebody tried to sign in as me" turns into a bare "expired" two
 * minutes later, which is exactly the thing worth being able to find.
 */
export function requestState(row: LoginRequestRow, now: Date = new Date()): RequestState {
  if (row.claimedAt !== null) return 'claimed';
  if (row.declinedAt !== null) return 'declined';
  if (now.getTime() >= row.expiresAt.getTime()) return 'expired';
  if (row.approvedAt !== null) return 'approved';
  return 'pending';
}

/** Whether the bot may still approve or decline this request. */
export function canDecide(row: LoginRequestRow, now: Date = new Date()): boolean {
  return requestState(row, now) === 'pending';
}

/** Whether the browser may still exchange its secret for a session. */
export function canClaim(row: LoginRequestRow, now: Date = new Date()): boolean {
  return requestState(row, now) === 'approved';
}

export function expiryFrom(now: Date, ttlSec: number = LOGIN_REQUEST_TTL_SEC): Date {
  return new Date(now.getTime() + ttlSec * 1000);
}

/** The payload that goes after `?start=`. */
export function startPayload(nonce: string): string {
  return `${LOGIN_PAYLOAD_PREFIX}${nonce}`;
}

/**
 * The nonce out of a `/start` payload, or `null` if it is not a login payload.
 *
 * Returns `null` rather than throwing on anything unrecognised: `/start` also
 * carries referral codes (T-180) and whatever else is added later, so "not mine"
 * is an ordinary answer here, not an error.
 */
export function nonceFromPayload(payload: string): string | null {
  if (!payload.startsWith(LOGIN_PAYLOAD_PREFIX)) return null;
  const nonce = payload.slice(LOGIN_PAYLOAD_PREFIX.length);
  if (nonce.length === 0 || !START_PAYLOAD_ALLOWED.test(nonce)) return null;
  return nonce;
}

/**
 * The `t.me` link the browser shows.
 *
 * `botUsername` is taken without an `@`; a link built with one 404s, and that
 * failure looks like "the login is broken" rather than "the config has a stray
 * character in it".
 */
export function deepLink(botUsername: string, nonce: string): string {
  const bot = botUsername.replace(/^@/, '');
  return `https://t.me/${bot}?start=${startPayload(nonce)}`;
}

/**
 * Whether a payload will survive the trip through Telegram.
 *
 * Checked rather than assumed, because the failure is silent: Telegram drops an
 * over-long or out-of-alphabet payload and delivers a bare `/start`, so the bot
 * sees somebody opening it for the first time and the login simply never
 * completes, with nothing anywhere saying why.
 */
export function isDeliverablePayload(payload: string): boolean {
  return payload.length <= START_PAYLOAD_MAX && START_PAYLOAD_ALLOWED.test(payload);
}

/**
 * The short code the student checks the bot's prompt against.
 *
 * Digits only, and read as a number rather than spelled out: it is compared
 * across two screens by someone in a hurry, and letters invite the l/1 and O/0
 * confusions at exactly the moment attention is lowest.
 */
export function pairingCodeFrom(bytes: Uint8Array): string {
  const n = ((bytes[0] ?? 0) << 8) | (bytes[1] ?? 0);
  return String(n % 1000).padStart(3, '0');
}
