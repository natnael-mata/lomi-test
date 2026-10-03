'use client';

/**
 * Signing in with a phone number and a password (T-263).
 *
 * **The phone number is the username.** It is the one identifier an Ethiopian
 * student already has, cannot forget, and that a reset can be sent to — which is
 * why the label says "phone number" and never "username". Calling it a username
 * invites somebody to invent one, and an invented username is a support ticket
 * three months later.
 *
 * **Sent exactly as typed.** The server normalises `0911…`, `+251911…` and
 * `251 91 1…` to one handset, so this field accepts any of them and the client
 * never has to know the rules. Validating the shape here would mean two
 * implementations that can disagree, and the one on the phone is the one that
 * would be wrong.
 *
 * **One failure message.** Wrong password, unknown number, no password set — the
 * server answers identically for all three, and so does this. Telling them apart
 * would publish which numbers hold accounts, and Ethiopian mobile numbers are
 * issued in guessable blocks.
 *
 * This replaces the Telegram deep link as the way *in*; Telegram remains as a
 * linked channel, because an account that loses its history when a student
 * changes SIM is the failure the handoff is most explicit about avoiding.
 */
import { useState } from 'react';

import { Button } from './Button';
import { Input } from './Input';
import { ApiError, api } from '../lib/api';
import { copy } from '../lib/i18n';

export function PasswordSignIn() {
  const c = copy();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    if (busy || phone.trim() === '' || password === '') return;
    setBusy(true);
    setProblem(null);
    try {
      await api.signInWithPassword(phone, password);
      // A full load rather than a client route: the session cookie has just
      // changed, and every screen behind this one reads it on mount.
      window.location.assign('/today');
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0;
      if (status === 429) {
        // The wait, in words. The server sends `retryAfterSec`, and it can be
        // in the hundreds — "try again in 525 seconds" is a sum, not a sentence.
        const wait = Number(
          (error as ApiError).body &&
            ((error as ApiError).body as { retryAfterSec?: unknown }).retryAfterSec,
        );
        setProblem(c.signIn.tooMany(Number.isFinite(wait) && wait > 0 ? wait : 600));
      } else if (status === 401) {
        // The only case where the password is genuinely in question.
        setProblem(c.signIn.signInFailed);
      } else {
        /*
         * A fault, and named as one.
         *
         * This branch used to fall through to `signInFailed`, which is the
         * sentence about a wrong password — so a 500, a dropped connection or a
         * CORS failure all told the student their credentials were wrong. The
         * comment here already said a network failure must not read as a
         * rejected password; the code did not do it.
         */
        setProblem(c.signIn.signInBroken);
      }
      setBusy(false);
    }
  };

  return (
    /*
      No card.

      The form was wrapped in one, on a screen whose entire content is the form
      — so the card had nothing to separate it from, and a white card on a white
      page at 440px is a border for its own sake. DESIGN.md's rule is already
      that "a card is never used merely to put a border round a paragraph".
    */
    <section data-password-sign-in="" className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input
          label={c.signIn.phoneLabel}
          hint={c.signIn.phoneHint}
          name="phone"
          type="tel"
          // `tel` brings up the number pad, and `username` is what a password
          // manager needs to offer the right entry — the field is the username
          // even though the word never appears on screen.
          autoComplete="username"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <Input
          /*
            "Forgot?" rides the label (handoff § Sign in).

            It was at the foot of the form beside "Create an account", two links
            of equal weight for two completely different people — one who has an
            account and cannot get in, one who has none. Next to the field it is
            about, it is an answer to the question the field just raised.
          */
          label={
            <span className="flex items-center justify-between gap-3">
              {c.signIn.passwordLabel}
              <a
                href="/reset"
                className="text-link hover:text-link-hover -my-2 -mr-1 inline-flex min-h-11 items-center px-1 font-semibold"
              >
                {c.signIn.forgotPassword}
              </a>
            </span>
          }
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {problem && (
          <p className="text-caption text-wrong" data-sign-in-problem="">
            {problem}
          </p>
        )}

        <Button type="submit" disabled={busy || phone.trim() === '' || password === ''}>
          {busy ? c.signIn.signingIn : c.signIn.signInAction}
        </Button>

        {/*
          The way out for somebody with no account.

          Both ways out used to be here, side by side and identical in weight: a
          forgotten password and no account at all, two different people told
          the same thing twice. "Forgot?" has moved up to the field it is about,
          which leaves this one sentence doing one job.

          `min-h-11` and padding rather than bare text, because as a plain
          inline link this was among the smallest tap targets in the product —
          on the one screen a locked-out student has to use, on a phone,
          probably in a hurry. The layout sweep failed it at all three widths.
        */}
        <p className="text-ink-2 flex flex-wrap items-center justify-center gap-1 text-[15px]">
          {c.signIn.newHere}
          <a
            href="/signup"
            className="text-link hover:text-link-hover inline-flex min-h-11 items-center px-1 font-semibold"
          >
            {c.signIn.noAccount}
          </a>
        </p>
      </form>
    </section>
  );
}
