import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { AdminGuard } from '../auth/staff.guard';
import { SessionGuard } from '../auth/session.guard';
import {
  AdminDashboardService,
  type DashboardOverview,
  type RevenueSplit,
  type UserSearchHit,
} from './admin-dashboard.service';
import { AdminUsersService, type MissedTopic } from './admin-users.service';

/**
 * What an operator looks at rather than acts on (T-160, T-161, T-162, T-163).
 *
 * Read-only, and still ADMIN-guarded: these are aggregates over every student's
 * answers and payments, which is not something a student may see about anybody
 * but themselves.
 */
@Controller('admin/analytics')
@UseGuards(SessionGuard, AdminGuard)
export class AdminAnalyticsController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly dashboard: AdminDashboardService,
  ) {}

  /** The overview figures, each a live count (T-160). */
  @Get('overview')
  overview(): Promise<DashboardOverview> {
    return this.dashboard.overview();
  }

  /** Money taken, split by how it arrived, footing to a total (T-161). */
  @Get('revenue')
  revenue(): Promise<RevenueSplit> {
    return this.dashboard.revenue();
  }

  /**
   * Finds a student by phone, display name or transaction reference (T-163).
   *
   * A short query returns nothing rather than everybody: two characters would
   * match most of the table, and a support screen that dumps every student on a
   * stray keystroke is a privacy problem wearing a search box.
   */
  @Get('users/search')
  searchUsers(@Query('q') q: string): Promise<UserSearchHit[]> {
    return this.dashboard.search(q ?? '');
  }

  /** Most-missed topics in a field, weighted by derived share (T-162). */
  @Get('missed/:fieldId')
  missed(@Param('fieldId') fieldId: string): Promise<MissedTopic[]> {
    return this.users.missedTopics(fieldId);
  }
}
