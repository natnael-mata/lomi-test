import {
  CanActivate,
  ConflictException,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import type { AuthedRequest } from './session.guard';

/**
 * Refuses anything that serves questions until the student has chosen a field.
 *
 * Not a nicety: every question belongs to exactly one programme, so "next
 * question" has no meaning without one. Answering with an arbitrary field would
 * quietly teach somebody the wrong syllabus, which is worse than an error.
 *
 * **409, not 400 or 403.** The request is well-formed and the caller is
 * authenticated; the account is simply in a state where this cannot be answered
 * yet. `409 + FIELD_REQUIRED` tells the client exactly which screen to show, and
 * a 403 would read as "you are not allowed" — a different problem with a
 * different fix.
 *
 * Runs after `SessionGuard`, and depends on it having set `req.auth`.
 */
@Injectable()
export class FieldRequiredGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (!req.auth) {
      // Reached only if this guard is wired without SessionGuard in front. Fail
      // closed and say so, rather than treating "no user" as "no field needed".
      throw new InternalServerErrorException(
        'FieldRequiredGuard needs SessionGuard in front of it.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: req.auth.userId },
      select: { fieldId: true },
    });

    if (!user?.fieldId) {
      throw new FieldRequiredException();
    }
    return true;
  }
}

/** 409 with a code the client can branch on, not a prose message it has to match. */
export class FieldRequiredException extends ConflictException {
  constructor() {
    super({ error: 'FIELD_REQUIRED', message: 'Choose a programme before practising.' });
    this.name = 'FieldRequiredException';
  }
}
