/**
 * The dev scripts never reach the built application (T-199b).
 *
 * `dev:session` mints a session token and `dev:staff` grants a staff role. Both
 * read `JWT_SECRET` and write to whatever `DATABASE_URL` points at, so either
 * one pointed at production is handing out an account.
 *
 * They are **scripts rather than endpoints** precisely so they cannot ship — a
 * `/auth/dev-login` route, however carefully guarded by `NODE_ENV`, is an
 * authentication bypass sitting in the bundle one misconfigured variable from
 * being live. This asserts the property that makes that true, rather than
 * trusting it to keep holding.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Walks up to the api workspace root; `import.meta` is a syntax error here. */
function findApiRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    for (const candidate of [resolve(dir, 'apps/api'), dir]) {
      if (existsSync(join(candidate, 'scripts/dev-session.ts'))) return candidate;
    }
    dir = dirname(dir);
  }
  throw new Error('could not locate apps/api');
}

const API = findApiRoot();
const SRC = join(API, 'src');

function files(dir: string, match: RegExp): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return files(full, match);
    return match.test(name) ? [full] : [];
  });
}

const DEV_SCRIPTS = ['dev-session.ts', 'dev-publish.ts', 'dev-staff.ts'];

describe('the dev scripts stay out of the build (T-199b)', () => {
  it('exist where they are expected to', () => {
    // Guards every assertion below: if the scripts move, "not in dist" becomes
    // trivially true and this test starts proving nothing.
    for (const name of DEV_SCRIPTS) {
      expect(existsSync(join(API, 'scripts', name)), `${name} is missing`).toBe(true);
    }
  });

  it('is excluded from the build config explicitly, not by accident', () => {
    const config = readFileSync(join(API, 'tsconfig.build.json'), 'utf8');
    expect(config).toContain('scripts/**');
  });

  /**
   * The build is from `src` only. Stated as its own assertion because widening
   * `include` is an ordinary thing to do for a good reason, and it would take
   * the scripts with it.
   */
  it('builds from src alone', () => {
    const config = JSON.parse(
      readFileSync(join(API, 'tsconfig.json'), 'utf8').replace(/^\s*\/\/.*$/gm, ''),
    ) as { include: string[] };
    expect(config.include).toEqual(['src/**/*.ts']);
  });

  /**
   * The one `dev-*` file that is allowed into the build, named here rather than
   * renamed out of the guard's way.
   *
   * `src/auth/dev-login.ts` is not a dev *script* — it is production code
   * implementing the smoke-test sign-in route (T-206a), and the whole point of
   * that route is that it runs on a deployed box. Renaming it to something the
   * pattern misses would be dodging the check rather than answering it.
   *
   * It is listed as one line so that the guard still catches the next
   * `dev-something.ts` that appears in `src`, which is what it is for.
   */
  const ALLOWED_IN_DIST = [
    'dist/auth/dev-login.js',
    'dist/auth/dev-login.js.map',
    'dist/auth/dev-login.d.ts',
  ];

  it('leaves no compiled dev script in dist', () => {
    const dist = join(API, 'dist');
    if (!existsSync(dist)) return; // Nothing built yet; the checks above still hold.
    const compiled = files(dist, /^dev-/)
      .map((f) => relative(API, f))
      .filter((f) => !ALLOWED_IN_DIST.includes(f));
    expect(compiled, `these shipped: ${compiled.join(', ')}`).toEqual([]);
  });

  /**
   * The exception is not a hole. `dev-login.ts` may ship, but it may only ship
   * shut — and T-206a is the launch blocker that deletes it outright.
   */
  it('lets the smoke-test door ship only because it is shut by default', () => {
    const source = readFileSync(join(API, 'src/auth/dev-login.ts'), 'utf8');
    // No default, no fallback, no inference from NODE_ENV.
    expect(source).toContain('DEV_LOGIN_SECRET');
    expect(source).not.toMatch(/DEV_LOGIN_SECRET\s*\?\?/);
    expect(source).not.toContain("NODE_ENV !== 'production'");
    // And it is tracked for removal, in the file a launch checklist reads.
    expect(readFileSync(join(API, '../../TASK.md'), 'utf8')).toContain('T-206a');
  });

  /**
   * Nothing in the application may import one. An import would pull the script
   * into the bundle regardless of what the build config excludes, which is the
   * one way this property fails silently.
   */
  it('is imported by nothing in the application', () => {
    const offenders = files(SRC, /\.ts$/)
      .filter((f) => !f.includes('.test'))
      .filter((f) => /from ['"][^'"]*scripts\//.test(readFileSync(f, 'utf8')))
      .map((f) => relative(API, f));
    expect(offenders, `these import a script: ${offenders.join(', ')}`).toEqual([]);
  });

  /** The deploy documentation says so, which is what T-199b asks for. */
  it('is written down where somebody deploying would read it', () => {
    let dir = process.cwd();
    let readme = '';
    for (let i = 0; i < 6 && !readme; i++) {
      const candidate = resolve(dir, 'README.md');
      if (existsSync(candidate) && readFileSync(candidate, 'utf8').includes('## Deploying')) {
        readme = readFileSync(candidate, 'utf8');
      }
      dir = dirname(dir);
    }
    expect(readme, 'no README with a Deploying section').not.toBe('');
    expect(readme).toContain('never run against production');
    expect(readme).toContain('dist');
  });
});

/**
 * The app binds the port it is given (portability).
 *
 * Managed hosting assigns a port through `PORT` and expects the process to use
 * it. An app that listens on a port of its own choosing builds fine and then
 * fails every health check — which presents as "the platform is broken" and is
 * a genuinely horrible afternoon.
 *
 * Asserted against the source rather than by booting: the failure is a missing
 * line, and a boot test would need a real socket to prove the negative.
 */
describe('the API binds the port it is given', () => {
  const main = readFileSync(join(API, 'src/main.ts'), 'utf8');

  it('reads PORT first', () => {
    expect(main).toContain('process.env.PORT');
    // Ahead of API_PORT, or a platform-assigned port loses to a leftover
    // variable in the environment.
    expect(main.indexOf('process.env.PORT')).toBeLessThan(main.indexOf('process.env.API_PORT'));
  });

  it('still honours API_PORT, so the systemd deployment is unaffected', () => {
    expect(main).toContain('process.env.API_PORT');
  });
});
