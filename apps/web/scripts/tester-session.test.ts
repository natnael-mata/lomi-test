/**
 * The design checkers sign in as the seeded testers, and the door is gone.
 *
 * `tester-session.mjs` derives each tester's phone from the same reserved id
 * range `dev:testers` uses. This was kept in step by the `/dev-login` page's
 * contract test; that page was removed before the first redesigned deploy, so
 * the check lives here, next to the script it protects.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const REPO = resolve(WEB, '../..');

const api = readFileSync(join(REPO, 'apps/api/src/auth/dev-login.ts'), 'utf8');
const script = readFileSync(join(HERE, 'tester-session.mjs'), 'utf8');

const constant = (source: string, name: string): number =>
  Number(new RegExp(`${name} = (-?[\\d_]+)`).exec(source)![1]!.replace(/_/g, ''));

describe('the checkers sign in as the accounts dev:testers seeds', () => {
  it('reads the same reserved id range as the API', () => {
    for (const name of ['DEV_TELEGRAM_ID_FLOOR', 'DEV_TELEGRAM_ID_CEILING']) {
      expect(constant(script, name), name).toBe(constant(api, name));
    }
  });
});

/**
 * The tester sign-in page is gone and stays gone.
 *
 * It was a page in the production build that listed the tester accounts with
 * their shared password filled in. The password is in this repository, so on
 * any server where `dev:testers` had ever run, the page was a way in as every
 * tester, the admin one included.
 */
describe('no tester sign-in door ships', () => {
  it('has no /dev-login route', () => {
    expect(existsSync(join(WEB, 'app/dev-login'))).toBe(false);
  });

  it('keeps the tester password out of everything that is built', () => {
    const password = /TEST_PASSWORD = process\.env\.DEV_TESTER_PASSWORD \?\? '([^']+)'/.exec(
      script,
    )![1]!;
    const hits = execSync(
      `grep -rl --include=*.ts --include=*.tsx ${JSON.stringify(password)} app components lib || true`,
      { cwd: WEB, encoding: 'utf8' },
    ).trim();
    expect(hits, `the tester password appears in shipped code:\n${hits}`).toBe('');
  });
});
