import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

import type { AuthedRequest } from '../auth/session.guard';
import { PrismaService } from '../prisma/prisma.service';
import { sittingState } from './sitting-clock';

/**
 * Closes practice while a sitting is live.
 *
 * Without it, `POST /attempts` is an answer oracle for the student's own exam
 * paper: read a `questionId` off the paper, post any label, and the response
 * carries `isCorrect`, `correctLabel`, every `whyWrong`, the concept line and the
 * worked steps. No server bug is required — practice gates on field, published
 * status and the free tier, and knows nothing about sittings.
 *
 * That makes this guard, not the exam payloads, the thing that actually holds
 * T-124: the exam routes could be perfect and the breach would still be one
 * `POST /attempts` away.
 *
 * Liveness is derived (`closedAt IS NULL AND now <= endsAt`), so an abandoned
 * sitting does not lock a student out of practice forever.
 */
@Injectable()
export class SittingLockGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    // Reachable only if wired without SessionGuard in front. Fail closed rather
    // than treating "no caller" as "no sitting".
    if (!req.auth) throw new ForbiddenException('SittingLockGuard needs SessionGuard in front.');

    const open = await this.prisma.sitting.findFirst({
      where: { userId: req.auth.userId, closedAt: null },
      select: { id: true, startedAt: true, endsAt: true, closedAt: true },
    });

    if (open && sittingState(open, new Date()) === 'open') {
      throw new ForbiddenException({
        error: 'SITTING_IN_PROGRESS',
        sittingId: open.id,
        message: 'Finish or submit your exam before practising.',
      });
    }
    return true;
  }
}
