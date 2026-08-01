import { Body, Controller, Param, Post } from '@nestjs/common';

import { QuestionsService, type RetireResult } from './questions.service';

@Controller('admin/questions')
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Post(':id/publish')
  publish(
    @Param('id') id: string,
    @Body() body: { reviewerId?: string },
  ): Promise<{ id: string; status: string }> {
    // Auth lands in Phase 3; until then the reviewer is supplied by the caller.
    return this.questions.publish(id, body.reviewerId ?? 'unknown-reviewer');
  }

  @Post(':id/retire')
  retire(
    @Param('id') id: string,
    @Body() body: { actorId?: string; reason?: string },
  ): Promise<RetireResult> {
    return this.questions.retire(id, body.actorId ?? 'unknown-actor', body.reason);
  }
}
