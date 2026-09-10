'use client';

/**
 * The banded leaderboard (T-257, design handoff § 10).
 *
 * Three decisions from the handoff, visible on the screen rather than only in
 * the query behind it.
 *
 * **Two scopes, and the scope is named.** Your own exam — "Accounting", "Grade
 * 12 Natural" — and everyone on the product. Named by the exam rather than
 * labelled "your track", because a student sitting Accounting recognises
 * "Accounting" and has to decode the other. Your own exam is what you land on:
 * it is the board a student actually wants, and the wider one is a tap away.
 *
 * This replaced a junior/senior banded board. The protection that board was
 * built for is unchanged and never lived here — `isListed` on the server hides
 * a junior unless they chose to appear, and the default is not to appear. A
 * child stays off a public list because of that rule, not because of how the
 * board is sliced, which is the more robust place for it.
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
  /*
   * Your own exam first, and deliberately.
   *
   * "Everyone" is the more impressive board and the less useful one: a student
   * wants to know how they stand among the people sitting the paper they are
   * sitting. The wider view is one tap away and says where that sits.
   */
  const [scope, setScope] = useState<'exam' | 'everyone'>('exam');
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (which: 'week' | 'all', where: 'exam' | 'everyone'): Promise<void> => {
    try {
      setBoard(await api.board(which, where));
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
    void load(window_, scope);
  }, [load, window_, scope]);

  if (failed || board === null) return null;

  const SCOPES: ['exam' | 'everyone', string][] = [
    ['exam', c.standing.scopeYourExam],
    ['everyone', c.standing.scopeEveryone],
  ];

  const TABS: [typeof window_, string][] = [
    ['week', c.standing.boardThisWeek],
    ['all', c.standing.boardAllTime],
  ];

  return (
    <section className="flex flex-col gap-3" data-banded-board={board.scope}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-caption text-ink-2 uppercase">{c.standing.board}</h2>
        {/* Which competition this is, in the student's own words for it. */}
        <span className="text-caption text-ink-2">
          {board.scope === 'everyone'
            ? c.standing.scopeEveryoneNote
            : (board.examName ?? c.standing.scopeYourExam)}
        </span>
      </div>

      {/*
        Who you are being ranked against.

        Named by the exam rather than labelled "your track": a student sitting
        Accounting recognises "Accounting" and has to decode "your track". The
        fallback only appears before a programme is chosen, which on this screen
        is nearly never.
      */}
      <nav aria-label={c.standing.scopeLabel} className="flex gap-2">
        {SCOPES.map(([value, fallback]) => {
          const on = scope === value;
          const label = value === 'exam' ? (board.examName ?? fallback) : fallback;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
              onClick={() => setScope(value)}
              className={[
                'text-caption inline-flex min-h-11 items-center rounded-full px-3.5',
                on ? 'bg-brand-soft text-ink font-semibold' : 'bg-surface-2 text-ink-2',
              ].join(' ')}
            >
              {label}
            </button>
          );
        })}
      </nav>

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
        /*
         * Two different empty boards, and they were saying the same thing
         * (T-269).
         *
         * `rows` excludes anybody not listed — an opted-out student, or a
         * junior who has never been asked. So a hidden student who has answered
         * something produces an empty `rows` *and* a `you` holding rank 1, and
         * the screen printed "Nobody has scored yet. Answer a question and you
         * are first." directly above a card reading "You are 1st · 100% · 6 of
         * 6". An audit quoted the pair back as two adjacent sentences that
         * contradict each other, which is exactly what they are.
         *
         * Nobody has scored is only true when nobody has — including you.
         */
        <p className="text-body text-ink-2">
          {board.you ? c.standing.boardNobodyListed : c.standing.boardEmpty}
        </p>
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
        Your own rank, whenever the board is not already showing it.

        This used to render only for a student who had opted out, on the
        reasoning that everybody else could read their rank off the board. That
        holds only for the top few. The board is capped, so a student outside the
        cap was listed, absent from the visible rows, and told nothing — and the
        further down you are the more certain that is, which points the silence
        at exactly the students who most want an answer. QA found three accounts
        in that state and reported "nobody sees their own rank"; they were right,
        and opting out was a red herring.

        So the condition is now about visibility rather than the privacy choice:
        show it unless your row is already on screen. `notListed` still explains
        the absence, but only when absence is what it is.
      */}
      {board.you && !board.rows.some((row) => row.isYou) ? (
        <Card as="section" className="flex flex-col gap-1">
          <p className="text-body num">
            {c.standing.yourRank(board.you.rank)} ·{' '}
            {c.standing.boardCoverageRow(board.you.pct, board.you.beaten, board.you.total)}
          </p>
          <p className="text-caption text-ink-2">
            {board.you.listed ? c.standing.belowTheCut : c.standing.notListed}
          </p>
        </Card>
      ) : null}

      {/* Why 2, 3, 3, 6 is not a counting error. */}
      <p className="text-caption text-ink-2">{c.standing.boardWhyGaps}</p>
    </section>
  );
}
