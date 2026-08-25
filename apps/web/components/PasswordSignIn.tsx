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
import { Card } from './Card';
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
      window.location.assign('/home');
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        setProblem(c.signIn.tooMany);
      } else {
        // Deliberately not `refusalMessage`: the server's words and these are
        // the same sentence, and a network failure must not read as a rejected
        // password.
        setProblem(c.signIn.signInFailed);
      }
      setBusy(false);
    }
  };

  return (
    <Card as="section" data-password-sign-in="" className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="flex flex-col gap-1">
          <Input
            label={c.signIn.phoneLabel}
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
          <span className="text-caption text-ink-2">{c.signIn.phoneHint}</span>
        </div>

        <Input
          label={c.signIn.passwordLabel}
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
          The two ways out of this screen, and until now there were none.

          A student who could not sign in had nowhere to go: no account yet, or
          a forgotten password, and both dead-ended here. Phone-and-password
          makes the second more likely than the Telegram pairing it replaced —
          a forgotten password used to be impossible — so the reset link is not
          a nicety, it is the other half of the door.
        */}
        {/*
          `min-h-11` and vertical padding, not bare text.

          As plain 18px links these were the two smallest tap targets in the
          product — on the one screen a locked-out student has to use, on a
          phone, probably in a hurry. The layout sweep failed them at all three
          widths, which is exactly what it is for.
        */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <a
            href="/reset"
            className="text-caption text-ink-2 flex min-h-11 items-center px-1 underline"
          >
            {c.signIn.forgotPassword}
          </a>
          <a href="/signup" className="text-caption flex min-h-11 items-center px-1 underline">
            {c.signIn.noAccount}
          </a>
        </div>
      </form>
    </Card>
  );
}
