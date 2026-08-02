import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MeController } from './me.controller';
import { SessionGuard } from './session.guard';

@Module({
  controllers: [AuthController, MeController],
  providers: [AuthService, SessionGuard],
  exports: [AuthService, SessionGuard],
})
export class AuthModule {}
