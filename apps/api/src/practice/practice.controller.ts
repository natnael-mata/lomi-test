import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import { FieldRequiredGuard } from '../auth/field-required.guard';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import type { AttemptSubmission } from './attempt-rules';
import { PracticeService, type AttemptResult } from './practice.service';
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
@UseGuards(SessionGuard, FieldRequiredGuard)
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
@UseGuards(SessionGuard, FieldRequiredGuard)
export class AttemptsController {
  constructor(private readonly practice: PracticeService) {}

  @Post()
  attempt(@Req() req: AuthedRequest, @Body() body: AttemptSubmission): Promise<AttemptResult> {
    return this.practice.attempt(req.auth!.userId, body ?? {});
  }
}
