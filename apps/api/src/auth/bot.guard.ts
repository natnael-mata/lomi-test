import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

import type { Request } from 'express';

/**
 * Guards the routes only the bot may call.
 *
 * The bot is a **server**, not a student: it has no session, and the identity it
 * supplies on `/auth/login-link/approve` is one Telegram gave it directly. That
 * makes these routes the most dangerous surface in the product — anything able
 * to call `approve` with a chosen Telegram id can sign in as anybody — so they
 * are behind a shared secret rather than any student credential.
 *
 * **Refuses outright when the secret is unset**, instead of allowing everything.
 * A guard that opens when its configuration is missing is worse than no guard,
 * because it looks like protection in code review and in the route table while
 * being a bypass in whichever environment forgot the variable.
 */
@Injectable()
export class BotGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.BOT_SHARED_SECRET ?? '';
    if (expected.length === 0) {
      throw new UnauthorizedException('Not authorised.');
    }

    const req = context.switchToHttp().getRequest<Request>();
    const presented = req.header('x-bot-secret') ?? '';

    // One message for every failure past this point — missing, wrong length,
    // wrong value. A caller learning *which* is a caller being helped.
    if (!secretMatches(presented, expected)) {
      throw new UnauthorizedException('Not authorised.');
    }
    return true;
  }
}

/**
 * Constant-time compare.
 *
 * Both sides are hashed first so the comparison is over fixed-length buffers:
 * `timingSafeEqual` throws on a length mismatch, and catching that to return
 * false would leak the secret's length through the very check meant to leak
 * nothing.
 */
function secretMatches(presented: string, expected: string): boolean {
  const a = createHash('sha256').update(presented).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
