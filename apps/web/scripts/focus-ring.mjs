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
 * - **the outline can actually be seen**: at least 3:1 against whatever is
 *   behind it, which is WCAG 2.2's non-text minimum
 *
 * That last one used to read "the outline colour is the brand colour", and that
 * is the assertion this file exists as a warning about. It passed all 55
 * controls at the moment the brand became a lemon that measures 1.00:1 against
 * a lemon button — a keyboard user had no focus indicator on the primary action
 * of every screen, and the check reported every one of them green, because
 * matching a token is not the same as being visible. Identity is cheap to
 * assert and says nothing. Contrast is the property anybody actually needs.
 *
 * Exits non-zero and names the element on the first control that is focusable
 * and unringed.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { sessionToken as signIn } from './tester-session.mjs';

const BASE = process.argv[2] ?? 'http://localhost:3100';
const API = process.env.API_ORIGIN ?? 'http://localhost:4000';

/** Screens, and who has to be signed in to see them. */
const ROUTES = [
  { path: '/practice', as: 'userb', tabs: 12 },
  { path: '/checkout', as: 'userb', tabs: 14 },
  { path: '/choose', as: 'usera', tabs: 12 },
  { path: '/signin', as: null, tabs: 8 },
  { path: '/admin/users', as: 'admin', tabs: 10 },
  { path: '/provider/activity', as: 'provider', tabs: 14 },
  { path: '/admin/review', as: 'admin', tabs: 12 },
  /*
   * The dark surfaces the redesign added, where the ink ring was 1.22:1 until
   * `.on-deep` turned it to the lemon: the landing's hero calls to action and
   * the Mocks card's start button.
   */
  { path: '/', as: null, tabs: 4 },
  { path: '/mocks', as: 'userc', tabs: 9 },
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

/** Signs in as a persona through the real front door. See `tester-session.mjs`. */
const sessionCookie = (label) => signIn(API, label);

/**
 * What the page says about the element the keyboard has landed on.
 *
 * The brand colour is read out of the document rather than written down here,
 * so the assertion follows the token rather than restating it.
 */
const PROBE = `(() => {
  /** sRGB relative luminance, per WCAG. */
  const lum = (rgb) => {
    const [r, g, b] = rgb.match(/\\d+(\\.\\d+)?/g).slice(0, 3).map(Number).map((c) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  /*
   * What is actually behind the ring.
   *
   * The outline sits OUTSIDE the element at a 2px offset, so the relevant
   * backdrop is usually the ancestor's background — but on a filled control the
   * ring also runs along its own edge. Both are measured and the worst is kept:
   * a ring that disappears against either is a ring somebody cannot follow.
   */
  /*
   * An OFFSET outline is drawn outside the element, on whatever is behind it —
   * so the element's own fill is not what it has to contrast against.
   *
   * This measured both and kept the worst, which was harmless while the primary
   * button was a pale lemon and became a false failure the moment it turned
   * ink: a correct ink ring, sitting on cream two pixels clear of the button,
   * was scored against the button fill it never touches. The element's own
   * background is only relevant when the offset is zero or negative, which is
   * the case where the ring really does sit on the control.
   */
  const backdropOf = (node) => {
    for (let n = node; n; n = n.parentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && bg !== 'transparent' && !/rgba\\(0,\\s*0,\\s*0,\\s*0\\)/.test(bg)) return bg;
    }
    return getComputedStyle(document.body).backgroundColor || 'rgb(255, 255, 255)';
  };

  const el = document.activeElement;
  if (!el || el === document.body) return null;
  // The dev-tools overlay Next.js injects. It is a focusable custom element in
  // the page and it is not ours to style; failing on it would mean this check
  // can only ever pass against a production build, which is the build where
  // nobody is tabbing around.
  if (el.tagName.toLowerCase() === 'nextjs-portal') return null;
  const style = getComputedStyle(el);
  const own = getComputedStyle(el).backgroundColor;
  const behind = backdropOf(el.parentElement ?? el);
  /*
   * An OFFSET outline is drawn outside the element, on whatever is behind it,
   * so the control's own fill is not what it contrasts against.
   *
   * Measuring both and keeping the worst was harmless while the primary button
   * was a pale lemon, and became a false failure the moment the redesign made
   * it ink: a correct ink ring sitting on cream two pixels clear of the button
   * was scored against a fill it never touches. The element's own background
   * matters only at zero or negative offset, where the ring really does lie on
   * the control.
   */
  const offset = parseFloat(style.outlineOffset) || 0;
  const against = [behind];
  if (offset <= 0 && own && own !== 'transparent' && !/rgba\\(0,\\s*0,\\s*0,\\s*0\\)/.test(own)) {
    against.push(own);
  }
  const ratios = against.map((bg) => ({ bg, ratio: ratio(style.outlineColor, bg) }));
  const worst = ratios.reduce((a, b) => (a.ratio <= b.ratio ? a : b));
  return {
    tag: el.tagName.toLowerCase(),
    label: (el.getAttribute('aria-label') || el.innerText || el.value || '').trim().slice(0, 48),
    visible: el.matches(':focus-visible'),
    width: style.outlineWidth,
    style: style.outlineStyle,
    offset: style.outlineOffset,
    color: style.outlineColor,
    against: worst.bg,
    contrast: Math.round(worst.ratio * 100) / 100,
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
        // 3:1 is WCAG 2.2's non-text contrast minimum, and the number that
        // would have caught a lemon ring on a lemon button.
        if (probe.contrast < 3) {
          wrong.push(
            `outline ${probe.color} on ${probe.against} is ${probe.contrast}:1, needs 3:1`,
          );
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
