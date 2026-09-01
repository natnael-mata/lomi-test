import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedactingLogger } from './common/logger';

const DEFAULT_PORT = 4000;

/**
 * Secrets the process cannot do its job without.
 *
 * **`JWT_SECRET` was documented as required to boot and was not.** Nothing
 * checked it, so a process started without it came up, bound its port, answered
 * `/health` with `{"status":"ok"}`, connected to Postgres — and then returned a
 * 500 from `POST /auth/sign-in` for every account, because the one place that
 * reads it throws when signing a token. A tester spent fifteen minutes proving
 * nobody could log in against a service that was reporting itself healthy.
 *
 * Failing here instead costs one restart and names the variable.
 */
const REQUIRED = ['JWT_SECRET', 'DATABASE_URL'] as const;

/**
 * Loads the workspace-root `.env` into the process, for local development.
 *
 * **Nothing had ever loaded it.** `apps/api/.env.example` says plainly that it
 * exists "purely so `prisma migrate` and `prisma generate` can find the
 * database — everything else lives in the root .env", and Prisma does read its
 * own file. So `DATABASE_URL` worked and every other variable in the root file
 * did not, including a `JWT_SECRET` that had been sitting there correctly set
 * the whole time. `npm run dev:api` is `node dist/main.js` with no loader in
 * front of it; the secret only ever reached the process when somebody happened
 * to export it in the shell first.
 *
 * The result was a service that booted, bound its port, answered `/health` with
 * `ok`, and returned a 500 from every sign-in.
 *
 * A no-op when the file is absent, and the real environment always wins — a
 * stale `.env` on a server must not beat what systemd or the platform set.
 */
function loadLocalEnv(): void {
  // Three up from `dist/` and from `src/` alike: apps/api/{dist,src} → root.
  const file = resolve(__dirname, '..', '..', '..', '.env');
  if (!existsSync(file)) return;
  const already = { ...process.env };
  process.loadEnvFile(file);
  Object.assign(process.env, already);
}

async function bootstrap(): Promise<void> {
  loadLocalEnv();

  /*
   * Before anything binds a port.
   *
   * Listed together and reported together: a process that dies naming one
   * missing variable, gets it, and dies naming the next is three restarts to
   * learn what one message could have said.
   */
  const missing = REQUIRED.filter((key) => (process.env[key] ?? '').trim() === '');
  if (missing.length > 0) {
    throw new Error(
      `Refusing to start: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not set. ` +
        'Put them in apps/api/.env for local development, or in the service environment.',
    );
  }

  // `rawBody` is what makes Chapa's webhook signature checkable (T-143): the
  // HMAC covers the bytes that were sent, and a re-serialised body is a
  // different document with a different hash.
  const app = await NestFactory.create(AppModule, {
    logger: new RedactingLogger(),
    rawBody: true,
  });
  /*
   * `PORT` first, then `API_PORT`, then the default.
   *
   * Managed hosting assigns a port and expects the process to bind whatever it
   * was given — an app that listens on a port of its own choosing builds fine
   * and then fails every health check, which presents as "the platform is
   * broken". `API_PORT` stays ahead of the default so the systemd deployment,
   * which sets it, keeps working unchanged.
   */
  /*
   * A global prefix, only where the platform asks for one.
   *
   * AletCloud routes an app by path prefix and passes the prefix **through** —
   * mounted at `/api`, the process receives `/api/health`, not `/health`. The
   * VPS does the opposite: nginx's `proxy_pass …:4400/` strips it, so Nest sees
   * `/health` there.
   *
   * Env-driven and off by default, so the same build serves both without
   * either deployment carrying the other's assumption.
   */
  const prefix = process.env.API_GLOBAL_PREFIX?.trim();
  if (prefix) app.setGlobalPrefix(prefix);

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? DEFAULT_PORT);
  await app.listen(port);
  console.log(`api listening on http://localhost:${port}`);
}

void bootstrap();
