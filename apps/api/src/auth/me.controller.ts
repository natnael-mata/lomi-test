import { Body, Controller, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { StaffRole } from '@prisma/client';

import { AuthService, type DeviceList, type Identity, type RevokeResult } from './auth.service';
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
  /**
   * Who this session belongs to (T-251).
   *
   * **Nothing in the product said which account you were signed in as.** Both
   * QA passes called it a blocker, and for the same reason: with twelve test
   * personas and a door that switches between them, a sign-in that silently
   * did not take is invisible — one tester nearly filed several findings
   * against the wrong account, the other did file some.
   *
   * It is not only a testing problem. A student on a shared phone, or one who
   * has been evicted by a third sign-in, has the same question and the product
   * had no answer anywhere on any screen.
   *
   * The generated display name, never a legal name (T-086), and never the
   * telegram id — this is the same handle the leaderboard would show.
   */
  @Get()
  async whoami(@Req() req: AuthedRequest): Promise<Identity> {
    return this.auth.identityOf(req.auth!.userId);
  }

  /**
   * Changes what other students see: the display name, and nothing else.
   *
   * 422 `DISPLAY_NAME_REFUSED` with every `reasons` entry when the rules in
   * `display-name.ts` turn it down. The legal name and phone are not editable
   * here: they are not public, and changing either is a support matter.
   */
  @Patch()
  update(@Req() req: AuthedRequest, @Body() body: { displayName?: unknown }): Promise<Identity> {
    return this.auth.setDisplayName(req.auth!.userId, body?.displayName);
  }

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
  devices(@Req() req: AuthedRequest): Promise<DeviceList> {
    return this.auth.listDevices(req.auth!.userId, req.auth!.sessionId);
  }

  @Post('devices/:id/revoke')
  revoke(@Req() req: AuthedRequest, @Param('id') id: string): Promise<RevokeResult> {
    return this.auth.revokeDevice(req.auth!.userId, id);
  }
}
