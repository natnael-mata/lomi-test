'use client';

/**
 * The account panel on Access (T-241, T-242).
 *
 * **Two things that existed in the API and nowhere on screen.**
 *
 * `POST /auth/sign-out` and `GET /me/devices` were both built, both tested, and
 * neither had a control anywhere in the product. QA hit it immediately: the test
 * brief says "sign out before switching accounts", and there was nothing to
 * press — they ended up calling the API by hand to get through the pass. The
 * device limit is PRODUCT.md's own rule, and the screen that would let a student
 * act on it did not exist, so "two devices at a time" was a policy nobody could
 * see being applied to them.
 *
 * It lives on Access rather than in a settings page of its own because Access is
 * already the screen about *this account* — what it can reach and what has been
 * paid for. Where you are signed in belongs with that, and a twelfth route for
 * two controls is a worse answer than putting them where somebody is already
 * looking.
 *
 * **The panel's own Sign out has since been removed** (T-269) — see the note at
 * the foot of this file. The device list stays; it is the half of this that
 * exists nowhere else.
 */
import { useCallback, useEffect, useState } from 'react';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { api, refusalMessage, signInRequired, type DeviceEntry } from '../../lib/api';
import { copy } from '../../lib/i18n';
import { dayAndTime } from '../../lib/dates';

type Phase =
  | { kind: 'loading' }
  // The cap rides along with the list: it differs by track, so the sentence
  // above the rows cannot be a constant.
  | { kind: 'ready'; devices: DeviceEntry[]; maxDevices: number }
  | { kind: 'error'; message: string };

export function AccountPanel() {
  const c = copy();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const list = await api.devices();
      setPhase({ kind: 'ready', devices: list.devices, maxDevices: list.maxDevices });
    } catch (error) {
      if (signInRequired(error)) {
        window.location.assign('/signin');
        return;
      }
      setPhase({ kind: 'error', message: refusalMessage(error) ?? c.account.devicesFailed });
    }
  }, [c.account.devicesFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = async (id: string): Promise<void> => {
    setBusy(id);
    setProblem(null);
    try {
      await api.revokeDevice(id);
      // Re-read rather than splicing the row out: revoking the session you are
      // using is allowed, and the server is the one that knows what that left.
      await load();
    } catch (error) {
      setProblem(refusalMessage(error) ?? c.account.devicesFailed);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card as="section" data-account-panel="" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-label">{c.account.devicesTitle}</h2>
        {/* The rule, stated where it applies. A limit a student only meets by
            being evicted is a limit they experience as a fault.

            Held back until the list has loaded, because the number is not the
            same for everybody — school tracks get four — and a placeholder that
            said "two" while waiting would be wrong for exactly the accounts
            that have more. */}
        {phase.kind === 'ready' ? (
          <p className="text-caption text-ink-2">{c.account.devicesIntro(phase.maxDevices)}</p>
        ) : null}
      </div>

      {phase.kind === 'loading' && (
        <p className="text-body text-ink-2">{c.account.devicesLoading}</p>
      )}

      {phase.kind === 'error' && <p className="text-caption text-wrong">{phase.message}</p>}

      {phase.kind === 'ready' &&
        (phase.devices.length === 0 ? (
          <p className="text-body text-ink-2">{c.account.noDevices}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {phase.devices.map((device) => (
              <li
                key={device.id}
                data-device=""
                data-current={device.isCurrent}
                className="bg-surface-2 rounded-card flex flex-wrap items-center gap-3 p-3"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-label">
                      {device.deviceLabel ?? c.account.unknownDevice}
                    </span>
                    {device.isCurrent && <Chip tone="brand">{c.account.thisDevice}</Chip>}
                  </span>
                  <span className="text-caption text-ink-2 num">
                    {c.account.lastSeen(dayAndTime(device.lastSeenAt))}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  disabled={busy === device.id}
                  onClick={() => void revoke(device.id)}
                >
                  {busy === device.id ? c.account.revoking : c.account.revoke}
                </Button>
              </li>
            ))}
          </ul>
        ))}

      {problem && <p className="text-caption text-wrong">{problem}</p>}
    </Card>
  );
}

/*
 * The third Sign out is gone (T-269).
 *
 * This card ended with a full-width bordered "Sign out" — directly beneath a
 * list of devices whose every row carries a visually identical "Sign this one
 * out". Three ways to end a session in one card, two of them looking the same
 * and meaning different things: one ends this session, the others end a session
 * somewhere else. An operator or a student in a hurry cannot tell those apart
 * by shape, and the consequence of confusing them is being logged out of the
 * phone in your hand.
 *
 * The nav carries Sign out at every width now (and `/home` does below `lg`), so
 * this one was the duplicate rather than the only way out — which is what it
 * had been when it was written.
 */
