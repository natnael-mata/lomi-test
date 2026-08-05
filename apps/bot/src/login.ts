/**
 * The bot's half of the web sign-in (T-076).
 *
 * A student on the web taps a link, Telegram opens this bot with
 * `/start login_<nonce>`, and the bot asks them to confirm. Only on confirm does
 * the API learn which Telegram account is signing in.
 *
 * **The confirmation is not a formality.** Without it, an attacker opens
 * Lomi-Test on their own machine, forwards the resulting link to a student —
 * "here, sign in" — and the moment the student taps it, the attacker's browser
 * holds a session as that student. The prompt exists so the student is agreeing
 * to a specific request they can see on their own screen, not tapping Yes on an
 * unlabelled question.
 *
 * So the copy names the pairing code and says plainly what to do if they were
 * not expecting this. It is the only thing standing between a forwarded message
 * and somebody's account, and wording it as a cheerful "Confirm?" would waste
 * it.
 */

export interface LoginApi {
  prompt(nonce: string): Promise<{ pairingCode: string; deviceLabel: string | null }>;
  approve(
    nonce: string,
    telegram: { id: string; username?: string | undefined },
  ): Promise<{ pairingCode: string }>;
  decline(nonce: string): Promise<void>;
}

export const CONFIRM_PREFIX = 'login:yes:';
export const DECLINE_PREFIX = 'login:no:';

/** What the bot says when asked to sign somebody in. */
export function confirmText(pairingCode: string, deviceLabel: string | null): string {
  const where = deviceLabel ? ` on ${deviceLabel}` : '';
  return [
    `Someone is signing in to Lomi-Test${where}.`,
    '',
    `The page should be showing this number: ${pairingCode}`,
    '',
    'If it does, tap "Yes, that is me".',
    'If it does not — or you were not signing in just now — tap "No" and nothing happens.',
  ].join('\n');
}

/** After a confirm. Says where to look, because the browser is the other screen. */
export const APPROVED_TEXT = 'Signed in. Go back to the page you opened — it is ready.';

/** After a decline. Says what was and was not done. */
export const DECLINED_TEXT =
  'Nothing was signed in. If that was not you, you do not need to do anything else — the link is now dead.';

/** When the link is stale, already used, or was never real. */
export const UNUSABLE_TEXT =
  'That sign-in link has run out or has already been used. Open Lomi-Test again for a fresh one.';

/**
 * A plain `/start`, with no login payload.
 *
 * Kept as the existing welcome: `/start` is also how people meet the bot for the
 * first time and how referral links arrive (T-180), so a login-shaped reply to
 * every `/start` would be wrong far more often than right.
 */
export const WELCOME_TEXT = [
  'Lomi-Test — exit exam practice where every answer is explained.',
  '',
  'Practice in the app, and I will send you a question a day.',
].join('\n');
