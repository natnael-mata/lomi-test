/**
 * Tabs through the product with a real keyboard and checks the focus ring
 * (T-199a).
 *
 *   node apps/web/scripts/focus-ring.mjs [baseUrl]
 *
 * **Why this is not a unit test.** DESIGN.md requires a 2px brand outline at 2px
 * offset on every interactive element. That rule is present and exact in the
 * compiled CSS, and `focus-ring.test.ts` asserts nothing cancels it — but
 * neither of those has ever *observed* a focus ring. `:focus-visible` is the
 * problem: it deliberately does not match programmatic focus, so
 * `element.focus()` in jsdom or in a devtools console produces an element that
 * is focused and correctly shows no ring. The only thing that makes it match is
 * a real Tab press.
 *
 * So this drives Chrome over the DevTools Protocol and dispatches genuine key
 * events — `Input.dispatchKeyEvent` produces trusted input, which is what
 * `:focus-visible` is looking for. Node 22 has a global `WebSocket`, so the
 * whole thing needs no dependency.
 *
 * What it checks, per stop:
 *
 * - the element matches `:focus-visible` (the ring is actually on)
 * - `outline-style` is solid, `outline-width` is 2px, `outline-offset` is 2px
 * - the outline colour is the brand colour the theme resolves to *in that
 *   theme* — read from the page rather than hard-coded, because dark mode
 *   re-derives it and a literal would fail on a correct page
 *
 * Exits non-zero and names the element on the first control that is focusable
 * and unringed.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:3100';
const API = process.env.API_ORIGIN ?? 'http://localhost:4000';
const DEV_SECRET = process.env.DEV_LOGIN_SECRET ?? 'lomi-local-testing-secret-000000';

/** Screens, and who has to be signed in to see them. */
const ROUTES = [
  { path: '/practice', as: 'userb', tabs: 12 },
  { path: '/checkout', as: 'userb', tabs: 14 },
  { path: '/choose', as: 'usera', tabs: 12 },
  { path: '/signin', as: null, tabs: 8 },
  { path: '/admin/users', as: 'admin', tabs: 10 },
  { path: '/provider/activity', as: 'provider', tabs: 14 },
  { path: '/admin/review', as: 'admin', tabs: 12 },
];

const DEBUG_PORT = 9333;

/** One CDP connection, with request/response correlation. */
class Cdp {
  #ws;
  #next = 1;
  #pending = new Map();

  static async attach(wsUrl) {
    const cdp = new Cdp();
    cdp.#ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      cdp.#ws.addEventListener('open', resolve, { once: true });
      cdp.#ws.addEventListener('error', reject, { once: true });
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
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * A real Tab.
 *
 * `rawKeyDown` rather than `keyDown`: `keyDown` expects a `text` field and
 * types a character, which in a text input inserts a tab instead of moving
 * focus. The virtual key code is what the browser's focus machinery reads.
 */
async function pressTab(cdp) {
  const key = { windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, key: 'Tab', code: 'Tab' };
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...key });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...key });
  await sleep(40);
}

/** Signs in through the same door the testing screen uses, and returns the cookie. */
async function sessionCookie(label) {
  const response = await fetch(`${API}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: DEV_SECRET, label }),
  });
  if (!response.ok) throw new Error(`dev-login failed for "${label}": ${response.status}`);
  const { token } = await response.json();
  return token;
}

/**
 * What the page says about the element the keyboard has landed on.
 *
 * The brand colour is read out of the document rather than written down here,
 * so the same assertion holds in dark mode, where the theme re-derives it.
 */
const PROBE = `(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  // The dev-tools overlay Next.js injects. It is a focusable custom element in
  // the page and it is not ours to style; failing on it would mean this check
  // can only ever pass against a production build, which is the build where
  // nobody is tabbing around.
  if (el.tagName.toLowerCase() === 'nextjs-portal') return null;
  const style = getComputedStyle(el);
  const brand = getComputedStyle(document.documentElement).getPropertyValue('--color-brand').trim();
  const swatch = document.createElement('span');
  swatch.style.color = brand;
  document.body.appendChild(swatch);
  const brandRgb = getComputedStyle(swatch).color;
  swatch.remove();
  return {
    tag: el.tagName.toLowerCase(),
    label: (el.getAttribute('aria-label') || el.innerText || el.value || '').trim().slice(0, 48),
    visible: el.matches(':focus-visible'),
    width: style.outlineWidth,
    style: style.outlineStyle,
    offset: style.outlineOffset,
    color: style.outlineColor,
    brand: brandRgb,
  };
})()`;

async function main() {
  const profile = mkdtempSync(join(tmpdir(), 'lomi-focus-'));
  const chrome = spawn(
    'google-chrome',
    [
      '--headless=new',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--disable-gpu',
      '--window-size=1280,900',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  const failures = [];
  let checked = 0;

  try {
    // Chrome writes the debugging endpoint when it is ready; poll rather than
    // sleeping a guessed amount.
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

    for (const route of ROUTES) {
      if (route.as) {
        const token = await sessionCookie(route.as);
        await cdp.send('Network.setCookie', {
          name: 'lomi_session',
          value: token,
          url: BASE,
          path: '/',
        });
      }

      await cdp.send('Page.navigate', { url: `${BASE}${route.path}` });
      // Client-rendered screens fetch before they have controls to focus.
      await sleep(2500);
      await cdp.evaluate('document.body.focus(); window.scrollTo(0, 0);');

      const seen = new Set();
      for (let i = 0; i < route.tabs; i++) {
        await pressTab(cdp);
        const probe = await cdp.evaluate(PROBE);
        if (!probe) continue;

        // The browser wraps back into its own UI and returns; stop counting the
        // same control twice rather than reporting inflated coverage.
        const key = `${probe.tag}:${probe.label}`;
        if (seen.has(key)) continue;
        seen.add(key);
        checked++;

        const wrong = [];
        if (!probe.visible) wrong.push('does not match :focus-visible');
        if (probe.style !== 'solid') wrong.push(`outline-style is ${probe.style}`);
        if (probe.width !== '2px') wrong.push(`outline-width is ${probe.width}`);
        if (probe.offset !== '2px') wrong.push(`outline-offset is ${probe.offset}`);
        if (probe.color !== probe.brand) {
          wrong.push(`outline-color is ${probe.color}, brand is ${probe.brand}`);
        }

        const where = `${route.path} → <${probe.tag}> "${probe.label}"`;
        if (wrong.length > 0) failures.push(`${where}: ${wrong.join('; ')}`);
        else console.log(`ok   ${where}`);
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

  if (checked === 0) {
    // A pass over nothing proves nothing, which is the failure mode this whole
    // check exists to escape.
    console.error('\nNo focusable controls were reached. Is the app running?');
    process.exit(1);
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} control(s) without the ring DESIGN.md requires:`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }

  console.log(
    `\n${checked} controls tabbed through with a real keyboard. Every one shows the ring.`,
  );
}

await main();
