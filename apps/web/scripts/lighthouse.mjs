/**
 * The performance gate (T-204).
 *
 *   node apps/web/scripts/lighthouse.mjs [url] [--min=90]
 *
 * Lighthouse's **default preset is the target**: a mid-tier Android, 4× CPU
 * slowdown, ~1.6 Mbps down and 150 ms of latency. That is not a pessimistic
 * setting for this product — it is roughly the phone and the connection this
 * whole design brief is written for, and a desktop score of 100 says nothing
 * about it.
 *
 * The run signs in first when a dev-login secret is available. Measuring
 * `/practice` signed out measures the error card, which paints in half the time
 * and is not the screen anybody uses; the first run of this scored 90 on
 * "That did not load" before anybody noticed.
 *
 * **The binding constraint is LCP, and it is honest.** The largest element is
 * the question stem, and the question cannot be painted before the server has
 * chosen one — roughly 87% of LCP is render delay waiting on that round trip.
 * There is no static hero to preload instead. That is why the gate sits at 90
 * rather than higher: the number is real and there is no cheap headroom above
 * it, so a gate at 95 would only teach people to skip the job.
 */
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--')) ?? 'http://localhost:3200/practice';
const min = Number(args.find((a) => a.startsWith('--min='))?.slice(6) ?? 90);

const API = process.env.API_ORIGIN ?? 'http://localhost:4000';
const SECRET = process.env.DEV_LOGIN_SECRET ?? '';
const LABEL = process.env.LIGHTHOUSE_AS ?? 'userc';

/** A session, if this box has the testing door open. Silent when it does not. */
async function cookie() {
  if (!SECRET) return null;
  try {
    const response = await fetch(`${API}/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: SECRET, label: LABEL }),
    });
    if (!response.ok) return null;
    const { token } = await response.json();
    return `lomi_session=${token}`;
  } catch {
    return null;
  }
}

const session = await cookie();
if (!session) {
  console.warn(
    'No session — measuring signed out. Set DEV_LOGIN_SECRET to measure the real screen.',
  );
}

const lighthouse = spawn(
  'npx',
  [
    '-y',
    'lighthouse@12',
    url,
    '--only-categories=performance',
    '--quiet',
    '--output=json',
    '--output-path=stdout',
    '--chrome-flags=--headless=new --no-sandbox --disable-gpu',
    ...(session ? [`--extra-headers=${JSON.stringify({ Cookie: session })}`] : []),
  ],
  { stdio: ['ignore', 'pipe', 'inherit'] },
);

let json = '';
lighthouse.stdout.on('data', (chunk) => {
  json += chunk;
});

const code = await new Promise((resolve) => lighthouse.on('close', resolve));
if (code !== 0) {
  console.error(`Lighthouse exited ${code}.`);
  process.exit(1);
}

const report = JSON.parse(json);
const score = Math.round(report.categories.performance.score * 100);

const METRICS = [
  'first-contentful-paint',
  'largest-contentful-paint',
  'total-blocking-time',
  'cumulative-layout-shift',
  'speed-index',
];
for (const key of METRICS) {
  const audit = report.audits[key];
  console.log(
    `  ${key.padEnd(26)} ${String(audit.displayValue).padStart(8)}   ${Math.round((audit.score ?? 0) * 100)}`,
  );
}

if (score < min) {
  console.error(`\nperformance ${score} — below the ${min} T-204 requires.`);
  process.exit(1);
}
console.log(`\nperformance ${score} / ${min} required, on Lighthouse's mid-tier mobile preset.`);
