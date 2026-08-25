/**
 * A session for a seeded test persona, through the real front door (T-206a).
 *
 * **The tooling used to mint sessions with an authentication bypass.** Three
 * scripts posted a shared secret to `POST /auth/dev-login` and got a session
 * back without a password. That endpoint is deleted — it was a launch blocker
 * and the sort of thing that ships to production once and is remembered forever
 * — so the scripts sign in the way a student does, with the phone number and
 * password `dev:testers` seeds.
 *
 * That is a better test as well as a safer one. A checker that authenticates
 * through a special door proves nothing about the door everybody else uses; this
 * one fails if sign-in fails, which is exactly when a screenshot sweep should
 * stop and say so.
 *
 * The number is derived here rather than listed, because it is derived in
 * `dev-testers.ts` too and a second copy of a table is a second thing to update.
 * Node has `crypto`, so the algorithm runs directly — the browser bundle cannot
 * do that synchronously, which is why `DevLoginScreen` carries literals and a
 * contract test instead.
 */
import { createHash } from 'node:crypto';

/**
 * The reserved smoke-test id range, from `dev-login.ts`.
 *
 * Kept in step by `dev-login.contract.test.ts`, which reads these same constants
 * out of the API source. If they ever move, that test recomputes and fails.
 */
const DEV_TELEGRAM_ID_FLOOR = -2_000_000_000;
const DEV_TELEGRAM_ID_CEILING = -1_000_000_000;

/** The password `dev:testers` sets on every seeded account. */
export const TEST_PASSWORD = process.env.DEV_TESTER_PASSWORD ?? 'lomi-test-2026';

/** `devTelegramId`, from `apps/api/src/auth/dev-login.ts`. */
function devTelegramId(label) {
  const key = label.trim().toLowerCase().replace(/\s+/g, '');
  const digest = createHash('sha256').update(key).digest();
  const span = DEV_TELEGRAM_ID_CEILING - DEV_TELEGRAM_ID_FLOOR;
  return DEV_TELEGRAM_ID_FLOOR + (digest.readUInt32BE(0) % span);
}

/** `phoneFor`, from `apps/api/scripts/dev-testers.ts`. */
export function phoneFor(label) {
  return `09${String(Math.abs(devTelegramId(label)) % 100_000_000).padStart(8, '0')}`;
}

/**
 * Tokens already minted this run, by persona.
 *
 * **Signing in through the front door means meeting the front door's limits.**
 * The layout sweep visits twenty routes and re-signs for each one, which is six
 * personas but twenty sign-ins — past `passwordSignIn`'s five-per-ten-minutes
 * on the busiest persona, and the whole run died on a 429. The bypass never had
 * that problem because it never had a limit, which is precisely what was wrong
 * with it.
 *
 * One session per persona per run. Fewer requests, and it matches what a real
 * client does: sign in once, keep the session.
 */
const minted = new Map();

/**
 * Signs in as a persona and returns the session token, reusing one per run.
 *
 * Throws with the persona named. A sweep that carried on with no session would
 * measure the signed-out version of every page and report it as fine, which is
 * a far more expensive failure than stopping.
 */
export async function sessionToken(api, label) {
  const held = minted.get(label);
  if (held) return held;
  const token = await signInFresh(api, label);
  minted.set(label, token);
  return token;
}

async function signInFresh(api, label) {
  const response = await fetch(`${api}/auth/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: phoneFor(label),
      password: TEST_PASSWORD,
      deviceLabel: 'Design checker',
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Could not sign in as "${label}" (${response.status}). ` +
        'Run `npm run dev:testers -w api` against a local database first.',
    );
  }
  return (await response.json()).token;
}
