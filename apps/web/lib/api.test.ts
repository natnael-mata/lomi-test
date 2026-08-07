import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ApiError } from './api';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(HERE, 'api.ts'), 'utf8');
const screen = readFileSync(resolve(HERE, '../app/practice/PracticeScreen.tsx'), 'utf8');

const code = stripComments(source);

describe('ApiError (T-112)', () => {
  // The UI branches on the CODE, never on a prose message. A message is copy and
  // will be reworded; a code is a contract.
  it('exposes the API’s error code', () => {
    expect(new ApiError(402, { error: 'FREE_LIMIT_REACHED' }, 'x').code).toBe('FREE_LIMIT_REACHED');
    expect(new ApiError(409, { error: 'FIELD_REQUIRED' }, 'x').code).toBe('FIELD_REQUIRED');
  });

  it('is null when the body carries no code', () => {
    expect(new ApiError(500, null, 'x').code).toBeNull();
    expect(new ApiError(500, {}, 'x').code).toBeNull();
    expect(new ApiError(500, { error: 42 }, 'x').code).toBeNull();
    expect(new ApiError(500, 'plain text', 'x').code).toBeNull();
  });

  it('keeps the status for cases with no code, like 404', () => {
    expect(new ApiError(404, null, 'x').status).toBe(404);
  });
});

describe('the API client', () => {
  // Same-origin: no preflight on every submission, no allow-list to keep in step
  // with each deploy, and moving to an httpOnly cookie stays a one-file change.
  it('calls this origin, never the API host directly', () => {
    expect(source).toContain('`/api${path}`');
    expect(source).not.toMatch(/https?:\/\/localhost:4000/);
  });

  /**
   * T-112a's stated test: the token appears in no JavaScript-readable storage.
   *
   * Asserted against the source rather than by poking at a live page, because
   * the claim is about what this client is *capable* of, not about what one
   * render happened to do. A `localStorage` call added next month fails here
   * even if no test exercises the path it sits on.
   */
  // Guards the stripping: if it ate everything, every ban below passes forever.
  it('still sees the client after comments are stripped', () => {
    // Deliberately three points: the top, the middle, and the far end. A guard
    // that only checks the beginning passes happily while the stripper eats
    // everything after the first awkward comment — which is exactly what it did.
    expect(code).toContain('export class ApiError');
    expect(code).toContain('fetch(');
    expect(code).toContain('examResult');
    expect(code.length).toBeGreaterThan(source.length / 2);
  });

  it('stores the session nowhere a script can read it', () => {
    for (const banned of ['localStorage', 'sessionStorage', 'document.cookie']) {
      expect(code, `${banned} would put the session back within reach of an XSS`).not.toContain(
        banned,
      );
    }
  });

  // Nothing to send: the browser attaches the httpOnly cookie by itself.
  it('sends no Authorization header of its own', () => {
    expect(code).not.toContain('Authorization');
    expect(code).not.toContain('Bearer');
  });

  /**
   * Stated rather than left to the default. The default changing would present
   * as an unrelated failure to authenticate, which is a bad afternoon.
   */
  it('sends credentials, so the cookie rides along', () => {
    expect(code).toContain("credentials: 'same-origin'");
  });

  // The reasoning is written down, because the next person will otherwise read
  // "httpOnly fixes XSS" into it, which is not what it does.
  it('records what the cookie does and does not buy', () => {
    expect(source).toMatch(/httpOnly/);
    expect(source).toMatch(/XSS/);
    expect(source).toMatch(/SameSite=Lax/);
  });
});

describe('the practice screen', () => {
  it('treats the free limit as its own screen, not an error', () => {
    expect(screen).toContain("e.code === 'FREE_LIMIT_REACHED'");
    expect(screen).toContain("kind: 'paywalled'");
  });

  it('has a distinct state for having run out of questions today', () => {
    expect(screen).toContain("kind: 'exhausted'");
  });

  it('blocks submission until an answer is chosen, saying why', () => {
    expect(screen).toContain('Choose an answer first');
    expect(screen).toMatch(/disabled=\{chosen === null/);
  });

  // Never a stale value, never a re-render.
  it('times the question with a ref rather than state', () => {
    expect(screen).toMatch(/shownAt = useRef/);
  });
});
