import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';

import { AdminGuard } from '../auth/staff.guard';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import {
  ExamBuildService,
  type BankReadiness,
  type BuildRequest,
  type BuiltExam,
} from './exam-build.service';

/**
 * Building mock papers.
 *
 * ADMIN only, and under `/admin` so the route inventory test (T-107) keeps
 * holding: only one student-facing route may carry anything question-shaped.
 */
@Controller('admin/exams')
@UseGuards(SessionGuard, AdminGuard)
export class AdminExamsController {
  constructor(private readonly build: ExamBuildService) {}

  /**
   * What the bank can currently support — a dry run that changes nothing.
   *
   * This, not the 422, is the useful half of T-120a: it tells whoever is
   * preparing content exactly what is missing *before* anyone tries to build,
   * and it is the only place that reports the unweighted-topics problem which is
   * the real reason a pool comes back empty.
   */
  @Get(':fieldId/readiness')
  readiness(@Param('fieldId') fieldId: string): Promise<BankReadiness> {
    return this.build.readiness(fieldId);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() body: BuildRequest): Promise<BuiltExam> {
    return this.build.build(body, req.auth!.userId);
  }
}
