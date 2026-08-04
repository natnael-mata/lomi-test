import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';

import { AdminGuard } from '../auth/staff.guard';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { QuestionsService, type RetireResult } from './questions.service';

/**
 * Publishing and retiring — the two actions that change what a student can see.
 *
 * **ADMIN only**, and the actor comes from the session. Both shipped unguarded
 * with the actor taken from the request body, which meant anyone who could reach
 * the port could publish a question and name someone else as the reviewer.
 */
@Controller('admin/questions')
@UseGuards(SessionGuard, AdminGuard)
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Post(':id/publish')
  publish(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
  ): Promise<{ id: string; status: string }> {
    return this.questions.publish(id, req.auth!.userId);
  }

  @Post(':id/retire')
  retire(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ): Promise<RetireResult> {
    return this.questions.retire(id, req.auth!.userId, body?.reason);
  }
}
