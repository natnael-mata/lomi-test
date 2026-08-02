import { Controller, Get, Req, UseGuards } from '@nestjs/common';

import { FieldRequiredGuard } from '../auth/field-required.guard';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { PracticeService } from './practice.service';
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
