/**
 * Holds every screen to the layout rules DESIGN.md states (T-095, T-200).
 *
 *   node apps/web/scripts/layout-check.mjs [baseUrl]
 *
 * **Why a browser and not a test.** Every rule below is about *computed* layout:
 * whether a page overflows at 375px, whether a card ended up inside another
 * card, how tall a control actually renders. None of that is visible in the
 * source, and jsdom has no layout engine — `getBoundingClientRect()` returns
 * zeroes there, so a jsdom assertion about height passes on every page ever
 * written.
 *
 * The rules, quoted from DESIGN.md:
 *
 * - *"Wide content — tables, code — scrolls inside its own container so the page
 *   never moves sideways."* A page that scrolls horizontally on a 375px phone is
 *   a page where half of every question is off the edge.
 * - *"cards are never nested."* A card inside a card destroys the one thing the
 *   pattern buys: a stressed reader seeing where one idea ends.
 * - *"Touch targets are ≥44px."* Checked on block-level controls only —
 *   a link inside a sentence is a target the size of the words, and always has
 *   been.
 * - **No text below 11px.** The smallest size in the type scale is the bottom
 *   bar's label; anything under it is a size nobody chose.
 *
 * Checked at three widths and in both themes, because the redesign moved the
 * shell under screens it did not rewrite — and a rail that takes 232px from a
 * 1280px viewport is a different amount of room than the one those screens were
 * built in.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:3100';
const API = process.env.API_ORIGIN ?? 'http://localhost:4000';
const SECRET = process.env.DEV_LOGIN_SECRET ?? 'lomi-local-testing-secret-000000';

/** Every screen, and who has to be signed in to see it. */
const ROUTES = [
  { path: '/', as: 'userc' },
  { path: '/practice', as: 'userc' },
  { path: '/exam', as: 'userc' },
  { path: '/progress', as: 'userc' },
  { path: '/standing', as: 'userc' },
  { path: '/checkout', as: 'userc' },
  { path: '/choose', as: 'usera' },
  { path: '/signin', as: null },
  { path: '/dev-login', as: null },
  { path: '/admin/dashboard', as: 'admin' },
  { path: '/admin/payments', as: 'admin' },
  { path: '/admin/users', as: 'admin' },
  { path: '/admin/import', as: 'admin' },
  { path: '/admin/weights', as: 'admin' },
];

/** Phone, tablet, desktop — the three the navigation has shapes for. */
const WIDTHS = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 834, height: 1024 },
  { name: 'desktop', width: 1280, height: 860 },
];

const DEBUG_PORT = 9336;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  #ws;
  #next = 1;
  #pending = new Map();

  static async attach(wsUrl) {
    const cdp = new Cdp();
    cdp.#ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      cdp.#ws.addEventListener('open', res, { once: true });
      cdp.#ws.addEventListener('error', rej, { once: true });
    });
    cdp.#ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      const settle = cdp.#pending.get(message.id);
      if (!settle) return;
      cdp.#pending.delete(message.id);
      if (message.error) settle.reject(new Error(JSON.stringify(message.error)));
      else settle.resolve(message.result);
    });
    return cdp;
  }

  send(method, params = {}) {
    const id = this.#next++;
    return new Promise((res, rej) => {
      this.#pending.set(id, { resolve: res, reject: rej });
      this.#ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const { result, exceptionDetails } = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.text ?? 'evaluate failed');
    return result.value;
  }

  close() {
    this.#ws.close();
  }
}

async function sessionToken(label) {
  const response = await fetch(`${API}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: SECRET, label }),
  });
  if (!response.ok) throw new Error(`dev-login failed for "${label}": ${response.status}`);
  return (await response.json()).token;
}

const AUDIT = `(() => {
  const problems = [];
  const name = (el) =>
    \`<\${el.tagName.toLowerCase()}\${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''}>\` +
    (el.innerText ? \` "\${el.innerText.trim().slice(0, 32)}"\` : '');

  // 1 — the page never moves sideways.
  const doc = document.documentElement;
  if (doc.scrollWidth > window.innerWidth + 1) {
    // Name the widest thing that sticks out, or the report is unactionable.
    let worst = null;
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      const over = r.right - window.innerWidth;
      if (over > 1 && (!worst || over > worst.over)) worst = { el, over: Math.round(over) };
    }
    problems.push(
      \`page scrolls sideways: \${doc.scrollWidth}px in \${window.innerWidth}px\` +
        (worst ? \` — widest overflow \${worst.over}px from \${name(worst.el)}\` : ''),
    );
  }

  // 2 — cards are never nested.
  for (const el of document.querySelectorAll('.card .card')) {
    problems.push(\`nested card: \${name(el)}\`);
  }

  // 3 — block-level controls are at least 44px tall.
  //
  // A control wrapped in a label takes the label's size. DESIGN.md says answer
  // rows are "full-width with the entire row as the target", and the native
  // radio inside one is a 13px dot on a 56px row — measuring the dot reports a
  // failure against the pattern the document asks for.
  const targetHeight = (el) => (el.closest('label') ?? el).getBoundingClientRect().height;

  for (const el of document.querySelectorAll('button, a, [role="radio"], input:not([type="hidden"])')) {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    if (style.display === 'inline') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const height = targetHeight(el);
    if (height < 44) problems.push(\`\${Math.round(height)}px tall, under 44: \${name(el)}\`);
  }

  // 4 — nothing smaller than the smallest size in the scale.
  for (const el of document.querySelectorAll('body *')) {
    if (!el.childNodes.length) continue;
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!hasText) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size && size < 11) problems.push(\`\${size}px text: \${name(el)}\`);
  }

  return problems;
})()`;

async function main() {
  const profile = mkdtempSync(join(tmpdir(), 'lomi-layout-'));
  const chrome = spawn(
    'google-chrome',
    [
      '--headless=new',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--disable-gpu',
      '--hide-scrollbars',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  const failures = [];
  let screens = 0;

  try {
    let target = null;
    for (let i = 0; i < 60 && !target; i++) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
        target = list.find((t) => t.type === 'page');
      } catch {
        await sleep(250);
      }
    }
    if (!target) throw new Error('Chrome did not open a debugging port.');

    const cdp = await Cdp.attach(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');

    for (const theme of ['light', 'dark']) {
      await cdp.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-color-scheme', value: theme }],
      });

      for (const route of ROUTES) {
        if (route.as) {
          await cdp.send('Network.setCookie', {
            name: 'lomi_session',
            value: await sessionToken(route.as),
            url: BASE,
            path: '/',
          });
        }

        for (const size of WIDTHS) {
          await cdp.send('Emulation.setDeviceMetricsOverride', {
            width: size.width,
            height: size.height,
            deviceScaleFactor: 1,
            mobile: size.name === 'phone',
          });
          await cdp.send('Page.navigate', { url: `${BASE}${route.path}` });
          await sleep(2200);

          const problems = await cdp.evaluate(AUDIT);
          screens++;
          const where = `${route.path} · ${size.name} · ${theme}`;
          if (problems.length === 0) continue;
          for (const problem of problems) failures.push(`${where}: ${problem}`);
        }
      }
    }

    cdp.close();
  } finally {
    chrome.kill();
    await new Promise((done) => chrome.once('exit', done));
    // Best effort. Chrome can still be flushing its profile when it reports
    // exit, and an ENOTEMPTY on a temp directory is not a reason to fail an
    // audit whose findings are already computed — a check that fails for
    // reasons unrelated to what it checks is a check people learn to ignore.
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      /* the OS will clear it */
    }
  }

  if (screens === 0) {
    console.error('Nothing was audited. Is the app running?');
    process.exit(1);
  }

  if (failures.length > 0) {
    console.error(`${failures.length} problem(s) across ${screens} screens:\n`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log(
    `${screens} screens audited — no sideways scroll, no nested cards, no small targets.`,
  );
}

await main();
