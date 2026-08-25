import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';

import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { BoardService, type BoardView } from './board.service';
import {
  EngagementService,
  type LeaderboardView,
  type LedgerRow,
  type StandingView,
} from './engagement.service';

/**
 * Points, streaks and the board (Phase 11).
 *
 * Everything is behind `SessionGuard` and reads the user from the session. The
 * leaderboard is not public in the sense of unauthenticated: a board of display
 * names and scores is still information about real students, and there is no
 * reason for it to be readable by anybody who finds the URL.
 */
@Controller('me')
@UseGuards(SessionGuard)
export class EngagementController {
  constructor(
    private readonly engagement: EngagementService,
    private readonly boards: BoardService,
  ) {}

  /** Where this student stands, every figure derived from the ledger. */
  @Get('standing')
  standing(@Req() req: AuthedRequest): Promise<StandingView> {
    return this.engagement.standingFor(req.auth!.userId);
  }

  /** What every number was for (T-190). Their own, from the session. */
  @Get('points')
  ledger(@Req() req: AuthedRequest, @Query('limit') limit?: string): Promise<LedgerRow[]> {
    const take = Math.min(Math.max(Number(limit) || 50, 1), 200);
    return this.engagement.ledgerFor(req.auth!.userId, take);
  }

  /**
   * The banded board (T-257): junior or senior, ranked by coverage percentage.
   *
   * Weekly by default. An all-time board is decided by January — the top places
   * belong to whoever subscribed first and nobody joining later can reach them —
   * so `?window=all` is the secondary view a student opts into, not the one they
   * are shown.
   */
  @Get('board')
  board(
    @Req() req: AuthedRequest,
    @Query('window') window?: string,
    @Query('scope') scope?: string,
  ): Promise<BoardView> {
    return this.boards.board(
      req.auth!.userId,
      window === 'all' ? 'all' : 'week',
      // Anything unrecognised falls to the student's own exam — the narrower
      // board, and the one that cannot surprise anybody by who is on it.
      scope === 'everyone' ? 'everyone' : 'exam',
    );
  }

  /** The board, with the asker's own rank whether or not they are listed (T-194). */
  @Get('leaderboard')
  leaderboard(@Req() req: AuthedRequest): Promise<LeaderboardView> {
    return this.engagement.leaderboard(req.auth!.userId);
  }

  /**
   * Opts in or out of public boards (T-194).
   *
   * The body is the choice, not a toggle: `{"optOut": true}` says what state the
   * student wants, so a retried request cannot flip them back.
   */
  @Post('leaderboard/opt-out')
  optOut(
    @Req() req: AuthedRequest,
    @Body() body: { optOut?: boolean },
  ): Promise<{ optedOut: boolean }> {
    return this.engagement.setLeaderboardOptOut(req.auth!.userId, body?.optOut !== false);
  }
}
