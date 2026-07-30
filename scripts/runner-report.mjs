/**
 * Reports which workspaces actually ran an aggregate root script.
 *
 * `npm run <x> --workspaces --if-present` exits 0 in silence when no workspace
 * defines <x>. For `test` that is dangerous: an empty suite is indistinguishable
 * from a passing one, and TASK.md's baseline rule ("tests green before ticking
 * a task") would be satisfied by nothing at all. This makes the empty case say so.
 */
import { readFileSync } from 'node:fs';

const script = process.argv[2];
if (!script) {
  console.error('usage: node scripts/runner-report.mjs <script-name>');
  process.exit(2);
}

const workspaces = ['api', 'web', 'bot'];
const ran = workspaces.filter((w) => {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL(`../apps/${w}/package.json`, import.meta.url), 'utf8'),
    );
    return Boolean(pkg.scripts?.[script]);
  } catch {
    return false;
  }
});

if (ran.length === 0) {
  console.warn(
    `\n⚠  "${script}" ran in NO workspace — nothing was executed.\n` +
      `   Exit 0 here means "not wired up yet", not "passed".\n`,
  );
} else {
  console.log(`\n"${script}" ran in: ${ran.join(', ')}\n`);
}
