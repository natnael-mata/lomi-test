/**
 * Signing in as a seeded tester, for journeys that are not about signing in.
 *
 * Through the real sign in endpoint, with the phone and password `dev:testers`
 * seeds, and the session put in the browser as the cookie the API would set.
 * One session per persona, kept between runs in the system temp directory and
 * checked against `/me` before use: the sign in limiter allows five a number
 * in ten minutes, and a worker restarts after any failure, so an in memory
 * cache alone ran out within two runs.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { BrowserContext } from '@playwright/test';

import { phoneFor, TEST_PASSWORD } from '../apps/web/scripts/tester-session.mjs';

export { phoneFor, TEST_PASSWORD };

const API = process.env.E2E_API ?? 'http://localhost:4000';

async function cachedToken(persona: string): Promise<string | null> {
  try {
    const token = readFileSync(join(tmpdir(), `lomi-e2e-token-${persona}`), 'utf8').trim();
    const check = await fetch(`${API}/me`, { headers: { Cookie: `lomi_session=${token}` } });
    return check.ok ? token : null;
  } catch {
    return null;
  }
}

export type Persona =
  'usera' | 'userb' | 'userc' | 'userd' | 'usere' | 'userh' | 'admin' | 'provider';

export async function signInAs(context: BrowserContext, persona: Persona): Promise<void> {
  let token = await cachedToken(persona);
  if (!token) {
    const res = await fetch(`${API}/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phoneFor(persona),
        password: TEST_PASSWORD,
        deviceLabel: 'E2E journey',
      }),
    });
    if (!res.ok) throw new Error(`Could not sign in as ${persona} (${res.status}).`);
    token = ((await res.json()) as { token: string }).token;
    writeFileSync(join(tmpdir(), `lomi-e2e-token-${persona}`), token);
  }
  await context.addCookies([
    {
      name: 'lomi_session',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}
