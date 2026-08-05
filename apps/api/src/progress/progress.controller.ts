import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';

import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { ProgressService, type ReadinessView } from './progress.service';
import type { SittingPoint } from './trend';

/**
 * A student's own progress (T-135–T-139).
 *
 * Under `/me`, and scoped to `req.auth.userId` in every query — never to an id
 * from the path. A readiness endpoint that took a user id would let anybody read
 * anybody's scores, and this is the one place in the product where the data is
 * both personal and dull enough that nobody would notice.
 */
@Controller('me')
@UseGuards(SessionGuard)
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get('readiness/:fieldId')
  readiness(@Req() req: AuthedRequest, @Param('fieldId') fieldId: string): Promise<ReadinessView> {
    return this.progress.readiness(req.auth!.userId, fieldId);
  }

  @Get('trend/:fieldId')
  trend(@Req() req: AuthedRequest, @Param('fieldId') fieldId: string): Promise<SittingPoint[]> {
    return this.progress.trend(req.auth!.userId, fieldId);
  }
}
