import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';

import { FieldRequiredGuard } from '../auth/field-required.guard';
import { RateLimitService } from '../common/rate-limit.service';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { SittingLockGuard } from '../exams/sitting-lock.guard';
import type { AttemptSubmission } from './attempt-rules';
import { PracticeService, type AttemptResult } from './practice.service';
import type { PracticeSummary } from './summary';
import type { ServedQuestion } from './question-view';

/**
 * Practice.
 *
 * There is **one** question endpoint and it serves **one** question (T-107).
 * No list route, no `?limit=`, no bulk export: the question bank is the asset,
 * and any endpoint that returns many questions with answer content is a way to
 * copy it.
 */
@Controller('questions')
// SittingLockGuard is what actually holds T-124. Without it POST /attempts is an
// answer oracle for the student's own exam paper: read a questionId off the
// paper, post any label, and back comes isCorrect, correctLabel, every
// why-wrong, the concept line and the worked steps.
@UseGuards(SessionGuard, FieldRequiredGuard, SittingLockGuard)
export class PracticeController {
  constructor(
    private readonly practice: PracticeService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Get('next')
  next(
    @Req() req: AuthedRequest,
    @Query('topicId') topicId?: string,
  ): Promise<ServedQuestion> {
    /*
     * Rate limited per student (T-259).
     *
     * The door that was left open. No bulk endpoint exists, deliberately — and
     * this one served the same content one row at a time, unlimited, to anybody
     * holding a subscription. A complete copy of a bank the national exam is
     * drawn from is the most valuable study artifact in the country.
     *
     * Keyed on the user like `attempt`, and for the same reason: this product
     * runs in computer labs and behind shared mobile NAT, where limiting by
     * address locks out a room because one student is quick.
     *
     * Two windows. Thirty a minute is faster than the shortest question can be
     * read; six hundred a day is more than a month of good practice and a small
     * fraction of the bank.
     */
    this.rateLimit.consume('serveQuestion', req.auth!.userId, req.ip ?? null);
    this.rateLimit.consume('serveQuestionDaily', req.auth!.userId, req.ip ?? null);
    // `?topicId=` narrows the draw to one topic — what `/progress`'s "Practise
    // Depreciation" button has been asking for since it was written (T-269).
    return this.practice.next(req.auth!.userId, topicId ?? null);
  }
}

/**
 * Answering.
 *
 * Separate controller only because the route lives at `/attempts`; the same two
 * guards apply, because releasing answer content to somebody with no programme
 * chosen would serve them another field's explanation.
 */
@Controller('attempts')
@UseGuards(SessionGuard, FieldRequiredGuard, SittingLockGuard)
export class AttemptsController {
  constructor(
    private readonly practice: PracticeService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Post()
  attempt(@Req() req: AuthedRequest, @Body() body: AttemptSubmission): Promise<AttemptResult> {
    /*
     * Rate limited per student (T-206).
     *
     * Keyed on the user, not the address: this product is used in computer labs
     * and behind shared mobile NAT, where one fast student on an address would
     * otherwise lock out the room.
     *
     * The limit sits far above a person's pace — a question's smallest budget is
     * fifteen seconds, so sixty a minute is four times faster than the shortest
     * question can be read. It is here for a script grinding the bank, not for a
     * student in a hurry.
     */
    this.rateLimit.consume('attempt', req.auth!.userId, req.ip ?? null);
    return this.practice.attempt(req.auth!.userId, body ?? {});
  }

  /**
   * Names the reason, which is the half of "beaten" that stops a guess counting
   * (T-255).
   *
   * Rate limited on the same bucket as the attempt it belongs to. It is a
   * second write per question and a separate allowance would leave a cheaper
   * door beside a guarded one — the check exists to make guessing expensive, so
   * the route that grades it must not be the fast path.
   */
  @Post(':attemptId/reason')
  reason(
    @Req() req: AuthedRequest,
    @Param('attemptId') attemptId: string,
    @Body() body: { chosenId?: unknown },
  ): Promise<{ attemptId: string; reasonCorrect: boolean; beaten: boolean }> {
    this.rateLimit.consume('attempt', req.auth!.userId, req.ip ?? null);
    return this.practice.recordReason(req.auth!.userId, attemptId, body?.chosenId);
  }
}

/**
 * How today's practice went.
 *
 * Its own route rather than a field on the attempt response: a student asks for
 * this when they stop, not after every question, and putting it on every answer
 * would make the hot path do work nobody reads.
 */
@Controller('practice')
@UseGuards(SessionGuard, FieldRequiredGuard, SittingLockGuard)
export class PracticeSummaryController {
  constructor(private readonly practice: PracticeService) {}

  @Get('summary')
  summary(@Req() req: AuthedRequest): Promise<PracticeSummary> {
    return this.practice.summary(req.auth!.userId);
  }
}
