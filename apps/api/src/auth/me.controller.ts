import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';

import { AuthService, type DeviceEntry, type RevokeResult } from './auth.service';
import { SessionGuard, type AuthedRequest } from './session.guard';

/** Everything about the signed-in student. Guarded in full — nothing here is public. */
@Controller('me')
@UseGuards(SessionGuard)
export class MeController {
  constructor(private readonly auth: AuthService) {}

  /** The programmes on offer. Guarded like the rest of `/me`, but not field-gated. */
  @Get('fields')
  fields(): Promise<{ id: string; name: string; slug: string }[]> {
    return this.auth.publishedFields();
  }

  @Put('field')
  chooseField(
    @Req() req: AuthedRequest,
    @Body() body: { fieldId?: string },
  ): Promise<{ fieldId: string; name: string }> {
    return this.auth.chooseField(req.auth!.userId, body?.fieldId ?? '');
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
