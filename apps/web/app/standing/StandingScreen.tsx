'use client';

/**
 * Where a student stands (T-190, T-191, T-192, T-193, T-194).
 *
 * Points, the streak, the tier and the board on one screen, because they are one
 * question — *how am I doing?* — and splitting them across four routes on a
 * low-end phone is four loads to answer it.
 *
 * **Two things this screen must never do**, both from PRODUCT.md:
 *
 * - It never shames a missed day. The streak counts days practised and nothing
 *   subtracts from it, so there is no "you lost your streak" state to render —
 *   and the ledger's own `plan adjusted` line says so in the student's words.
 * - The board carries display names only. That is guaranteed by the shape of the
 *   API response, which has nowhere to put a legal name, so this screen cannot
 *   leak one even by accident.
 */
import { useCallback, useEffect, useState } from 'react';

import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { TierBadge } from '../../components/TierBadge';
import { StatedFigure } from '../../components/StatedFigure';
import { api, type LeaderboardView, type LedgerRow, type StandingView } from '../../lib/api';
import { copy } from '../../lib/i18n';

type Phase =
  | { kind: 'loading' }
  | { kind: 'ready'; standing: StandingView; ledger: LedgerRow[]; board: LeaderboardView }
  | { kind: 'error' };

const TIER_NAMES: Record<StandingView['tier'], string> = {
  NONE: 'Bronze',
  BRONZE: 'Silver',
  SILVER: 'Gold',
  GOLD: 'Platinum',
  PLATINUM: 'Platinum',
};

export function StandingScreen() {
  const c = copy();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    try {
      const [standing, ledger, board] = await Promise.all([
        api.standing(),
        api.pointsLedger(),
        api.leaderboard(),
      ]);
      setPhase({ kind: 'ready', standing, ledger, board });
    } catch {
      setPhase({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleListed = useCallback(async (): Promise<void> => {
    if (phase.kind !== 'ready') return;
    setBusy(true);
    try {
      await api.setLeaderboardOptOut(phase.board.you?.listed !== false);
      await load();
    } finally {
      setBusy(false);
    }
  }, [load, phase]);

  if (phase.kind === 'loading') {
    return <p className="text-body text-ink-2">{c.standing.working}</p>;
  }
  if (phase.kind === 'error') {
    return <p className="text-body">{c.standing.couldNotLoad}</p>;
  }

  const { standing, ledger, board } = phase;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title">{c.standing.title}</h1>

      <Card as="section" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          {/*
            A STATED figure, not a total bar, and the distinction is not
            cosmetic. DESIGN.md: a row of figures that genuinely sums ends in a
            dark total bar. The ledger below is capped at the most recent
            awards, so those rows do NOT add up to this number — putting them in
            a total bar would be a claim a student could check and find false.
          */}
          <StatedFigure
            label={c.standing.points}
            value={String(standing.totalPoints)}
            derivation={c.standing.pointsFrom}
          />
          <TierBadge tier={standing.tier} />
        </div>

        <p className="text-caption text-ink-2">
          {standing.pointsToNextTier === null
            ? c.standing.topTier
            : c.standing.toNextTier(standing.pointsToNextTier, TIER_NAMES[standing.tier])}
        </p>

        <div className="bg-surface-2 rounded-card p-3">
          <span className="text-caption text-ink-2 uppercase">{c.standing.streak}</span>
          {/* No "you lost your streak" branch exists, because the streak has no
              way down. A student who was away sees the count they earned. */}
          <p className="text-body">
            {standing.streakDays === 0
              ? c.standing.streakNever
              : c.standing.streakDays(standing.streakDays)}
          </p>
        </div>
      </Card>

      <section className="flex flex-col gap-2">
        <h2 className="text-caption text-ink-2 uppercase">{c.standing.howEarned}</h2>
        {/* Said out loud, because a student who tries to add these up and lands
            short should not conclude the total is wrong. */}
        {ledger.length > 0 ? (
          <p className="text-caption text-ink-2">{c.standing.recentOnly}</p>
        ) : null}
        {ledger.length === 0 ? (
          <p className="text-body text-ink-2">{c.standing.ledgerEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {ledger.map((row) => (
              <li
                key={`${row.at}-${row.ruleId}`}
                className="bg-surface-2 rounded-card flex items-center justify-between gap-3 p-3"
              >
                {/* The reason, always. A number with no sentence beside it is one
                    a student cannot check and cannot argue with (T-190). */}
                <span className="text-body">{row.reason}</span>
                <span className="text-label num shrink-0">
                  {row.points > 0 ? `+${row.points}` : row.points}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-caption text-ink-2 uppercase">{c.standing.board}</h2>

        {board.rows.length === 0 ? (
          <p className="text-body text-ink-2">{c.standing.boardEmpty}</p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {board.rows.map((row) => (
              <li
                key={`${row.rank}-${row.displayName}`}
                className="bg-surface-2 rounded-card flex items-center gap-3 p-3"
                data-you={row.isYou}
              >
                <span className="text-label num w-6 shrink-0">{row.rank}</span>
                {/* Display name only — the response has nowhere to put anything
                    else, which is what makes this safe by construction. */}
                <span className="text-body grow">{row.displayName}</span>
                {row.isYou ? <Chip tone="brand">{c.community.yours}</Chip> : null}
                <TierBadge tier={row.tier} showLabel={false} />
                <span className="text-label num shrink-0">{row.points}</span>
              </li>
            ))}
          </ol>
        )}

        {/* Opting out hides the row, never the rank (T-194). A student who does
            not want to be seen competing still wants to know where they stand. */}
        {board.you && !board.you.listed ? (
          <p className="text-body text-ink-2">
            {c.standing.notListed} {c.standing.yourRank(board.you.rank)}.
          </p>
        ) : null}

        <button
          type="button"
          className="btn-ghost"
          onClick={() => void toggleListed()}
          disabled={busy}
        >
          {board.you?.listed === false ? c.standing.showMe : c.standing.hideMe}
        </button>
      </section>
    </div>
  );
}
