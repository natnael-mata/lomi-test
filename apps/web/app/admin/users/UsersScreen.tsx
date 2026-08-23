'use client';

/**
 * The two things an operator can do to an account (T-225).
 *
 * `POST /admin/users/:id/reset-devices` and `.../deactivate` have existed since
 * T-164 with no screen behind them, so both support calls this product actually
 * gets — *"I lost my phone"* and *"somebody is using my account"* — needed a
 * developer.
 *
 * **Search first, act second, and never a list of everybody.** A browsable roll
 * of students is a screen where a mis-click closes a stranger's account, and it
 * is also personal data nobody needs to page through. The search is the same one
 * the dashboard uses, so an operator on the phone finds the account the same way
 * in both places.
 *
 * Both actions take a reason, and the copy says the reason is written down with
 * the operator's name. Both are audited on the server (T-167); the field here is
 * what makes the record worth reading six months later.
 */
import { useCallback, useEffect, useState } from 'react';

import { Card } from '../../../components/Card';
import { Chip } from '../../../components/Chip';
import { Input } from '../../../components/Input';
import { api, type UserSearchHit } from '../../../lib/api';
import { copy } from '../../../lib/i18n';

/** Long enough that a search does not fire on every keystroke. */
const SEARCH_DEBOUNCE_MS = 300;

export function UsersScreen() {
  const c = copy();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<UserSearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  /** A search that could not run, kept apart from one that found nobody. */
  const [failed, setFailed] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 3) {
      setHits(null);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          setHits(await api.adminSearchUsers(term));
          setFailed(false);
        } catch {
          /*
           * A failed search is not an empty one.
           *
           * This used to `setHits([])`, so a 403, a dropped connection and a
           * server that was not running all rendered as "Nobody matched that."
           * QA hit it while checking that a student is refused the admin tools
           * and was told, in effect, that the student database was empty —
           * an authorization failure reported as a fact about the data. Anyone
           * reading that message believes the search ran.
           */
          setHits(null);
          setFailed(true);
        } finally {
          setSearching(false);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const act = useCallback(
    async (hit: UserSearchHit, what: 'reset' | 'close'): Promise<void> => {
      if (reason.trim().length === 0) {
        setNotice(c.admin.users.needsReason);
        return;
      }
      setBusy(hit.userId);
      setNotice(null);
      try {
        if (what === 'reset') {
          await api.adminResetDevices(hit.userId, reason.trim());
          setNotice(c.admin.users.devicesReset);
        } else {
          // `false` explicitly: this button closes accounts and never reopens
          // one, so a toggle that flips whatever it finds would reactivate an
          // account the operator believed they were closing.
          await api.adminSetActive(hit.userId, false, reason.trim());
          setNotice(c.admin.users.accountClosed);
        }
        setReason('');
        setHits(await api.adminSearchUsers(query.trim()).catch(() => hits ?? []));
      } catch {
        setNotice(c.admin.users.couldNotDo);
      } finally {
        setBusy(null);
      }
    },
    [c.admin.users, hits, query, reason],
  );

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-title">{c.admin.users.title}</h1>
        <p className="text-body text-ink-2">{c.admin.users.intro}</p>
      </header>

      <Card as="section" className="flex flex-col gap-3">
        <Input
          label={c.dashboard.searchLabel}
          hint={c.dashboard.searchHint}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-2 uppercase">{c.admin.users.reasonLabel}</span>
          <input
            className="field"
            value={reason}
            placeholder={c.admin.users.reasonPlaceholder}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      </Card>

      {notice ? (
        <p className="text-body" aria-live="polite">
          {notice}
        </p>
      ) : null}

      {searching ? <p className="text-body text-ink-2">{c.dashboard.searching}</p> : null}

      {failed && !searching ? (
        <p className="text-body text-wrong">{c.admin.users.searchFailed}</p>
      ) : null}

      {hits !== null && hits.length === 0 && !searching ? (
        <p className="text-body text-ink-2">{c.dashboard.noHits}</p>
      ) : null}

      {(hits ?? []).map((hit) => (
        <Card key={hit.userId} as="section" className="flex flex-wrap items-start gap-4">
          <span className="flex min-w-[240px] flex-1 flex-col gap-1">
            <span className="text-label">{hit.displayName}</span>
            <span className="text-caption text-ink-2 num">{hit.phone ?? '—'}</span>
            <span className="flex flex-wrap gap-2">
              <Chip>{matchedOn(hit)}</Chip>
              {hit.deactivated ? <Chip tone="wrong">{c.admin.users.alreadyClosed}</Chip> : null}
            </span>
          </span>

          <span className="flex w-full flex-col gap-2 sm:w-[280px]">
            <button
              type="button"
              className="btn-ghost"
              disabled={busy === hit.userId}
              onClick={() => void act(hit, 'reset')}
            >
              {busy === hit.userId ? c.admin.users.resetting : c.admin.users.resetDevices}
            </button>
            <p className="text-caption text-ink-2">{c.admin.users.resetDevicesWhy}</p>

            <button
              type="button"
              className="btn-danger"
              disabled={busy === hit.userId || hit.deactivated}
              onClick={() => void act(hit, 'close')}
            >
              {busy === hit.userId ? c.admin.users.deactivating : c.admin.users.deactivate}
            </button>
            <p className="text-caption text-ink-2">{c.admin.users.deactivateWhy}</p>
          </span>
        </Card>
      ))}
    </div>
  );
}

/** Why this account came back, so an operator can tell two Abebes apart. */
function matchedOn(hit: UserSearchHit): string {
  const c = copy();
  if (hit.matchedOn === 'txRef') return c.dashboard.matchedOnTxRef;
  if (hit.matchedOn === 'phone') return c.dashboard.matchedOnPhone;
  return c.dashboard.matchedOnName;
}
