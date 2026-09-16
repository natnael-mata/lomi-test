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

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { TierBadge } from '../../components/TierBadge';
import { StatedFigure } from '../../components/StatedFigure';
import {
  api,
  signInRequired,
  type LeaderboardView,
  type LedgerRow,
  type StandingView,
} from '../../lib/api';
import { PracticeCta } from '../../components/PracticeCta';
import { BandedBoard } from '../../components/BandedBoard';
import { copy } from '../../lib/i18n';
// Aliased: `day` is what the ledger row's field is called too.
import { day as dayLabel } from '../../lib/dates';

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
      /*
       * The programme first, because without one this screen is misleading
       * rather than empty (T-268).
       *
       * A student who had chosen nothing was shown a populated board headed
       * "Your exam" — four other students ranked under a scope they do not
       * have. Practise, Mock and Ask all send them to `/choose`; this one
       * invented an answer. An empty screen would have been merely useless.
       */
      const fields = await api.myFields().catch(() => []);
      if (fields.length > 0 && !fields.some((field) => field.chosen)) {
        window.location.assign('/choose');
        return;
      }
      const [standing, ledger, board] = await Promise.all([
        api.standing(),
        api.pointsLedger(),
        api.leaderboard(),
      ]);
      setPhase({ kind: 'ready', standing, ledger, board });
    } catch (e) {
      if (signInRequired(e)) {
        window.location.assign('/signin');
        return;
      }
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
      // The choice, from the same field the label reads. Deriving it from
      // `you` meant a student with no points always sent `optOut: true`,
      // whichever state they were actually in.
      await api.setLeaderboardOptOut(phase.board.youListed);
      await load();
    } finally {
      setBusy(false);
    }
  }, [load, phase]);

  if (phase.kind === 'loading') {
    return <p className="text-body text-ink-2">{c.standing.working}</p>;
  }
  if (phase.kind === 'error') {
    /*
     * A message and a way out of it (T-269).
     *
     * This was the sentence alone. `/practice` offers a Try again button in the
     * same situation and `/progress` did not either, so the product answered
     * one failure three different ways — and on two of the three the only
     * remedy was for the student to work out that reloading might help. The
     * copy already says "nothing is lost"; the button is what makes that
     * actionable rather than reassuring.
     */
    return (
      <div className="flex flex-col gap-3">
        <p className="text-body">{c.standing.couldNotLoad}</p>
        <Button variant="ghost" className="self-start" onClick={() => void load()}>
          {c.common.tryAgain}
        </Button>
      </div>
    );
  }

  const { standing, ledger, board } = phase;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title">{c.standing.title}</h1>

      {/*
       * Two columns from `lg`, one below it (DESIGN.md § Layout, the data measure).
       *
       * Split by whose figures they are: the left is yours — the points, the
       * tier, the streak, and the ledger those points came from. The right is
       * everyone else. Reading your own total and then scanning the board are
       * two different acts, and stacking them made the second one a scroll.
       */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-6">
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

            {/*
              Which of the two figures on this screen the board actually uses.

              Points are the largest number here and the board beside them ranks
              by questions beaten, so the biggest figure is not the one anybody
              is ranked on — and nothing said so. The pair reads worst on an
              account like User M's: POINTS 0, beside "You are 1st · 100% ·
              6 of 6". Both are true and they measure different things.
            */}
            <p className="text-caption text-ink-2">{c.standing.pointsNotRanked}</p>

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
                    a student cannot check and cannot argue with (T-190).

                    And the day beside it. Two "You came back." rows with nothing
                    to tell them apart read as the same award counted twice —
                    which is exactly what QA reported. The row has carried its
                    day all along; it was simply never shown. */}
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-body">{row.reason}</span>
                      <span className="text-caption text-ink-2 num">{dayLabel(row.day)}</span>
                    </span>
                    <span className="text-label num shrink-0">
                      {row.points > 0 ? `+${row.points}` : row.points}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/*
          The board is the banded one, and the only one (T-257).

          The points board that used to sit here is gone, not moved. It ranked by
          points and was never banded, so a Grade 6 student saw Grade 12 and
          exit-exam students listed directly beneath the board that had just
          carefully separated them — which undoes the separation and is worse
          than never having made it. A points board also ranks the *package*: a
          Grade 12 bank is roughly three times a Grade 6 one, so the bigger
          purchase wins.

          Points themselves are untouched, above: they measure showing up, which
          is what the streak and the ledger are for. They are simply not a
          competition.
        */}
        <BandedBoard />

        {/* Opting out hides the row, never the rank (T-194), and the control
            stays here because it is a setting on the account rather than part of
            any one board. */}
        <section className="flex flex-col gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => void toggleListed()}
            disabled={busy}
          >
            {/* `youListed`, not `board.you?.listed`. The latter is null for
                anybody with no points — which is every junior who has not
                started — so the button offered "Hide me" to students who were
                hidden by default and had never been asked. */}
            {board.youListed ? c.standing.hideMe : c.standing.showMe}
          </button>
        </section>

        {/*
          The way to move, which this screen did not offer (T-269).

          DESIGN.md: "every statement ends in a practice action" — and every
          analytics view honoured it except this one. `/standing` ended on a
          privacy toggle, so the only thing a student could *do* here was hide
          themselves. On a fresh account that was starker still: the single
          control on the whole screen was "Hide me from the board", which is the
          least useful thing available and was also the loudest.

          No topic to name — this screen measures across the whole track rather
          than per topic, and `PracticeCta` handles a null by offering plain
          practice rather than inventing a recommendation.
        */}
        <PracticeCta topicId={null} topicName={null} />
      </div>
    </div>
  );
}
