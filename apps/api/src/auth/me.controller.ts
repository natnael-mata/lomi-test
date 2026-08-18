import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { StaffRole } from '@prisma/client';

import { AuthService, type DeviceEntry, type RevokeResult } from './auth.service';
import { SessionGuard, type AuthedRequest } from './session.guard';

/** Everything about the signed-in student. Guarded in full — nothing here is public. */
@Controller('me')
@UseGuards(SessionGuard)
export class MeController {
  constructor(private readonly auth: AuthService) {}

  /**
   * What this account is allowed to reach, if anything beyond a student's own
   * screens.
   *
   * **The interface needs this and there was nowhere to ask.** A provider gets
   * two destinations an admin does not, and the alternatives were both wrong:
   * render them for everybody and let the 403 explain, or have the browser probe
   * a guarded route to find out. `null` for a student, which is most people, and
   * the answer costs one indexed lookup.
   *
   * It says the role and nothing else. A route that returned the staff list, or
   * who granted it, would be a route that tells any signed-in student who the
   * operators are.
   */
  @Get('staff')
  async staff(@Req() req: AuthedRequest): Promise<{ role: StaffRole | null }> {
    return { role: await this.auth.staffRoleOf(req.auth!.userId) };
  }

  /**
   * The number this student pays with, if Telegram has vouched for one (T-078a).
   *
   * Their own, from the session. The checkout reads it so somebody who has
   * already shared their number does not type it again — which is the entire
   * payoff of asking, and without it the capture is a permission prompt that
   * buys nobody anything.
   */
  @Get('contact')
  async contact(
    @Req() req: AuthedRequest,
  ): Promise<{ phone: string | null; verifiedAt: string | null }> {
    return this.auth.contactOf(req.auth!.userId);
  }

  /** The programmes on offer. Guarded like the rest of `/me`, but not field-gated. */
  @Get('fields')
  fields(
    @Req() req: AuthedRequest,
  ): Promise<{ id: string; name: string; slug: string; chosen: boolean }[]> {
    return this.auth.publishedFields(req.auth!.userId);
  }

  @Put('field')
  chooseField(
    @Req() req: AuthedRequest,
    @Body() body: { fieldId?: string; isRetaker?: boolean },
  ): Promise<{ fieldId: string; name: string }> {
    return this.auth.chooseField(
      req.auth!.userId,
      body?.fieldId ?? '',
      typeof body?.isRetaker === 'boolean' ? body.isRetaker : undefined,
    );
  }

  @Get('devices')
  devices(@Req() req: AuthedRequest): Promise<DeviceEntry[]> {
    return this.auth.listDevices(req.auth!.userId, req.auth!.sessionId);
  }

  @Post('devices/:id/revoke')
  revoke(@Req() req: AuthedRequest, @Param('id') id: string): Promise<RevokeResult> {
    return this.auth.revokeDevice(req.auth!.userId, id);
  }
}
