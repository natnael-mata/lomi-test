'use client';

/**
 * Pick-a-tester sign-in, for local testing only (T-206a).
 *
 * **There is no longer an authentication bypass behind this screen.** It used to
 * post to `POST /auth/dev-login`, an endpoint that minted a session on
 * presentation of a shared secret — a genuine bypass, listed as a launch
 * blocker, and the kind of thing that ships to production once in a career and
 * is remembered forever. That endpoint is gone, along with `DEV_LOGIN_SECRET`
 * and the service method behind it.
 *
 * What is left is a convenience, not a door: the buttons fill in a seeded
 * persona's real phone number and password and post them to `POST /auth/sign-in`
 * — the same endpoint, the same guard, the same rate limit a student meets. It
 * became possible to delete the bypass only once phone-and-password sign-in
 * existed, because until then there was no other way in at all.
 *
 * **In production every button here fails**, which is the correct behaviour
 * rather than a bug: the accounts are seeded by `dev:testers` against a local
 * database and do not exist anywhere else. Nothing needs to be configured to
 * make that true, and no environment variable can make it untrue.
 *
 * Still worth deleting with the rest of the smoke-test scaffolding before
 * launch — but it is now a page that lists fake phone numbers, not a way past
 * the lock.
 */
import { useState } from 'react';

import { Card } from '../../components/Card';
import { copy } from '../../lib/i18n';

/** The testers. Same label every time, so each keeps its own history. */
const c = copy();

/**
 * The password `dev:testers` sets on every seeded account.
 *
 * One password for all of them because they are smoke-test accounts on a local
 * database that ships its own seed script — the value of a secret one is nil,
 * and the value of a distinct one per persona is a tester keeping a list.
 * Editable above, for an account whose password has been changed by hand.
 */
const TEST_PASSWORD = 'lomi-test-2026';

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
 *
 * **The numbers are literals, and the guard checks them too.** They are derived
 * from a SHA-256 of the label in `dev-testers.ts`; recomputing that here would
 * mean the browser doing async crypto to render a static list, and mirroring the
 * algorithm would mean two implementations that can disagree. So they are data,
 * and the contract test asserts every one against the seed's own function — the
 * drift is caught at build time rather than by a button that signs in as nobody.
 */
export const TESTERS = [
  { label: 'usera', who: c.devLogin.userA, note: c.devLogin.userANote , phone: '0970070893' },
  { label: 'userb', who: c.devLogin.userB, note: c.devLogin.userBNote , phone: '0975000507' },
  { label: 'userc', who: c.devLogin.userC, note: c.devLogin.userCNote , phone: '0963424628' },
  { label: 'userd', who: c.devLogin.userD, note: c.devLogin.userDNote , phone: '0962270824' },
  { label: 'usere', who: c.devLogin.userE, note: c.devLogin.userENote , phone: '0996351144' },
  { label: 'userf', who: c.devLogin.userF, note: c.devLogin.userFNote , phone: '0998430059' },
  { label: 'userg', who: c.devLogin.userG, note: c.devLogin.userGNote , phone: '0957167915' },
  { label: 'userh', who: c.devLogin.userH, note: c.devLogin.userHNote , phone: '0901715831' },
  { label: 'useri', who: c.devLogin.userI, note: c.devLogin.userINote , phone: '0908705520' },
  { label: 'userj', who: c.devLogin.userJ, note: c.devLogin.userJNote , phone: '0905002772' },
  { label: 'userk', who: c.devLogin.userK, note: c.devLogin.userKNote , phone: '0929384949' },
  { label: 'userl', who: c.devLogin.userL, note: c.devLogin.userLNote , phone: '0902187829' },
  { label: 'userm', who: c.devLogin.userM, note: c.devLogin.userMNote , phone: '0913519862' },
  { label: 'usern', who: c.devLogin.userN, note: c.devLogin.userNNote , phone: '0993282964' },
  { label: 'usero', who: c.devLogin.userO, note: c.devLogin.userONote , phone: '0934924930' },
  { label: 'admin', who: c.devLogin.admin, note: c.devLogin.adminNote , phone: '0944278043' },
  { label: 'provider', who: c.devLogin.provider, note: c.devLogin.providerNote , phone: '0951508892' },
] as const;

type State =
  { kind: 'idle' } | { kind: 'busy'; label: string } | { kind: 'error'; message: string };

export function DevLoginScreen() {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [password, setPassword] = useState(TEST_PASSWORD);

  const signIn = async (label: string, phone: string): Promise<void> => {
    setState({ kind: 'busy', label });
    try {
      /*
       * End whoever is already here first.
       *
       * QA pressed User C while signed in as User A, landed on the home page as
       * though it had worked, and was still User A — with nothing on screen
       * saying so. Whatever left the old cookie in place, signing in on top of
       * a live session is the wrong shape for a door whose entire job is
       * switching between accounts: revoke, then mint.
       *
       * Failure is ignored on purpose. There may be no session to end, and a
       * sign-out that fails must not stop somebody signing in.
       */
      await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'same-origin' }).catch(
        () => undefined,
      );

      /*
       * The real sign-in endpoint, with the persona's real credentials.
       *
       * Not a bypass: the same route, guard and rate limit a student meets,
       * which also makes this screen a continuous test of the door everybody
       * else uses. If sign-in breaks, these buttons break with it — and that is
       * a feature.
       */
      const res = await fetch('/api/auth/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ phone, password, deviceLabel: 'Dev sign-in' }),
      });
      if (!res.ok) {
        setState({
          kind: 'error',
          message: res.status === 401 ? c.devLogin.notSeeded : c.devLogin.failed(res.status),
        });
        return;
      }
      /*
       * `/home`, not `/`.
       *
       * `/` is the marketing page and greets a signed-in student with "Start
       * with your phone number", so a sign-in that had just worked looked like
       * one that had not.
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
        <label className="text-caption text-ink-2 uppercase" htmlFor="tester-password">
          {c.devLogin.password}
        </label>
        <input
          id="tester-password"
          className="field"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-caption text-ink-2">{c.devLogin.passwordHint}</p>
      </Card>

      <ul className="flex flex-col gap-2">
        {TESTERS.map((tester) => (
          <li key={tester.label}>
            <button
              type="button"
              className="bg-surface-2 rounded-card flex w-full flex-col gap-0.5 p-4 text-left"
              onClick={() => void signIn(tester.label, tester.phone)}
              disabled={state.kind === 'busy'}
            >
              <span className="text-body">
                {tester.who}
                {state.kind === 'busy' && state.label === tester.label
                  ? ` — ${c.devLogin.signingIn}`
                  : ''}
              </span>
              <span className="text-caption text-ink-2">{tester.note}</span>
              {/* The number itself, because signing in by hand on `/signin` is
                  now the same act — this screen just saves the typing. */}
              <span className="text-caption text-ink-2 num">{tester.phone}</span>
            </button>
          </li>
        ))}
      </ul>

      {state.kind === 'error' ? <p className="text-body text-wrong">{state.message}</p> : null}
    </div>
  );
}
