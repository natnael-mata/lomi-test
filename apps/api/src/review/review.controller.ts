import { Controller, Get, Query } from '@nestjs/common';

import { ReviewService, type ReviewItem } from './review.service';

@Controller('admin/review')
export class ReviewController {
  constructor(private readonly review: ReviewService) {}

  @Get('next')
  next(@Query('reviewerId') reviewerId?: string): Promise<ReviewItem | null> {
    // Auth lands in Phase 3; until then the reviewer is supplied by the caller,
    // same as the publish endpoint.
    return this.review.next(reviewerId ?? 'unknown-reviewer');
  }
}
