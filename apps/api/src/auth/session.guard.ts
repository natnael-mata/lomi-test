import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import { PrismaService } from '../prisma/prisma.service';
import { verifySessionToken } from './tokens';

/** What a guarded handler can rely on having. */
export interface AuthedRequest extends Request {
  auth?: { userId: string; sessionId: string };
  /** Set by `StaffGuard` when the caller is staff. */
  staffRole?: 'REVIEWER' | 'ADMIN';
}

/**
 * Turns a bearer token into an authenticated request.
 *
 * **The token alone is never enough.** Its signature only proves it was issued;
 * the session row proves it is still valid, and that row is what
 * `POST /me/devices/:id/revoke` (T-084) and the two-device limit (T-082) act on.
 * A guard that trusts the JWT and skips the lookup makes revocation a lie —
 * "signed out" would mean "signed out in ninety days".
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();

    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Send a bearer token.');
    }

    const result = verifySessionToken(token, process.env.JWT_SECRET ?? '');
    if (!result.ok) throw new UnauthorizedException(result.reason);

    const session = await this.prisma.session.findUnique({
      where: { id: result.claims.sid },
      select: { id: true, userId: true, revokedAt: true },
    });
    // Deliberately one message for every failure past the signature. Which of
    // "no such session", "revoked" or "belongs to someone else" applies is not
    // the caller's business, and saying so tells an attacker which token ids are
    // real.
    if (!session || session.revokedAt !== null || session.userId !== result.claims.sub) {
      throw new UnauthorizedException('This session is no longer valid.');
    }

    // Best-effort: the device list is more useful with a live last-seen, but a
    // failure to record it must never cost the request.
    await this.prisma.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);

    req.auth = { userId: session.userId, sessionId: session.id };
    return true;
  }
}
