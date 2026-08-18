import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { ProviderGuard } from '../auth/staff.guard';
import { SessionGuard } from '../auth/session.guard';
import {
  ActivityService,
  ACTIVITY_KINDS,
  type ActivityKind,
  type ActivityPage,
} from './activity.service';
import { HealthService, type HealthReport } from './health.service';

/**
 * The provider's two screens (T-227, T-228).
 *
 * PROVIDER only, and under its own prefix so the route inventory test (T-107)
 * keeps holding. Both routes are **reads with no arguments that name a person**:
 * there is no `?userId=`, because a surface that can be pointed at one student
 * is a surface for following one student, and the question this exists to answer
 * is "what has been going on", not "what has that one been doing".
 */
@Controller('provider')
@UseGuards(SessionGuard, ProviderGuard)
export class ProviderController {
  constructor(
    private readonly activity: ActivityService,
    private readonly health: HealthService,
  ) {}

  /**
   * Everything that happened, newest first.
   *
   * `kinds` filters; `before` pages. Both are optional and an absent `kinds`
   * means all of them — a feed that defaults to a subset is a feed that hides
   * something from the person whose job is to see it.
   */
  @Get('activity')
  feed(
    @Query('kinds') kinds?: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ): Promise<ActivityPage> {
    const wanted = (kinds ?? '')
      .split(',')
      .map((k) => k.trim())
      .filter((k): k is ActivityKind => (ACTIVITY_KINDS as readonly string[]).includes(k));

    return this.activity.feed({
      kinds: wanted,
      before: before || undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /**
   * Live health, measured at the moment of asking.
   *
   * Uncached on purpose. A status board that answers "is it up now" with a
   * number from four minutes ago is worse than one that answers nothing.
   */
  @Get('health')
  status(): Promise<HealthReport> {
    return this.health.report();
  }
}
