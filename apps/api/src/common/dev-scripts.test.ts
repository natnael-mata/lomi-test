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

  it('leaves no compiled dev script in dist', () => {
    const dist = join(API, 'dist');
    if (!existsSync(dist)) return; // Nothing built yet; the checks above still hold.
    const compiled = files(dist, /^dev-/).map((f) => relative(API, f));
    expect(compiled, `these shipped: ${compiled.join(', ')}`).toEqual([]);
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
