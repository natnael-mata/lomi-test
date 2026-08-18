/**
 * Renders the app icons from the mark the product already draws (T-202).
 *
 *   node apps/web/scripts/brand-icons.mjs
 *
 * **Nothing here is a new brand.** The mark is the one `components/Logo.tsx`
 * renders on every screen — a brand-violet rounded square with `ሎሚ` in Noto
 * Sans Ethiopic — and this draws exactly that at the sizes a phone home screen
 * needs. Designing an icon would be somebody else's job; reproducing the
 * existing one at 512px is arithmetic.
 *
 * Chrome does the rendering, because it is the only thing on this machine that
 * can lay out a Ge'ez glyph in a specific font and turn it into a PNG. The font
 * is the repo's own committed woff2, read off disk and inlined, so the icon
 * cannot come out in a substitute face on a machine that happens to lack it —
 * which is the failure that produces an icon nobody notices is wrong.
 *
 * Two variants per size, and the difference matters on Android:
 *
 * - **any** — the mark filling the square, which is what a browser tab and a
 *   desktop shortcut show.
 * - **maskable** — the same mark at 60% scale on a full-bleed violet ground, so
 *   a launcher that crops to a circle crops the background rather than the
 *   glyph. Shipping only `any` is how a logo ends up with its corners bitten
 *   off on half the phones in the country.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const OUT = join(WEB, 'public', 'brand');
const FONT = join(WEB, 'app', 'fonts', 'noto-sans-ethiopic-variable.woff2');

/** From `design-system/tailwind-theme.css`. Not re-picked here. */
const BRAND = '#5b4be0';
const ON_BRAND = '#ffffff';

const ICONS = [
  { name: 'lomi-test-192.png', size: 192, maskable: false },
  { name: 'lomi-test-512.png', size: 512, maskable: false },
  { name: 'lomi-test-maskable-512.png', size: 512, maskable: true },
  // iOS ignores the manifest and reads this one. 180 is the size it asks for.
  { name: 'lomi-test-apple-180.png', size: 180, maskable: true },
];

const DEBUG_PORT = 9334;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The mark, as a page exactly `size` square.
 *
 * `maskable` drops the corner radius and shrinks the glyph into the safe zone
 * a launcher will not crop — the spec's guidance is that everything inside the
 * middle 80% survives, and 60% leaves room for a circular mask too.
 */
function page(size, maskable, fontData) {
  const radius = maskable ? 0 : Math.round(size * 0.22);
  const glyph = Math.round(size * (maskable ? 0.42 : 0.44));
  return `<!doctype html><meta charset="utf-8"><style>
    @font-face { font-family: 'Ethiopic'; src: url(data:font/woff2;base64,${fontData}) format('woff2'); font-weight: 100 900; }
    html, body { margin: 0; padding: 0; background: transparent; }
    .mark {
      width: ${size}px; height: ${size}px; border-radius: ${radius}px;
      background: ${BRAND}; color: ${ON_BRAND};
      display: flex; align-items: center; justify-content: center;
      font-family: 'Ethiopic'; font-weight: 600; font-size: ${glyph}px;
      line-height: 1;
    }
  </style><div class="mark">ሎሚ</div>`;
}

class Cdp {
  #ws;
  #next = 1;
  #pending = new Map();

  static async attach(wsUrl) {
    const cdp = new Cdp();
    cdp.#ws = new WebSocket(wsUrl);
    await new Promise((resolve_, reject) => {
      cdp.#ws.addEventListener('open', resolve_, { once: true });
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
    return new Promise((resolve_, reject) => {
      this.#pending.set(id, { resolve: resolve_, reject });
      this.#ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.#ws.close();
  }
}

async function main() {
  const fontData = readFileSync(FONT).toString('base64');
  mkdirSync(OUT, { recursive: true });

  const profile = mkdtempSync(join(tmpdir(), 'lomi-icons-'));
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

    for (const icon of ICONS) {
      const html = page(icon.size, icon.maskable, fontData);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: icon.size,
        height: icon.size,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await cdp.send('Page.navigate', {
        url: `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
      });
      // The inlined face still has to be decoded before it can be drawn, and a
      // screenshot taken a frame early gets the fallback glyph.
      await sleep(700);

      const { data } = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      });
      const bytes = Buffer.from(data, 'base64');
      writeFileSync(join(OUT, icon.name), bytes);
      console.log(`${icon.name.padEnd(30)} ${icon.size}px  ${bytes.length} bytes`);
    }

    cdp.close();
  } finally {
    // Wait for Chrome to actually exit before removing its profile: killing and
    // deleting in the same tick races its own shutdown writes and throws
    // ENOTEMPTY after the icons are already on disk, which reads as a failure
    // when nothing failed.
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

  console.log(`\nWritten to ${OUT}. Committed, so a build never depends on Chrome.`);
}

await main();
