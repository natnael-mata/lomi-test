/**
 * Renders the app icons from the mark the product already draws (T-202).
 *
 *   node apps/web/scripts/brand-icons.mjs
 *
 * **Nothing here is a new brand.** It imports `lemon-mark.mjs` — the same paths
 * `components/Logo.tsx` renders on every screen — so the icon on a phone's home
 * screen cannot drift from the one in the navigation. Designing an icon would
 * be somebody else's job; reproducing the existing one at 512px is arithmetic.
 *
 * That import is the fix for how this file spent three weeks broken. It carried
 * its own copy of the design: a hardcoded `#5b4be0` violet and a `@font-face`
 * pointing at an Ethiopic woff2, both left behind by the move to a lemon
 * palette and English-only text. The script could not have run, and nobody
 * noticed, because icons are regenerated about twice a year.
 *
 * Chrome does the rendering because it is the thing on this machine that turns
 * markup into a PNG at an exact pixel size.
 *
 * Two variants per size, and the difference matters on Android:
 *
 * - **any** — the mark filling the square, which is what a browser tab and a
 *   desktop shortcut show.
 * - **maskable** — the same mark at 42% scale on a full-bleed lemon ground, so
 *   a launcher that crops to a circle crops the background rather than the
 *   fruit. Shipping only `any` is how a logo ends up with its corners bitten
 *   off on half the phones in the country.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MARK_COLORS, lemonMarkSvg } from '../components/lemon-mark.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const OUT = join(WEB, 'public', 'brand');

/**
 * From `design-system/tailwind-theme.css`. Not re-picked here.
 *
 * This said `#5b4be0` — brand violet — until 2026-09-01, three weeks after the
 * palette became lemon, alongside a `@font-face` pointing at an Ethiopic woff2
 * deleted with the move to English only. The script could not have run. Icons
 * regenerate rarely enough that stale is the default state unless the mark they
 * draw is the same object the app draws, which it now is.
 */
const GROUND = MARK_COLORS.pith;

const ICONS = [
  { name: 'lomi-exams-192.png', size: 192, maskable: false },
  { name: 'lomi-exams-512.png', size: 512, maskable: false },
  { name: 'lomi-exams-maskable-512.png', size: 512, maskable: true },
  // iOS ignores the manifest and reads this one. 180 is the size it asks for.
  { name: 'lomi-exams-apple-180.png', size: 180, maskable: true },
];

const DEBUG_PORT = 9334;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The mark, as a page exactly `size` square.
 *
 * `maskable` drops the corner radius and shrinks the mark into the safe zone a
 * launcher will not crop — the spec's guidance is that everything inside the
 * middle 80% survives, and 60% leaves room for a circular mask too.
 *
 * **No tile behind it any more.** Every previous mark was a glyph that needed a
 * yellow ground; a slice is already a yellow circle, so a square behind it was
 * a box around a picture of a lemon. The icons are drawn on the pale pith
 * instead, which keeps a light ground for the launchers that want one without
 * boxing the mark.
 */
function page(size, maskable) {
  const radius = maskable ? 0 : Math.round(size * 0.22);
  const glyph = Math.round(size * (maskable ? 0.6 : 0.82));
  return `<!doctype html><meta charset="utf-8"><style>
    html, body { margin: 0; padding: 0; background: transparent; }
    .mark {
      width: ${size}px; height: ${size}px; border-radius: ${radius}px;
      background: ${GROUND};
      display: flex; align-items: center; justify-content: center;
    }
  </style><div class="mark">${lemonMarkSvg({
    size: glyph,
    // Every icon here is 180px or larger, so the centre dot resolves easily.
    // The favicon is the small case and it has its own drawing below.
    centerDot: true,
  })}</div>`;
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

/**
 * The favicon: the slice, with the centre dot dropped.
 *
 * **The whole fruit did not survive a browser tab.** The previous mark was a
 * lemon with leaves and a check through it, and at 16–20px its outline, two
 * nubs and the check were four strokes inside twenty pixels — an audit rendered
 * it at real size and reported "a yellow square with a dark smudge". It needed
 * a second, simpler drawing just for this size.
 *
 * A slice needs no such compromise, which is the quiet argument for it: four
 * solid wedges with a thick pith cross between them is a shape that survives
 * being one twelfth of its design size. Only the 7-unit centre dot goes, since
 * at 16px it is a single pixel sitting where the cross already meets.
 *
 * SVG rather than another PNG: a tab icon is the smallest thing the brand is
 * ever drawn at, and a rasterised 192px square scaled to 16 is where a mark
 * turns to mud. Listed ahead of the PNG in `layout.tsx`, with the PNG left
 * behind it for anything that cannot read SVG.
 */
function faviconSvg() {
  return lemonMarkSvg({ size: 32, centerDot: false });
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  const favicon = join(OUT, 'lomi-favicon.svg');
  writeFileSync(favicon, faviconSvg());
  console.log(`${'lomi-favicon.svg'.padEnd(30)} 32px  slice, no centre dot`);

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
      const html = page(icon.size, icon.maskable);
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
