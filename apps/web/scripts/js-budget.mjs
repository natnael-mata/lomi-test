/**
 * First-load JavaScript budget (T-203).
 *
 * The device this is read on is a low-end Android over 3G. Every kilobyte of
 * JavaScript is parsed and executed before a student can answer anything, and
 * unlike an image it cannot be deferred or degraded — it is the one asset whose
 * cost is paid in full before the page is usable.
 *
 * **Measured gzipped, from the build manifest, not from the build's own
 * summary.** Next prints a "First Load JS" figure, but parsing console output
 * means a formatting change silently disables the budget. The manifest lists the
 * exact chunks a route loads, so this measures the same thing the browser
 * downloads.
 *
 * Run after `npm run build -w web`:
 *
 *   node apps/web/scripts/js-budget.mjs
 *
 * Exits non-zero when a route is over, so CI fails on the commit that did it
 * rather than three weeks later when somebody notices the app is slow.
 */
import { gzipSync } from 'node:zlib';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = join(WEB, '.next-build');

/**
 * The budget, in gzipped kilobytes of first-load JavaScript.
 *
 * `/practice` is the one T-203 names, and it is the right one to pin: it is
 * where a student spends their time and the route they open on a bad
 * connection. The others are listed so a regression anywhere is visible, at a
 * looser ceiling — `/design` is a developer surface and `/exam` legitimately
 * carries more, so holding them to the practice budget would either fail
 * honestly or force the number up for everybody.
 */
const BUDGETS = {
  '/practice/page': 300,
  '/page': 300,
  '/exam/page': 340,
  '/progress/page': 320,
  '/admin/weights/page': 340,
};

function gzippedKb(files) {
  const unique = [...new Set(files)];
  let bytes = 0;
  for (const file of unique) {
    const full = join(BUILD, file);
    if (!existsSync(full) || !statSync(full).isFile()) continue;
    bytes += gzipSync(readFileSync(full)).length;
  }
  return bytes / 1024;
}

function main() {
  if (!existsSync(BUILD)) {
    console.error('No build found. Run `npm run build -w web` first.');
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(join(BUILD, 'app-build-manifest.json'), 'utf8'));
  // The layout's chunks load on every route, so they count toward each one —
  // that is what "first load" means to a student arriving cold.
  const shared = manifest.pages['/layout'] ?? [];

  const rows = [];
  let over = 0;

  for (const [route, budgetKb] of Object.entries(BUDGETS)) {
    const files = manifest.pages[route];
    if (!files) {
      console.error(`${route} is not in the build manifest — did the route move?`);
      process.exit(1);
    }
    const kb = gzippedKb([...shared, ...files]);
    const ok = kb <= budgetKb;
    if (!ok) over += 1;
    rows.push({ route, kb: kb.toFixed(1), budgetKb, ok });
  }

  const width = Math.max(...rows.map((r) => r.route.length));
  for (const row of rows) {
    console.log(
      `${row.ok ? 'ok  ' : 'OVER'} ${row.route.padEnd(width)}  ${row.kb} KB / ${row.budgetKb} KB gzipped`,
    );
  }

  if (over > 0) {
    console.error(
      `\n${over} route(s) over budget. First-load JS is paid in full before a student can ` +
        `answer anything, on a phone that cannot afford it.`,
    );
    process.exit(1);
  }
}

main();
