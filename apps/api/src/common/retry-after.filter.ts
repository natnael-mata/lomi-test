import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

import { TooManyRequests } from './rate-limit.service';

/**
 * Puts `Retry-After` on a 429 (T-259).
 *
 * **The refusal already knew the number and kept it to itself.** The body
 * carried `retryAfterSec` and the response carried no header, so anything that
 * was not our own client — a proxy, an HTTP library's retry policy, curl in a
 * shell loop — had no way to learn how long to wait and retried immediately.
 *
 * That matters more here than it looks. A 429 with no `Retry-After` produces a
 * tight retry loop, which is *exactly* the traffic the limit was written to
 * stop: the guard against hammering, hammering.
 *
 * The body is left alone. It says the same thing in words a person can read,
 * and clients already depend on it.
 */
@Catch(TooManyRequests)
export class RetryAfterFilter implements ExceptionFilter {
  catch(exception: TooManyRequests, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    // Whole seconds, and never zero: RFC 9110 wants a delay, and "retry after 0
    // seconds" is an invitation to do the thing that was just refused.
    response.setHeader('Retry-After', String(Math.max(1, Math.ceil(exception.retryAfterSec))));
    response.status(exception.getStatus()).json(exception.getResponse());
  }
}
