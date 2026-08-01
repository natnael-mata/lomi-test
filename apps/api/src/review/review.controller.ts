import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { QuestionsService } from '../questions/questions.service';
import { ReviewService, type ReviewItem } from './review.service';

@Controller('admin/review')
export class ReviewController {
  constructor(
    private readonly review: ReviewService,
    private readonly questions: QuestionsService,
  ) {}

  @Get('next')
  next(@Query('reviewerId') reviewerId?: string): Promise<ReviewItem | null> {
    // Auth lands in Phase 3; until then the reviewer is supplied by the caller,
    // same as the publish endpoint.
    return this.review.next(reviewerId ?? 'unknown-reviewer');
  }

  /**
   * Publishing from the queue.
   *
   * Delegates to `QuestionsService.publish` rather than reimplementing: this and
   * `POST /admin/questions/:id/publish` are the same action reached from two
   * places, and a second copy of the gate call is a second place for the rule to
   * drift. The gate itself runs server-side on every publish regardless of route.
   */
  @Post(':id/bounce')
  bounce(
    @Param('id') id: string,
    @Body() body: { note?: string },
  ): Promise<{ id: string; status: string }> {
    return this.review.bounce(id, body.note ?? '');
  }

  @Post(':id/publish')
  publish(
    @Param('id') id: string,
    @Body() body: { reviewerId?: string },
  ): Promise<{ id: string; status: string }> {
    return this.questions.publish(id, body.reviewerId ?? 'unknown-reviewer');
  }
}
