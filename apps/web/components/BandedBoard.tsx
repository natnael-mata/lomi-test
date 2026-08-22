'use client';

/**
 * The banded leaderboard (T-257, design handoff § 10).
 *
 * Three decisions from the handoff, visible on the screen rather than only in
 * the query behind it.
 *
 * **Two bands, and the band is named.** Grade 6 and Grade 8 on one, Grade 12 and
 * the exit exams on the other. An eleven-year-old is never ranked beside a
 * graduating undergraduate, and "why am I not competing with my cousin" is a
 * question a student will ask — the answer, that they are not sitting the same
 * exam, is a good one and belongs on screen.
 *
 * **Ranked by share of your own bank.** A Grade 12 package is roughly three
 * times a Grade 6 one, so a points board ranks the package rather than the
 * student. Each row shows the percentage *and* the count behind it, because a
 * percentage with no denominator is the kind of figure this product does not
 * ship.
 *
 * **Weekly is the default.** An all-time board is decided by January — the top
 * places belong to whoever subscribed first, and nobody joining later can reach
 * them. All-time is here as a second tab, not as the thing you land on.
 */
import { useCallback, useEffect, useState } from 'react';

import { Card } from './Card';
import { Chip } from './Chip';
import { api, signInRequired, type BoardView } from '../lib/api';
import { copy } from '../lib/i18n';

export function BandedBoard() {
  const c = copy();
  const [board, setBoard] = useState<BoardView | null>(null);
  const [window_, setWindow] = useState<'week' | 'all'>('week');
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (which: 'week' | 'all'): Promise<void> => {
    try {
      setBoard(await api.board(which));
      setFailed(false);
    } catch (error) {
      if (signInRequired(error)) {
        window.location.assign('/signin');
        return;
      }
      // The board is not the reason a student opened this screen. A failure
      // hides the panel rather than taking the page down with it.
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load(window_);
  }, [load, window_]);

  if (failed || board === null) return null;

  const TABS: [typeof window_, string][] = [
    ['week', c.standing.boardThisWeek],
    ['all', c.standing.boardAllTime],
  ];

  return (
    <section className="flex flex-col gap-3" data-banded-board={board.band}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-caption text-ink-2 uppercase">{c.standing.board}</h2>
        {/* Which competition this is. */}
        <span className="text-caption text-ink-2">
          {board.band === 'junior' ? c.standing.bandJunior : c.standing.bandSenior}
        </span>
      </div>

      <nav aria-label={c.standing.board} className="flex gap-2">
        {TABS.map(([value, label]) => {
          const on = window_ === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
              onClick={() => setWindow(value)}
              className={[
                'text-caption inline-flex min-h-11 items-center rounded-full px-3.5',
                // Fill and weight, never colour alone — the word is the whole
                // control and the lemon cannot set text.
                on ? 'bg-brand-soft text-ink font-semibold' : 'bg-surface-2 text-ink-2',
              ].join(' ')}
            >
              {label}
            </button>
          );
        })}
      </nav>

      {window_ === 'week' && <p className="text-caption text-ink-2">{c.standing.boardWhyWeekly}</p>}

      {board.rows.length === 0 ? (
        <p className="text-body text-ink-2">{c.standing.boardEmpty}</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {board.rows.map((row) => (
            <li
              key={`${row.rank}-${row.displayName}`}
              data-you={row.isYou}
              className="bg-surface-2 rounded-card flex items-center gap-3 p-3"
            >
              <span className="text-label num w-6 shrink-0">{row.rank}</span>
              {/* Display name only — the response has nowhere to put anything
                  else, which is what makes this safe by construction. */}
              <span className="text-body grow truncate">{row.displayName}</span>
              {row.isYou ? <Chip tone="brand">{c.community.yours}</Chip> : null}
              <span className="text-caption text-ink-2 num shrink-0">
                {c.standing.boardCoverageRow(row.pct, row.beaten, row.total)}
              </span>
            </li>
          ))}
        </ol>
      )}

      {/*
        Opting out hides the row and never the rank. A student who does not want
        to be seen competing still wants to know where they stand, and a product
        that answers "you opted out" when asked "how am I doing" has punished
        somebody for a privacy choice. For a junior this is the ordinary case:
        the default is not to appear.
      */}
      {board.you && !board.you.listed ? (
        <Card as="section" className="flex flex-col gap-1">
          <p className="text-body num">
            {c.standing.yourRank(board.you.rank)} ·{' '}
            {c.standing.boardCoverageRow(board.you.pct, board.you.beaten, board.you.total)}
          </p>
          <p className="text-caption text-ink-2">{c.standing.notListed}</p>
        </Card>
      ) : null}

      {/* Why 2, 3, 3, 6 is not a counting error. */}
      <p className="text-caption text-ink-2">{c.standing.boardWhyGaps}</p>
    </section>
  );
}
