/**
 * The banded leaderboard (T-257).
 *
 * Three decisions, each reversing something that looked fine until the product
 * grew a second kind of student.
 *
 * **Ranked by coverage percentage, never by points.** A Grade 12 package holds
 * around 3,900 questions and a Grade 6 package around 1,310, so a points board
 * ranks the package rather than the student — the Grade 12 candidate wins by
 * having bought a bigger bank. A percentage is the same measure whatever the
 * denominator.
 *
 * **Weekly is the default and all-time is the secondary view.** An all-time
 * board is decided by January: the top places belong to whoever subscribed
 * first, and nobody joining later can reach them. It stops motivating exactly
 * the people who most need motivating, which is the students who started late.
 *
 * **Two scopes: your own exam, and everyone.** Accounting against Accounting is
 * the board a student recognises; everyone is the one that shows where that
 * sits. Both work only because the measure is a share of your own bank — a
 * points board across tracks would rank the package, not the student.
 *
 * This replaced a junior/senior *banded* board. The protection that board
 * existed for did not go with it: `isListed` still hides a junior unless they
 * chose to appear, and the default is not to appear. An eleven-year-old is kept
 * off a public list by that rule, not by the shape of the query — which is the
 * more robust place for it, since it holds on every scope that could be added
 * later.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { coveragePct } from '../progress/coverage';
import { bandFor, isListed, type Band } from './bands';

/** Which board: the last seven days, or everything. */
export type BoardWindow = 'week' | 'all';

/**
 * Who is being ranked against whom.
 *
 * `exam` is the viewer's own track — Accounting against Accounting. `everyone`
 * is every student on the product, whatever they are sitting, which works only
 * because the measure is a share of your own bank rather than a raw count.
 */
export type BoardScope = 'exam' | 'everyone';

export interface BoardRow {
  rank: number;
  displayName: string;
  /** Whole percent of their own track. Comparable across package sizes. */
  pct: number;
  beaten: number;
  total: number;
  isYou: boolean;
}

export interface BoardView {
  scope: BoardScope;
  /** The viewer's own track, so the toggle can name it. Null with none chosen. */
  examName: string | null;
  /** Kept for the junior/senior listing rule, which is unchanged. */
  band: Band;
  window: BoardWindow;
  rows: BoardRow[];
  /**
   * The asker's own standing, whether or not they are listed.
   *
   * Opting out hides the row and never the rank — somebody who does not want to
   * be seen competing still wants to know where they stand.
   */
  you: { rank: number; pct: number; beaten: number; total: number; listed: boolean } | null;
  /** Why the visible numbers can skip. See `StandingScreen`'s note. */
  rankedOverEveryone: true;
}

/** Seven days, in milliseconds. The weekly board's whole definition. */
const WEEK_MS = 7 * 86_400_000;

@Injectable()
export class BoardService {
  constructor(private readonly prisma: PrismaService) {}

  async board(
    viewerId: string,
    window: BoardWindow = 'week',
    scope: BoardScope = 'exam',
    now: Date = new Date(),
    limit = 20,
  ): Promise<BoardView> {
    const viewer = await this.prisma.user.findUnique({
      where: { id: viewerId },
      // `leaderboardOptOut` so a viewer who has beaten nothing can still be told
      // where they stand, and whether they are shown. See `mine` below.
      select: { fieldId: true, leaderboardOptOut: true },
    });

    /*
     * Every published question per field, counted once.
     *
     * The denominator is the student's own track, so two people on different
     * tracks are each measured against their own bank — which is the entire
     * reason this is a percentage.
     */
    // `User` declares `fieldId` without a relation — a deliberate schema choice
    // documented on `StaffMember` — so the span is looked up rather than joined.
    const fields = await this.prisma.field.findMany({
      select: { id: true, name: true, maxGrade: true },
    });
    const gradeByField = new Map(fields.map((f) => [f.id, f.maxGrade]));
    const band = bandFor(viewer?.fieldId ? (gradeByField.get(viewer.fieldId) ?? null) : null);

    /*
     * Who is being ranked against whom.
     *
     * `exam` is the viewer's own track — Accounting against Accounting, Grade 12
     * Natural against Grade 12 Natural. `everyone` is every student on the
     * product, whatever they are sitting.
     *
     * **`everyone` is fair here only because the measure is a percentage.** The
     * original objection to a cross-track board was that a Grade 12 bank holds
     * around 3,900 questions and a Grade 6 bank around 1,310, so ranking by
     * points ranks the *package* — the Grade 12 candidate wins by having bought
     * a bigger one. Share of your own bank has no such problem: 60% of Grade 6
     * and 60% of Accounting are the same claim about the student.
     *
     * **The child protection is unchanged and does not live here.** It is
     * `isListed`, below: a junior appears only if they chose to, and the default
     * is not to appear. That is what keeps an eleven-year-old off a public list
     * beside graduating undergraduates — not the shape of the query.
     */
    const inScope = new Set(
      scope === 'exam' && viewer?.fieldId
        ? [viewer.fieldId]
        : fields.map((f) => f.id),
    );

    const totals = await this.prisma.question.groupBy({
      by: ['fieldId'],
      where: { status: 'PUBLISHED', fieldId: { in: [...inScope] } },
      _count: { _all: true },
    });
    const totalByField = new Map(totals.map((t) => [t.fieldId, t._count._all]));

    /*
     * Beaten, within the window.
     *
     * `createdAt` on the attempt is when the question was beaten, because the
     * attempt that carries `reasonCorrect` is the one that beat it — a question
     * beaten in March does not re-enter this week's board.
     */
    const since = window === 'week' ? new Date(now.getTime() - WEEK_MS) : undefined;
    const beatenRows = await this.prisma.attempt.findMany({
      where: {
        isCorrect: true,
        reasonCorrect: true,
        fieldId: { in: [...inScope] },
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      select: { userId: true, fieldId: true, questionId: true },
      distinct: ['userId', 'questionId'],
    });

    const beatenByUser = new Map<string, { fieldId: string; count: number }>();
    for (const row of beatenRows) {
      const held = beatenByUser.get(row.userId) ?? { fieldId: row.fieldId, count: 0 };
      held.count++;
      beatenByUser.set(row.userId, held);
    }

    /*
     * The rows are the students who have beaten something in this window.
     *
     * Deliberately not everybody in the band. On the weekly board that would
     * list every dormant student at 0% — present as though they had turned up,
     * which is the opposite of what a weekly board is for. Being *listed* is
     * about having done something; knowing *where you stand* is not, and the
     * two are separated below rather than here.
     */
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...beatenByUser.keys()] } },
      select: {
        id: true,
        displayName: true,
        leaderboardOptOut: true,
        deactivatedAt: true,
        fieldId: true,
      },
    });

    const scored = users
      .filter((u) => u.deactivatedAt === null && u.fieldId !== null)
      .map((u) => {
        const held = beatenByUser.get(u.id)!;
        const total = totalByField.get(u.fieldId!) ?? 0;
        return {
          id: u.id,
          displayName: u.displayName,
          beaten: held.count,
          total,
          pct: coveragePct(total, held.count),
          // Banded by the student's OWN track, not the viewer's: a junior whose
          // rows somehow reached a senior query must still not be published.
          listed: isListed(bandFor(gradeByField.get(u.fieldId!) ?? null), u.leaderboardOptOut),
        };
      })
      // A student in a track with no published questions has no percentage to
      // rank — absent, not zero.
      .filter((s) => s.total > 0)
      .sort((a, b) => b.pct - a.pct || b.beaten - a.beaten);

    /*
     * Ranked over everybody, then filtered.
     *
     * Hiding one student must not promote the next, or the board reports a
     * different competition to each viewer. Ties share a rank.
     */
    let rank = 0;
    let previous: number | null = null;
    const ranked = scored.map((s, index) => {
      if (previous === null || s.pct !== previous) rank = index + 1;
      previous = s.pct;
      return { ...s, rank };
    });

    /*
     * Where the viewer stands, even on nothing beaten.
     *
     * `ranked` holds only students with at least one question beaten, so this
     * used to be null for everybody else and the screen had no answer to "where
     * am I?" — QA read three accounts in that state and reported that nobody
     * sees their own rank. They were right, and the students it silences are
     * the ones just starting and the ones struggling: precisely where being
     * erased is worse than being told a low number.
     *
     * So a viewer who is not in `ranked` is placed after everyone who is. That
     * claim is exactly true — every student on this board has beaten more than
     * they have — and it is honest about the tie: everyone else on nothing
     * shares the same place. The rows are untouched, so no other student's view
     * of the board changes.
     */
    const ranked_ = ranked.find((r) => r.id === viewerId) ?? null;
    const viewerTotal = viewer?.fieldId ? (totalByField.get(viewer.fieldId) ?? 0) : 0;
    const mine =
      ranked_ ??
      // Only where there is a bank to be measured against. With no published
      // questions there is no percentage to report, and "rank last of nobody"
      // is worse than saying nothing.
      (viewerTotal > 0
        ? {
            rank: ranked.length + 1,
            pct: 0,
            beaten: 0,
            total: viewerTotal,
            listed: isListed(band, viewer?.leaderboardOptOut ?? null),
          }
        : null);

    return {
      scope,
      examName: viewer?.fieldId
        ? (fields.find((f) => f.id === viewer.fieldId)?.name ?? null)
        : null,
      band,
      window,
      rows: ranked
        .filter((r) => r.listed)
        .slice(0, limit)
        .map((r) => ({
          rank: r.rank,
          displayName: r.displayName,
          pct: r.pct,
          beaten: r.beaten,
          total: r.total,
          isYou: r.id === viewerId,
        })),
      you: mine
        ? {
            rank: mine.rank,
            pct: mine.pct,
            beaten: mine.beaten,
            total: mine.total,
            listed: mine.listed,
          }
        : null,
      rankedOverEveryone: true,
    };
  }
}
