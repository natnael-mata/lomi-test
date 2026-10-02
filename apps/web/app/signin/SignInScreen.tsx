/**
 * Signing in (T-265, redesigned 2026-10-01).
 *
 * **A phone number and a password, and nothing else.**
 *
 * This screen used to be the Telegram deep link: mint a request, open the bot,
 * approve a pairing code, poll for a session. That flow is gone — from here and
 * from the API — because the product now identifies a student by the one thing
 * they already have and cannot forget, which is their number.
 *
 * Telegram is not deleted, it is demoted. It remains a *linked channel* for the
 * daily-question bot and for account recovery, and `POST /auth/link/telegram`
 * still exists to attach a chat to an account that is already signed in. What it
 * is no longer is a way *in*.
 *
 * **The three-line explainer is gone.** It was a card under the form reading
 * "sign in with your number", "new here? sign up", "your first 10 are free" —
 * the third of which is the only one that was news, and the first of which
 * described the form immediately above it. The landing page now makes the
 * argument at length and this screen is for somebody who has already been
 * convinced; a returning student does not need the pitch again between their
 * password and the button.
 */
import { AuthShell } from '../../components/AuthShell';
import { PasswordSignIn } from '../../components/PasswordSignIn';
import { copy } from '../../lib/i18n';

const c = copy();

export function SignInScreen() {
  return (
    <AuthShell title={c.signIn.welcomeTitle} subtitle={c.signIn.welcomeBody}>
      <PasswordSignIn />
      <p className="text-caption text-ink-3 text-center">{c.signIn.coverage}</p>
    </AuthShell>
  );
}
