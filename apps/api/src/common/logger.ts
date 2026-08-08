import type { LoggerService } from '@nestjs/common';

import { formatLine, redact } from './redact';

/**
 * The application logger (T-207).
 *
 * Structured JSON so a line can be queried rather than grepped, and redacted on
 * the way out so nothing personal reaches the aggregator, the on-call engineer's
 * screen, or the chat message where somebody pastes a stack trace.
 *
 * **Redaction happens here, not at the call sites.** A rule enforced at every
 * `log()` is a rule somebody forgets on the one line that matters — usually an
 * error path, written in a hurry, interpolating whatever was in scope. Putting
 * it in the sink means the guarantee holds for code nobody has written yet,
 * including Nest's own framework logging.
 */
export class RedactingLogger implements LoggerService {
  log(message: unknown, ...rest: unknown[]): void {
    this.write('info', message, rest);
  }

  warn(message: unknown, ...rest: unknown[]): void {
    this.write('warn', message, rest);
  }

  error(message: unknown, ...rest: unknown[]): void {
    this.write('error', message, rest);
  }

  /** Nest calls these for framework noise; both are off by default in production. */
  debug(message: unknown, ...rest: unknown[]): void {
    if (process.env.NODE_ENV === 'production') return;
    this.write('info', message, rest);
  }

  verbose(message: unknown, ...rest: unknown[]): void {
    if (process.env.NODE_ENV === 'production') return;
    this.write('info', message, rest);
  }

  private write(level: 'info' | 'warn' | 'error', message: unknown, rest: unknown[]): void {
    const text = typeof message === 'string' ? message : JSON.stringify(redact(message));
    const context = rest.length === 0 ? undefined : rest.length === 1 ? rest[0] : rest;
    const line = formatLine(level, text ?? '', context);
    // One stream. Splitting errors to stderr means an aggregator that reads only
    // one of them silently loses half the story.
    process.stdout.write(`${line}\n`);
  }
}
