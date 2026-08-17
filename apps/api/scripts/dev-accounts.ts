/**
 * Identities the local development scripts share.
 *
 * A module of its own because importing a *script* to borrow a constant runs
 * that script: pulling this out of `dev-session.ts` made `dev:publish` mint a
 * session and print a token every time it ran. Constants that two scripts must
 * agree on belong somewhere neither of them executes.
 */

/**
 * The account `dev:session` signs in as.
 *
 * A string rather than a number, so it can never collide with a real Telegram
 * id — which also means `isDevTelegramId`, which is about the reserved numeric
 * range, correctly says no to it. Anything deciding "is this a fixture account"
 * has to check both.
 */
export const DEV_SESSION_TELEGRAM_ID = 'dev-local-session';
