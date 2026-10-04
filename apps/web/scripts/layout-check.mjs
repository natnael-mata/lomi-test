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

import { sessionToken as signIn } from './tester-session.mjs';

const BASE = process.argv[2] ?? 'http://localhost:3100';
const API = process.env.API_ORIGIN ?? 'http://localhost:4000';

/** Every screen, and who has to be signed in to see it. */
const ROUTES = [
  { path: '/', as: 'userc' },
  // The signed-in hub, which is a different page from `/` and was not measured
  // at all until it started carrying per-student state.
  { path: '/today', as: 'userc' },
  { path: '/practice', as: 'userc' },
  { path: '/community', as: 'userc' },
  { path: '/exam', as: 'userc' },
  // The list of papers (redesign step 8), which replaced a redirect.
  { path: '/mocks', as: 'userc' },
  // The account, which replaced a redirect to checkout (redesign step 10).
  { path: '/account', as: 'userc' },
  /*
   * A paper read back after the fact.
   *
   * The id is resolved at run time from User G's own finished sitting, because
   * hard-coding one would pass until the next re-seed and then quietly measure
   * an error page instead of the screen. `resolve` returning null skips the
   * route rather than failing the sweep — a machine with no seeded data should
   * not report a layout fault.
   */
  {
    path: null,
    as: 'userg',
    resolve: async (token) => {
      const auth = { Authorization: `Bearer ${token}` };
      const fields = await fetch(`${API}/me/fields`, { headers: auth });
      if (!fields.ok) return null;
      const chosen = (await fields.json()).find((f) => f.chosen);
      if (!chosen) return null;

      const trend = await fetch(`${API}/me/trend/${chosen.id}`, { headers: auth });
      if (!trend.ok) return null;
      const points = await trend.json();
      const sitting = points[points.length - 1]?.sittingId ?? null;
      return sitting ? `/exam/review/${sitting}` : null;
    },
  },
  { path: '/progress', as: 'userc' },
  { path: '/standing', as: 'userc' },
  { path: '/checkout', as: 'userc' },
  // The same address as somebody who has not paid: the plans, the ways to pay
  // and the summary. User C has paid and only ever sees the receipt, so the
  // page most students meet was never measured.
  { path: '/checkout', as: 'usera' },
  { path: '/choose', as: 'usera' },
  { path: '/signin', as: null },
  // The two halves of the auth flow. Signed out, like the students who use them.
  { path: '/signup', as: null },
  { path: '/reset', as: null },
  { path: '/dev-login', as: null },
  { path: '/admin/dashboard', as: 'admin' },
  { path: '/admin/payments', as: 'admin' },
  { path: '/admin/users', as: 'admin' },
  { path: '/admin/community', as: 'admin' },
  { path: '/admin/import', as: 'admin' },
  { path: '/admin/weights', as: 'admin' },
  { path: '/admin/review', as: 'admin' },
  { path: '/provider/activity', as: 'provider' },
  { path: '/provider/health', as: 'provider' },
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

/** Signs in as a persona through the real front door. See `tester-session.mjs`. */
const sessionToken = (label) => signIn(API, label);

const AUDIT = `(() => {
  const problems = [];
  const name = (el) =>
    \`<\${el.tagName.toLowerCase()}\${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''}>\` +
    (el.innerText ? \` "\${el.innerText.trim().slice(0, 32)}"\` : '');

  /*
   * 1 — the page never moves sideways.
   *
   * Measured against the **emulated device width**, not \`window.innerWidth\`.
   * Under mobile emulation Chrome applies shrink-to-fit: a 900px box in a 375px
   * device makes \`innerWidth\` report 901, so \`scrollWidth > innerWidth\` is
   * false and the rule silently cannot fire — which is exactly what it did here
   * until the self-test tripped over it. The desktop and tablet passes were
   * fine; the phone pass, the one that matters, was inert.
   */
  const viewport = window.__lomiViewport ?? window.innerWidth;
  const doc = document.documentElement;
  if (doc.scrollWidth > viewport + 1) {
    // Name the widest thing that sticks out, or the report is unactionable.
    let worst = null;
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      const over = r.right - viewport;
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
  //
  // **The LARGER of the two, not the label unconditionally.** The label rule was
  // written for a control smaller than its row, and silently inverted on the
  // opposite case: sign-in's "Forgot your password?" sits inside the password
  // field's 28px label and overflows it with negative margins, so the link is a
  // real 44px target and this reported 28px three times over. Taking the max
  // keeps the radio-in-a-row case and stops a small label shrinking a big
  // control.
  const targetHeight = (el) => {
    const own = el.getBoundingClientRect().height;
    const label = el.closest('label');
    return label ? Math.max(own, label.getBoundingClientRect().height) : own;
  };

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

  /*
   * 4b. The question stem is the largest text on the screen.
   *
   * DESIGN.md's Stem Supremacy Rule: "On any practice or exam screen the
   * question stem is the largest type present. Not the timer, not the score,
   * not the streak, not the brand." Stated three times, enforced nowhere, and
   * the redesign handoff breaks it on its own practice screen ("Question 16" at
   * 24px over a 17 to 20px stem). Measured rather than read from classes: the
   * sizes that matter are the rendered ones, after clamp() and the viewport.
   */
  const stem = document.querySelector('[data-stem]');
  if (stem) {
    const stemSize = parseFloat(getComputedStyle(stem).fontSize);
    for (const el of document.querySelectorAll('body *')) {
      if (el === stem || stem.contains(el)) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!hasText) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const size = parseFloat(style.fontSize);
      if (size > stemSize) {
        problems.push(\`\${size}px text larger than the \${stemSize}px stem: \${name(el)}\`);
      }
    }
  }

  /*
   * 5 — every piece of text is readable against what is actually behind it.
   *
   * \`contrast.test.ts\` already audits the *tokens*, and that is the right place
   * for "is Pending readable on Surface". What it cannot see is the pairs the
   * screens actually produce: a caption in Ink-2 inside a Surface-2 well inside
   * a card, an amber chip on a tinted row, white on Correct green. Those are
   * compositions, and they only exist once something has rendered.
   *
   * WCAG AA: 4.5:1 for body text, 3:1 for large text. Disabled controls are
   * exempt by the standard and exempt here — a disabled button is deliberately
   * quiet, and failing it would push somebody to make "unavailable" look
   * available.
   */
  const rgb = (value) => {
    const m = value.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const parts = m[1].split(',').map((n) => parseFloat(n));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };

  const luminance = ({ r, g, b }) => {
    const channel = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };

  const ratio = (fg, bg) => {
    const a = luminance(fg) + 0.05;
    const b = luminance(bg) + 0.05;
    return a > b ? a / b : b / a;
  };

  /** The first ancestor that actually paints something. */
  const behind = (el) => {
    for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
      const colour = rgb(getComputedStyle(node).backgroundColor);
      if (colour && colour.a > 0.99) return colour;
    }
    return (
      rgb(getComputedStyle(document.documentElement).backgroundColor) ?? { r: 255, g: 255, b: 255, a: 1 }
    );
  };

  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('[disabled], [aria-disabled="true"]')) continue;
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!hasText) continue;

    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;

    const fg = rgb(style.color);
    if (!fg || fg.a < 0.99) continue;
    const bg = behind(el);
    const size = parseFloat(style.fontSize);
    const bold = parseInt(style.fontWeight, 10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    const got = ratio(fg, bg);

    if (got < need) {
      problems.push(
        \`contrast \${got.toFixed(2)}:1 needs \${need}:1 — \${style.color} on rgb(\${bg.r}, \${bg.g}, \${bg.b}): \${name(el)}\`,
      );
    }
  }

  return problems;
})()`;

/**
 * The guard on the guard.
 *
 * A sweep that reports nothing is either a clean product or a broken sweep, and
 * only one of those is good news — this repository has shipped both. So before
 * auditing anything real, put four deliberately wrong things on a blank page and
 * insist each is caught: an element wider than the viewport, a card inside a
 * card, a 20px button, and grey-on-grey text.
 *
 * It runs against `about:blank` with the rules inlined, so it needs neither the
 * app nor a stylesheet.
 */
async function selfTest(cdp) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 700,
    deviceScaleFactor: 1,
    mobile: true,
  });
  /*
   * A whole page rather than markup injected into `about:blank`.
   *
   * The viewport meta has to be present *when the page loads*: without it,
   * mobile emulation lays out at 980px and a 900px box fits comfortably, so the
   * sideways-scroll rule cannot fire against the fixture written to trip it —
   * about:blank behaving normally, reported as the rule being broken.
   */
  const fixture =
    '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<body style="margin:0;background:#ffffff">' +
    '<div style="width:900px">wide</div>' +
    '<div class="card"><div class="card">nested</div></div>' +
    '<button style="display:block;height:20px">short</button>' +
    '<p style="color:#bbbbbb;background:#ffffff;font-size:16px">faint text here</p>';

  await cdp.send('Page.navigate', {
    url: `data:text/html;charset=utf-8,${encodeURIComponent(fixture)}`,
  });
  await sleep(400);

  const found = await cdp.evaluate(`(() => { window.__lomiViewport = 375; return ${AUDIT}; })()`);

  const wanted = ['scrolls sideways', 'nested card', 'under 44', 'contrast'];
  const missed = wanted.filter((w) => !found.some((f) => f.includes(w)));
  if (missed.length > 0) {
    console.error(`The audit itself is broken — it did not catch: ${missed.join(', ')}`);
    console.error(`It reported: ${found.join(' | ') || '(nothing)'}`);
    process.exit(1);
  }
}

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

    await selfTest(cdp);

    /*
     * One theme, so the sweep runs once (owner, 2026-08-20).
     *
     * This looped over light and dark and emulated `prefers-color-scheme` for
     * each. Lomi v1 has no dark counterpart — the contrast audit covers the one
     * palette against the stylesheet, and emulating a scheme the theme does not
     * answer to would have doubled the run to re-measure identical pages.
     *
     * The emulation is still set, explicitly to light, rather than left to
     * whatever the machine running this happens to prefer: an unpinned sweep is
     * one that reports different results on two laptops.
     */
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'light' }],
    });

    {
      /** Routes whose URL could not be resolved from seeded data. */
      const skipped = [];
      for (const route of ROUTES) {
        let token = null;
        if (route.as) {
          token = await sessionToken(route.as);
          await cdp.send('Network.setCookie', {
            name: 'lomi_session',
            value: token,
            url: BASE,
            path: '/',
          });
        }

        // Routes whose URL depends on seeded data work it out now, with a
        // session in hand. A null means "nothing to measure here", not a fault.
        const path = route.path ?? (route.resolve ? await route.resolve(token) : null);
        if (path === null) {
          skipped.push(route.as ?? 'anonymous');
          continue;
        }

        for (const size of WIDTHS) {
          await cdp.send('Emulation.setDeviceMetricsOverride', {
            width: size.width,
            height: size.height,
            deviceScaleFactor: 1,
            mobile: size.name === 'phone',
          });
          await cdp.send('Page.navigate', { url: `${BASE}${path}` });
          await sleep(2200);

          const problems = await cdp.evaluate(
            `(() => { window.__lomiViewport = ${size.width}; return ${AUDIT}; })()`,
          );
          screens++;
          const where = `${path} · ${size.name}`;
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
    `${screens} screens audited — no sideways scroll, no nested cards, no control under 44px, nothing larger than a question stem, ` +
      'nothing under 11px, and every piece of text at AA contrast against what is behind it.',
  );
}

await main();
