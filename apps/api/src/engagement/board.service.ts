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
 * **Two bands.** Junior is Grade 6 and Grade 8; senior is Grade 12 and the exit
 * exams. An eleven-year-old and a graduating undergraduate are not in a
 * competition together, and the junior default is not to appear at all.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { coveragePct } from '../progress/coverage';
import { bandFor, isListed, type Band } from './bands';

/** Which board: the last seven days, or everything. */
export type BoardWindow = 'week' | 'all';

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
    now: Date = new Date(),
    limit = 20,
  ): Promise<BoardView> {
    const viewer = await this.prisma.user.findUnique({
      where: { id: viewerId },
      select: { fieldId: true },
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
    const fields = await this.prisma.field.findMany({ select: { id: true, maxGrade: true } });
    const gradeByField = new Map(fields.map((f) => [f.id, f.maxGrade]));
    const band = bandFor(viewer?.fieldId ? (gradeByField.get(viewer.fieldId) ?? null) : null);
    const inBand = new Set(fields.filter((f) => bandFor(f.maxGrade) === band).map((f) => f.id));

    const totals = await this.prisma.question.groupBy({
      by: ['fieldId'],
      where: { status: 'PUBLISHED', fieldId: { in: [...inBand] } },
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
        fieldId: { in: [...inBand] },
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

    const mine = ranked.find((r) => r.id === viewerId) ?? null;

    return {
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
