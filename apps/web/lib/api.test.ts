import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ApiError, TOKEN_STORAGE_KEY } from './api';

const HERE = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(HERE, 'api.ts'), 'utf8');
const screen = readFileSync(resolve(HERE, '../app/practice/PracticeScreen.tsx'), 'utf8');

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

  it('sends the session token as a bearer when there is one', () => {
    expect(source).toContain('Authorization: `Bearer ${token}`');
    expect(TOKEN_STORAGE_KEY).toBe('lomi-session');
  });

  // The storage choice is a known tradeoff and is written down as one.
  it('records why the token is in localStorage rather than a cookie', () => {
    expect(source).toMatch(/httpOnly cookie/);
    expect(source).toMatch(/XSS/);
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
