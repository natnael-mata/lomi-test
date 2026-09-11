import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';

import { AdminGuard } from '../auth/staff.guard';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { WeightsService, type EffectiveWeight } from './weights.service';
import { TaxonomyService } from './taxonomy.service';

/**
 * Topic weights (T-134, T-134a).
 *
 * ADMIN only, and under `/admin`, so the route inventory test (T-107) keeps
 * holding. Nothing here is student-facing: a student sees a weight as a caption
 * on their own readiness, never as something they can set.
 */
@Controller('admin/fields/:fieldId/weights')
@UseGuards(SessionGuard, AdminGuard)
export class AdminWeightsController {
  constructor(private readonly weights: WeightsService) {}

  /** What the weights are now, without recomputing. */
  @Get()
  current(@Param('fieldId') fieldId: string): Promise<EffectiveWeight[]> {
    return this.weights.effective(fieldId);
  }

  /**
   * Recomputes from the bank and writes the result.
   *
   * A POST rather than a GET because it writes — and it needs to be re-runnable
   * after every import, since the weights are a view of a bank that moves.
   */
  @Post('derive')
  derive(@Req() req: AuthedRequest, @Param('fieldId') fieldId: string): Promise<EffectiveWeight[]> {
    return this.weights.derive(fieldId, req.auth?.userId ?? '');
  }

  /**
   * Overrides one topic and re-normalises the rest.
   *
   * The actor comes from the session, never the body. A client that names its
   * own actor can name anybody, which makes the record worthless precisely when
   * somebody needs to know who set a weight and why.
   */
  @Post('topics/:topicId')
  override(
    @Req() req: AuthedRequest,
    @Param('topicId') topicId: string,
    @Body() body: { weightPct?: unknown; reason?: unknown },
  ): Promise<EffectiveWeight[]> {
    return this.weights.override(
      topicId,
      typeof body.weightPct === 'number' ? body.weightPct : Number.NaN,
      typeof body.reason === 'string' ? body.reason : '',
      req.auth?.userId ?? '',
    );
  }

  /** Drops an override; the topic goes back to what the bank says. */
  @Delete('topics/:topicId')
  clear(@Req() req: AuthedRequest, @Param('topicId') topicId: string): Promise<EffectiveWeight[]> {
    return this.weights.clearOverride(topicId, req.auth?.userId ?? '');
  }
}

/**
 * The programme's own settings, beside its weights (T-269).
 *
 * Its own controller rather than another route on the weights one: the weights
 * controller is mounted at `admin/fields/:fieldId/weights`, and the exam date
 * is a fact about the field rather than about its weighting. Same guards, same
 * `/admin` prefix, so the route inventory test keeps holding.
 */
@Controller('admin/fields/:fieldId')
@UseGuards(SessionGuard, AdminGuard)
export class AdminFieldController {
  constructor(private readonly taxonomy: TaxonomyService) {}

  /**
   * Sets or clears the sitting this programme counts down to.
   *
   * `null` clears. That has to stay possible — a date entered against the wrong
   * programme is worse than no date, because the daily target it produces looks
   * every bit as authoritative as a correct one.
   */
  @Post('exam-date')
  setExamDate(
    @Req() req: AuthedRequest,
    @Param('fieldId') fieldId: string,
    @Body() body: { examDate?: unknown },
  ): Promise<{ examDate: string | null }> {
    return this.taxonomy.setExamDate(fieldId, body?.examDate ?? null, req.auth?.userId ?? '');
  }
}
