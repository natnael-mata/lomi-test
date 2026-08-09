'use client';

/**
 * The admin overview (T-160, T-161, T-163).
 *
 * Three things an operator opens the morning on: where the signups stand, what
 * came in, and a box to find the person who is on the phone.
 *
 * **Both figure blocks are `<TotalBar>`, and that is a constraint the API had to
 * meet rather than a styling choice.** DESIGN.md: a row of figures that
 * genuinely sums ends in a dark total bar, and the component throws in
 * development if the rows do not add up. So the four signup segments partition
 * the total exactly, and the revenue rows are summed rather than queried
 * separately. Numbers somebody can check.
 *
 * The waiting-to-settle count is deliberately **outside** both bars. It counts
 * payments where everything above counts students, and putting it in a total
 * that does not include it is how a dashboard starts lying.
 */
import { useCallback, useEffect, useState } from 'react';

import { Card } from '../../../components/Card';
import { Input } from '../../../components/Input';
import { TotalBar } from '../../../components/TotalBar';
import {
  api,
  type DashboardOverview,
  type RevenueSplit,
  type UserSearchHit,
} from '../../../lib/api';
import { copy } from '../../../lib/i18n';

type Phase =
  | { kind: 'loading' }
  | { kind: 'ready'; overview: DashboardOverview; revenue: RevenueSplit }
  | { kind: 'error' };

/** Long enough that a search does not fire on every keystroke. */
const SEARCH_DEBOUNCE_MS = 300;

export function Dashboard() {
  const c = copy();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<UserSearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const [overview, revenue] = await Promise.all([api.adminOverview(), api.adminRevenue()]);
        if (live) setPhase({ kind: 'ready', overview, revenue });
      } catch {
        if (live) setPhase({ kind: 'error' });
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  /**
   * Debounced, and short queries never leave the browser.
   *
   * The server refuses under three characters anyway; not sending them keeps a
   * partial phone number out of the access log on the way to being refused.
   */
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
        } catch {
          setHits([]);
        } finally {
          setSearching(false);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const methodLabel = useCallback(
    (method: string): string =>
      ({
        TELEBIRR: c.dashboard.methodTelebirr,
        CBEBIRR: c.dashboard.methodCbebirr,
        CHAPA: c.dashboard.methodChapa,
        BANK: c.dashboard.methodBank,
      })[method] ?? method,
    [c.dashboard],
  );

  const matchLabel = (hit: UserSearchHit): string =>
    hit.matchedOn === 'txRef'
      ? c.dashboard.matchedOnTxRef
      : hit.matchedOn === 'phone'
        ? c.dashboard.matchedOnPhone
        : c.dashboard.matchedOnName;

  if (phase.kind === 'loading') {
    return <p className="text-body text-ink-2">{c.dashboard.working}</p>;
  }
  if (phase.kind === 'error') {
    return <p className="text-body">{c.dashboard.couldNotLoad}</p>;
  }

  const { overview, revenue } = phase;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title">{c.dashboard.title}</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-caption text-ink-2 uppercase">{c.dashboard.signups}</h2>
        {/* The four segments sum to the signups by construction on the server —
            this bar is where that would be caught if they ever stopped. */}
        <TotalBar
          rows={[
            { label: c.dashboard.paying, value: overview.paying },
            { label: c.dashboard.lapsed, value: overview.lapsed },
            { label: c.dashboard.trialling, value: overview.trialling },
            { label: c.dashboard.dormant, value: overview.dormant },
          ]}
          total={overview.signups}
          totalLabel={c.dashboard.signups}
        />
      </section>

      <Card as="section" className="flex flex-col gap-1">
        <h2 className="text-caption text-ink-2 uppercase">{c.dashboard.awaitingSettlement}</h2>
        {/* A queue length, not a segment — which is why it is not in either bar. */}
        <p className="text-body">
          {overview.awaitingSettlement === 0
            ? c.dashboard.nothingWaiting
            : c.dashboard.awaitingHow(overview.awaitingSettlement)}
        </p>
      </Card>

      <section className="flex flex-col gap-2">
        <h2 className="text-caption text-ink-2 uppercase">{c.dashboard.revenue}</h2>
        <TotalBar
          rows={revenue.rows.map((row) => ({ label: methodLabel(row.method), value: row.etb }))}
          total={revenue.totalEtb}
          totalLabel={c.dashboard.revenueTotal}
          unit=" Br"
        />
        <p className="text-caption text-ink-2">{c.dashboard.paymentsCounted(revenue.totalCount)}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-caption text-ink-2 uppercase">{c.dashboard.findStudent}</h2>
        <Input
          label={c.dashboard.searchLabel}
          hint={c.dashboard.searchHint}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {searching ? <p className="text-caption text-ink-2">{c.dashboard.searching}</p> : null}
        {hits !== null && !searching ? (
          hits.length === 0 ? (
            <p className="text-body text-ink-2">{c.dashboard.noHits}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {hits.map((hit) => (
                <li
                  key={hit.userId}
                  className="bg-surface-2 rounded-card flex flex-col gap-0.5 p-3"
                >
                  {/* The display name, never a legal one — an admin screen is
                      read by people with no business seeing one (T-086). */}
                  <span className="text-body">{hit.displayName}</span>
                  <span className="text-caption text-ink-2">
                    {matchLabel(hit)}
                    {hit.deactivated ? ` · ${c.dashboard.deactivated}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>
    </div>
  );
}
