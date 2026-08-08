import { Controller, Get, Param, UseGuards } from '@nestjs/common';

import { AdminGuard } from '../auth/staff.guard';
import { SessionGuard } from '../auth/session.guard';
import { AdminUsersService, type MissedTopic } from './admin-users.service';

/**
 * What an operator looks at rather than acts on (T-162).
 *
 * Read-only, and still ADMIN-guarded: these are aggregates over every student's
 * answers, which is not something a student may see about anybody but
 * themselves.
 */
@Controller('admin/analytics')
@UseGuards(SessionGuard, AdminGuard)
export class AdminAnalyticsController {
  constructor(private readonly users: AdminUsersService) {}

  /** Most-missed topics in a field, weighted by derived share (T-162). */
  @Get('missed/:fieldId')
  missed(@Param('fieldId') fieldId: string): Promise<MissedTopic[]> {
    return this.users.missedTopics(fieldId);
  }
}
