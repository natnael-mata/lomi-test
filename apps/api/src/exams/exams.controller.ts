import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';

import { FieldRequiredGuard } from '../auth/field-required.guard';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import type { SittingItem, SittingManifest } from './exam-view';
import { ExamsService, type SittingResultView, type StartResult } from './exams.service';

/**
 * Sitting a mock exam.
 *
 * **No route path here contains `question` or `review`.** The route-inventory
 * test (T-107) asserts that exactly one student-facing path carries anything
 * question-shaped, and that assertion is an invariant — the tempting fix when a
 * new route trips it is to relax the regex, which is exactly the wrong move.
 */
@Controller('exams')
@UseGuards(SessionGuard, FieldRequiredGuard)
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Post(':fieldId/start')
  start(@Req() req: AuthedRequest): Promise<StartResult> {
    // The field comes from the user row, never the URL: a field id in the path
    // would let a student sit another programme's paper. The parameter stays for
    // the client's benefit and is deliberately ignored.
    return this.exams.start(req.auth!.userId, req.auth!.sessionId);
  }

  @Get('sittings/:sittingId')
  manifest(@Req() req: AuthedRequest, @Param('sittingId') id: string): Promise<SittingManifest> {
    return this.exams.manifest(req.auth!.userId, id);
  }

  @Get('sittings/:sittingId/paper/:position')
  item(
    @Req() req: AuthedRequest,
    @Param('sittingId') id: string,
    @Param('position', ParseIntPipe) position: number,
  ): Promise<SittingItem> {
    return this.exams.item(req.auth!.userId, id, position);
  }

  @Put('sittings/:sittingId/answers/:position')
  answer(
    @Req() req: AuthedRequest,
    @Param('sittingId') id: string,
    @Param('position', ParseIntPipe) position: number,
    @Body() body: { chosenLabel?: unknown; isFlagged?: unknown },
  ) {
    return this.exams.answer(req.auth!.userId, id, position, body ?? {}, req.auth!.sessionId);
  }

  @Post('sittings/:sittingId/submit')
  submit(@Req() req: AuthedRequest, @Param('sittingId') id: string): Promise<SittingResultView> {
    return this.exams.submit(req.auth!.userId, id);
  }

  @Get('sittings/:sittingId/result')
  result(@Req() req: AuthedRequest, @Param('sittingId') id: string): Promise<SittingResultView> {
    return this.exams.result(req.auth!.userId, id);
  }
}
