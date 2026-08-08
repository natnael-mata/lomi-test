import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';

import { AdminGuard } from '../auth/staff.guard';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { AdminUsersService, type DeactivateResult, type ResetResult } from './admin-users.service';

/**
 * Operator actions on a student's account (T-164).
 *
 * ADMIN only, and under `/admin`, so the route inventory test (T-107) keeps
 * holding. Both actions here are ones a student will phone support about — a
 * lost phone, a shared login — and both are audited (T-167).
 */
@Controller('admin/users')
@UseGuards(SessionGuard, AdminGuard)
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  /**
   * Signs a student out of every device.
   *
   * The support call this exists for is "I lost my phone" — and the two-device
   * limit means a lost phone is also a device a student cannot get back without
   * this.
   */
  @Post(':userId/reset-devices')
  resetDevices(
    @Req() req: AuthedRequest,
    @Param('userId') userId: string,
    @Body() body: { reason?: string },
  ): Promise<ResetResult> {
    return this.users.resetDevices(userId, req.auth!.userId, body?.reason);
  }

  /** Deactivates or reactivates an account. Reversible, and audited both ways. */
  @Post(':userId/deactivate')
  deactivate(
    @Req() req: AuthedRequest,
    @Param('userId') userId: string,
    @Body() body: { active?: boolean; reason?: string },
  ): Promise<DeactivateResult> {
    return this.users.setActive(userId, body?.active === true, req.auth!.userId, body?.reason);
  }
}
