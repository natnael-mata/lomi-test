/**
 * Signing in (T-265).
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
 * There is no polling, no nonce, no `pollSecret` and no countdown here any more
 * — a server component would do, but the form below is a client one and the
 * whole page follows it rather than splitting one card across two files.
 */
import { PasswordSignIn } from '../../components/PasswordSignIn';
import { Card } from '../../components/Card';
import { Logo } from '../../components/Logo';
import { copy } from '../../lib/i18n';

const c = copy();

export function SignInScreen() {
  return (
    <div className="flex min-h-dvh flex-col justify-center gap-4 py-6">
      <div className="mb-1 flex flex-col items-center gap-3">
        <Logo size={56} />
        <h1 className="text-title text-center">{c.signIn.valueTitle}</h1>
        <p className="text-body text-ink-2 text-center">{c.signIn.valueBody}</p>
      </div>

      <PasswordSignIn />

      {/* What the product is, in three lines. It describes what is true today:
          sign in with a number and a password, and register by verifying a
          number. Nothing here hints at a flow that does not exist. */}
      <Card as="section" className="flex flex-col gap-3">
        {[c.signIn.step1, c.signIn.step2, c.signIn.step3].map((step, index) => (
          <p key={step} className="text-body flex items-start gap-3">
            <span className="option-key">{index + 1}</span>
            <span>{step}</span>
          </p>
        ))}
      </Card>

      <p className="text-caption text-ink-2 text-center">{c.signIn.coverage}</p>
    </div>
  );
}
