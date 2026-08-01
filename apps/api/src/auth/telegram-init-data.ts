/**
 * Validating Telegram Mini App `initData`.
 *
 * Telegram hands the web app a query string signed with the bot token. It is the
 * only proof of who the user is inside Telegram, so **everything here is a
 * security boundary**: an implementation that is merely nearly right lets anyone
 * hand-write an `initData` naming any `telegramId` they like and be signed in as
 * that person.
 *
 * Telegram's scheme (docs: "Validating data received via the Mini App"):
 *
 *   secret     = HMAC-SHA256(key: "WebAppData", message: bot_token)
 *   check      = every "key=value" pair except `hash`, sorted by key, joined "\n"
 *   signature  = HMAC-SHA256(key: secret, message: check), hex
 *
 * Note the inversion in the first step — the literal string `WebAppData` is the
 * *key* and the bot token is the *message*, not the other way round. Getting it
 * backwards produces a validator that consistently rejects real data, which
 * reads like a configuration problem and gets "fixed" by disabling the check.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface TelegramUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  languageCode: string | null;
  isPremium: boolean;
}

export type InitDataResult =
  | { ok: true; user: TelegramUser; authDate: Date; raw: Record<string, string> }
  | { ok: false; reason: string };

/**
 * How old signed data may be. Telegram's own guidance is to check `auth_date`;
 * without it a single captured `initData` is a permanent credential.
 */
export const MAX_INIT_DATA_AGE_SEC = 24 * 60 * 60;

export interface VerifyOptions {
  /** Injected rather than read from the clock so expiry is testable. */
  now?: Date;
  maxAgeSec?: number;
}

export function verifyInitData(
  initData: string,
  botToken: string,
  options: VerifyOptions = {},
): InitDataResult {
  if (botToken === '') return { ok: false, reason: 'No bot token is configured.' };
  if (initData.trim() === '') return { ok: false, reason: 'initData is empty.' };

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'initData carries no hash.' };

  const pairs: string[] = [];
  const raw: Record<string, string> = {};
  for (const [key, value] of params) {
    if (key === 'hash') continue;
    pairs.push(`${key}=${value}`);
    raw[key] = value;
  }
  // Sorted by key, not by arrival: the order a client sends fields in is not
  // part of the signature.
  pairs.sort();

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');

  if (!equalsConstantTime(expected, hash)) {
    return { ok: false, reason: 'Signature does not match.' };
  }

  const authDateRaw = raw.auth_date;
  if (!authDateRaw || !/^\d+$/.test(authDateRaw)) {
    // Signed but undatable. Accepting it would mean one captured initData works
    // forever, which is the thing auth_date exists to prevent.
    return { ok: false, reason: 'initData has no usable auth_date.' };
  }
  const authDate = new Date(Number(authDateRaw) * 1000);
  const now = options.now ?? new Date();
  const ageSec = (now.getTime() - authDate.getTime()) / 1000;
  const maxAge = options.maxAgeSec ?? MAX_INIT_DATA_AGE_SEC;
  if (ageSec > maxAge) {
    return {
      ok: false,
      reason: `initData is ${Math.floor(ageSec)}s old; the limit is ${maxAge}s.`,
    };
  }
  if (ageSec < -60) {
    // Clock skew of a minute is ordinary; an hour in the future is not.
    return { ok: false, reason: 'initData is dated in the future.' };
  }

  const user = parseUser(raw.user);
  if (!user) return { ok: false, reason: 'initData carries no usable user.' };

  return { ok: true, user, authDate, raw };
}

/**
 * Compares two hex digests without leaking where they first differ.
 *
 * `===` on a signature is a timing oracle. It is a small one over a network, but
 * it costs nothing to close and the habit is what matters.
 */
function equalsConstantTime(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  // timingSafeEqual throws on a length mismatch, which would itself leak — and a
  // wrong-length hash is simply invalid.
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function parseUser(json: string | undefined): TelegramUser | null {
  if (!json) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const u = parsed as Record<string, unknown>;
  // Telegram sends a number; it is kept as a string here because it is an
  // identifier, not a quantity, and ids beyond 2^53 must not round.
  const id = typeof u.id === 'number' ? String(u.id) : typeof u.id === 'string' ? u.id : null;
  if (!id || !/^\d+$/.test(id)) return null;

  const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

  return {
    id,
    firstName: str(u.first_name),
    lastName: str(u.last_name),
    username: str(u.username),
    languageCode: str(u.language_code),
    isPremium: u.is_premium === true,
  };
}
