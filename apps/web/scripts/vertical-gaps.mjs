/**
 * Measures the vertical gaps QA reported as voids (T-268).
 *
 * Two findings from the browser pass were about empty space, which the layout
 * sweep does not look for — it checks sideways scroll, tap targets and contrast,
 * all of which a page with 195px of nothing in the middle passes cleanly:
 *
 *   - "roughly 195px of dead space between the payment block and 'Where you are
 *     signed in'" on `/checkout` (that panel is on Account now; see below)
 *   - "the space between the choices and the next button is big… on some screens
 *     not even displayed unless scrolled" on `/practice`
 *
 * Both were flex containers growing to fill a column rather than sizing to
 * content. This measures the actual rendered gap so the fix is a number rather
 * than an impression, and so the next person changing those containers finds out
 * before a tester does.
 *
 *   node apps/web/scripts/vertical-gaps.mjs [baseUrl]
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { sessionToken } from './tester-session.mjs';

const BASE = process.argv[2] ?? 'http://localhost:3100';
const API = process.env.API_ORIGIN ?? 'http://localhost:4000';
const DEBUG_PORT = 9338;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * How much empty space is too much between two stacked blocks.
 *
 * Generous on purpose: this is looking for a container that grew to fill a
 * viewport, which shows up as a gap in the hundreds of pixels. A threshold
 * tight enough to police ordinary spacing would fail on every design change.
 */
const MAX_GAP_PX = 80;

/** What to measure, and who has to be signed in to see it. */
const CHECKS = [
  {
    name: '/checkout — between the blocks of the checkout',
    as: 'userc',
    path: '/checkout',
    /*
     * The largest gap between any two blocks the checkout stacks.
     *
     * It used to be measured against the device panel below the checkout;
     * that panel moved to Account in the redesign (step 10). The void QA found
     * was never between the two anyway: a grown container pushed its last
     * child, a \`mt-auto\` button, to its own bottom, and the empty space opened
     * above that button, between two siblings inside the checkout. So the
     * checkout's own children are what is measured.
     */
    measure: `(() => {
      const screen = document.querySelector('main')?.firstElementChild;
      if (!screen) return null;
      const rows = [...screen.children].filter((el) => el.getBoundingClientRect().height > 0);
      let worst = 0;
      for (let i = 1; i < rows.length; i++) {
        const gap = rows[i].getBoundingClientRect().top - rows[i - 1].getBoundingClientRect().bottom;
        if (gap > worst) worst = gap;
      }
      return worst;
    })()`,
  },
  {
    name: '/practice — last option to the Check-answer button',
    as: 'userc',
    path: '/practice',
    /*
     * The button is in a sticky footer, so its own rect is where it currently
     * sits rather than where the flow put it. What matters to a reader is the
     * distance from the last option to the top of that footer.
     */
    measure: `(() => {
      const options = document.querySelectorAll('[role="radiogroup"] button[role="radio"]');
      const last = options[options.length - 1];
      const button = document.querySelector('button.btn-primary');
      if (!last || !button) return null;
      return button.getBoundingClientRect().top - last.getBoundingClientRect().bottom;
    })()`,
  },
];

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
      if (message.error) settle.reject(new Error(message.error.message));
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

  close() {
    this.#ws.close();
  }
}

async function main() {
  const profile = mkdtempSync(join(tmpdir(), 'lomi-gaps-'));
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

    /*
     * Tall, and that is the whole point.
     *
     * A `flex-1` container only grows into a void when there is height left
     * over, so at 900px the reported pages fitted and measured clean. QA ran at
     * 1317px and saw ~195px of nothing. Measuring at a short viewport would have
     * reported this fixed while it was not.
     */
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 1400,
      deviceScaleFactor: 1,
      mobile: false,
    });

    for (const check of CHECKS) {
      const token = await sessionToken(API, check.as);
      await cdp.send('Network.setCookie', {
        name: 'lomi_session',
        value: token,
        url: BASE,
        path: '/',
      });

      await cdp.send('Page.navigate', { url: `${BASE}${check.path}` });
      // The screens fetch after mounting; the measurement is meaningless until
      // what they fetched has rendered.
      await sleep(2500);

      const { result } = await cdp.send('Runtime.evaluate', {
        expression: check.measure,
        returnByValue: true,
      });
      const gap = result.value;

      if (gap === null || gap === undefined) {
        console.log(`  ?  ${check.name} — nothing to measure (screen in another state)`);
        continue;
      }
      const rounded = Math.round(gap);
      if (rounded > MAX_GAP_PX) {
        failures.push(`${check.name}: ${rounded}px`);
        console.log(`  ✗  ${check.name} — ${rounded}px`);
      } else {
        console.log(`  ✓  ${check.name} — ${rounded}px`);
      }
    }

    cdp.close();
  } finally {
    chrome.kill();
    await sleep(300);
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      // Chrome writes its profile out asynchronously; a leftover temp directory
      // is not a measurement and must not fail the run.
    }
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} gap(s) over ${MAX_GAP_PX}px:`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
  console.log(`\nNo vertical void over ${MAX_GAP_PX}px.`);
}

await main();
