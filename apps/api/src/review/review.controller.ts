import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';

import { AdminGuard, StaffGuard } from '../auth/staff.guard';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { QuestionsService } from '../questions/questions.service';
import type { ReviewPatch } from './review-patch';
import { ReviewService, type ReviewItem } from './review.service';

/**
 * The review queue.
 *
 * Guarded twice over: `SessionGuard` establishes who is calling, `StaffGuard`
 * establishes that they are allowed near the answer key at all. Before these
 * existed the whole queue — correct answers, concept lines, why-wrongs — was
 * readable unauthenticated.
 *
 * **The actor is taken from the session, never from the body.** It used to come
 * from `body.reviewerId`, which made T-044's self-review rule decorative: any
 * caller could publish their own question by naming somebody else.
 */
@Controller('admin/review')
@UseGuards(SessionGuard, StaffGuard)
export class ReviewController {
  constructor(
    private readonly review: ReviewService,
    private readonly questions: QuestionsService,
  ) {}

  @Get('next')
  next(@Req() req: AuthedRequest): Promise<ReviewItem | null> {
    return this.review.next(req.auth!.userId);
  }

  /**
   * Where a reviewer writes the answer content the import could not carry —
   * why-wrongs, the concept line, the answer itself (T-031a).
   */
  @Patch(':id')
  patch(
    @Param('id') id: string,
    @Body() body: ReviewPatch,
  ): Promise<{ id: string; status: string; changed: string[] }> {
    return this.review.patch(id, body ?? {});
  }

  @Post(':id/submit')
  submit(@Param('id') id: string): Promise<{ id: string; status: string }> {
    return this.review.submit(id);
  }

  @Post(':id/bounce')
  bounce(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { note?: string },
  ): Promise<{ id: string; status: string }> {
    return this.review.bounce(id, body?.note ?? '', req.auth!.userId);
  }

  /**
   * Publishing from the queue. **ADMIN only** — a reviewer proposes, an admin
   * decides what a student reads.
   *
   * Delegates to `QuestionsService.publish` rather than reimplementing: this and
   * `POST /admin/questions/:id/publish` are one action reached from two places,
   * and a second copy of the gate call is a second place for the rule to drift.
   */
  @Post(':id/publish')
  @UseGuards(AdminGuard)
  publish(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
  ): Promise<{ id: string; status: string }> {
    return this.questions.publish(id, req.auth!.userId);
  }
}
