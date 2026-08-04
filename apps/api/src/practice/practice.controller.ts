import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import { FieldRequiredGuard } from '../auth/field-required.guard';
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
  constructor(private readonly practice: PracticeService) {}

  @Get('next')
  next(@Req() req: AuthedRequest): Promise<ServedQuestion> {
    return this.practice.next(req.auth!.userId);
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
  constructor(private readonly practice: PracticeService) {}

  @Post()
  attempt(@Req() req: AuthedRequest, @Body() body: AttemptSubmission): Promise<AttemptResult> {
    return this.practice.attempt(req.auth!.userId, body ?? {});
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
