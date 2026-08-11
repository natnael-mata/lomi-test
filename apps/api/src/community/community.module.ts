import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { AdminCommunityController, CommunityController } from './community.controller';
import { CommunityService } from './community.service';

/** Threads, replies, reports and moderation (Phase 11). */
@Module({
  imports: [AuthModule, CommonModule],
  controllers: [CommunityController, AdminCommunityController],
  providers: [CommunityService],
  exports: [CommunityService],
})
export class CommunityModule {}
