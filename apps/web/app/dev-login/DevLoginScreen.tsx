'use client';

/**
 * Pick-a-tester sign-in, for local testing only (T-206a).
 *
 * **This product has no username and password.** Sign-in is the Telegram deep
 * link, and that needs a bot, a token and a phone — none of which exist while
 * somebody is clicking through the app on a laptop. This screen stands in for
 * that: every prepared tester, one tap each, no typing.
 *
 * It is the same door as `POST /auth/dev-login`, which is shut unless
 * `DEV_LOGIN_SECRET` is set. Production does not set it, so this page renders
 * and every button fails — which is the correct behaviour, not a bug.
 *
 * **Delete with the rest of the smoke-test door (T-206a).** It is listed there
 * as a launch blocker.
 */
import { useState } from 'react';

import { Card } from '../../components/Card';
import { copy } from '../../lib/i18n';

/** The testers. Same label every time, so each keeps its own history. */
const c = copy();

/*
 * The labels must match `PERSONAS` in `apps/api/scripts/dev-testers.ts`.
 *
 * The label is hashed into the account's Telegram id, so it *is* the identity:
 * change one here without changing it there and this button signs in to a fresh
 * empty account while the prepared one sits unreachable.
 *
 * **And a persona missing from this list is unreachable.** Five were: the seed
 * and the API knew User K through User O, this array did not, and a whole QA
 * pass came back with four of its seven runs unrunnable — the leaderboard's
 * junior band, the Grade 12 Natural/Social split, and coverage all sit behind
 * exactly those five accounts. Nothing failed; there was simply no button. The
 * guard in `dev-login.contract.test.ts` holds this list against `DEV_PERSONAS`
 * so the next persona cannot be added on one side only.
 */
export const TESTERS = [
  { label: 'usera', who: c.devLogin.userA, note: c.devLogin.userANote },
  { label: 'userb', who: c.devLogin.userB, note: c.devLogin.userBNote },
  { label: 'userc', who: c.devLogin.userC, note: c.devLogin.userCNote },
  { label: 'userd', who: c.devLogin.userD, note: c.devLogin.userDNote },
  { label: 'usere', who: c.devLogin.userE, note: c.devLogin.userENote },
  { label: 'userf', who: c.devLogin.userF, note: c.devLogin.userFNote },
  { label: 'userg', who: c.devLogin.userG, note: c.devLogin.userGNote },
  { label: 'userh', who: c.devLogin.userH, note: c.devLogin.userHNote },
  { label: 'useri', who: c.devLogin.userI, note: c.devLogin.userINote },
  { label: 'userj', who: c.devLogin.userJ, note: c.devLogin.userJNote },
  { label: 'userk', who: c.devLogin.userK, note: c.devLogin.userKNote },
  { label: 'userl', who: c.devLogin.userL, note: c.devLogin.userLNote },
  { label: 'userm', who: c.devLogin.userM, note: c.devLogin.userMNote },
  { label: 'usern', who: c.devLogin.userN, note: c.devLogin.userNNote },
  { label: 'usero', who: c.devLogin.userO, note: c.devLogin.userONote },
  { label: 'admin', who: c.devLogin.admin, note: c.devLogin.adminNote },
  { label: 'provider', who: c.devLogin.provider, note: c.devLogin.providerNote },
] as const;

type State =
  { kind: 'idle' } | { kind: 'busy'; label: string } | { kind: 'error'; message: string };

export function DevLoginScreen() {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [secret, setSecret] = useState('lomi-local-testing-secret-000000');

  const signIn = async (label: string): Promise<void> => {
    setState({ kind: 'busy', label });
    try {
      /*
       * End whoever is already here first.
       *
       * QA pressed User C while signed in as User A, landed on the home page as
       * though it had worked, and was still User A — with nothing on screen
       * saying so. Whatever left the old cookie in place, signing in on top of
       * a live session is the wrong shape for a door whose entire job is
       * switching between twelve accounts: revoke, then mint.
       *
       * Failure is ignored on purpose. There may be no session to end, and a
       * sign-out that fails must not stop somebody signing in.
       */
      await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'same-origin' }).catch(
        () => undefined,
      );

      const res = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Same origin via the /api rewrite, so the session cookie lands on this
        // origin and the rest of the app is signed in immediately.
        credentials: 'same-origin',
        body: JSON.stringify({ secret, label }),
      });
      if (!res.ok) {
        setState({
          kind: 'error',
          message: res.status === 401 ? c.devLogin.wrongPassword : c.devLogin.failed(res.status),
        });
        return;
      }
      /*
       * `/home`, not `/`.
       *
       * `/` is the marketing page and greets a signed-in student with "Start
       * with your phone number", so a sign-in that had just worked looked like
       * one that had not. QA read that as the button failing and pressed again
       * — which is also why the network log appeared to show only the sign-out:
       * the navigation cut the recording before the dev-login call landed.
       */
      window.location.assign('/home');
    } catch {
      setState({ kind: 'error', message: c.devLogin.noServer });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-title">{c.devLogin.title}</h1>
        <p className="text-body text-ink-2">{c.devLogin.intro}</p>
      </header>

      <Card as="section" className="flex flex-col gap-2">
        <label className="text-caption text-ink-2 uppercase" htmlFor="secret">
          {c.devLogin.password}
        </label>
        <input
          id="secret"
          className="field"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
        />
        <p className="text-caption text-ink-2">{c.devLogin.passwordHint}</p>
      </Card>

      <ul className="flex flex-col gap-2">
        {TESTERS.map((tester) => (
          <li key={tester.label}>
            <button
              type="button"
              className="bg-surface-2 rounded-card flex w-full flex-col gap-0.5 p-4 text-left"
              onClick={() => void signIn(tester.label)}
              disabled={state.kind === 'busy'}
            >
              <span className="text-body">
                {tester.who}
                {state.kind === 'busy' && state.label === tester.label
                  ? ` — ${c.devLogin.signingIn}`
                  : ''}
              </span>
              <span className="text-caption text-ink-2">{tester.note}</span>
            </button>
          </li>
        ))}
      </ul>

      {state.kind === 'error' ? <p className="text-body text-wrong">{state.message}</p> : null}
    </div>
  );
}
