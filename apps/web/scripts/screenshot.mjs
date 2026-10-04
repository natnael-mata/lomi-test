/**
 * One screen, signed in as a seeded persona, captured to a PNG.
 *
 *   node apps/web/scripts/screenshot.mjs <route> <width> <out.png> [persona] [label text to click]
 *
 *   node apps/web/scripts/screenshot.mjs /today 390 today.png userc
 *   node apps/web/scripts/screenshot.mjs /choose 1280 picked.png usera "Grade 6"
 *   node apps/web/scripts/screenshot.mjs /practice 390 answered.png userc "Sensitivity|Check answer"
 *
 * Several controls are pressed in order when separated by "|". A step starting
 * with "css:" is a selector instead of text, for controls whose text varies:
 * "css:[data-label=A]|Check answer" answers whatever question was served.
 *
 * The other scripts here each check one rule across every screen. This is the
 * opposite: one screen, as a picture, for a person to look at. It signs in
 * through the real front door like they do (`tester-session.mjs`), and keeps the
 * token in the system temp directory between runs, because the sign-in limiter
 * reasonably reads a loop of screenshots as an attack and answers 429.
 *
 * The capture is the full page, beyond the viewport. Fixed elements (the bottom
 * bar) are drawn where the viewport's foot was, which is an artefact of the
 * capture and not a layout bug; set VIEWPORT=1 to see them where they sit.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { sessionToken } from './tester-session.mjs';

const [route, width = '390', out, persona = 'usera', clickText] = process.argv.slice(2);
if (!route || !out) {
  console.error('usage: screenshot.mjs <route> <width> <out.png> [persona] [label text to click]');
  process.exit(2);
}

const BASE = process.env.WEB_ORIGIN ?? 'http://localhost:3100';
const API = process.env.API_ORIGIN ?? 'http://localhost:4000';
const PORT = 9333;

const cache = join(tmpdir(), `lomi-screenshot-token-${persona}`);
let token = '';
try {
  token = readFileSync(cache, 'utf8').trim();
} catch {
  // First run for this persona.
}
if (!token) {
  token = await sessionToken(API, persona);
  writeFileSync(cache, token);
}

const profile = mkdtempSync(join(tmpdir(), 'lomi-shot-'));
const chrome = spawn(
  'google-chrome',
  [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${PORT}`,
    `--window-size=${width},1000`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  await wait(2500);
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  let id = 0;
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (pending.has(message.id)) {
      pending.get(message.id)(message.result);
      pending.delete(message.id);
    }
  });
  await new Promise((resolve) => ws.addEventListener('open', resolve));
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const n = ++id;
      pending.set(n, resolve);
      ws.send(JSON.stringify({ id: n, method, params }));
    });

  await send('Network.enable');
  await send('Network.setCookie', {
    name: 'lomi_session',
    value: token,
    domain: new URL(BASE).hostname,
    path: '/',
  });
  await send('Page.enable');
  await send('Page.navigate', { url: `${BASE}${route}` });
  await wait(7000);

  for (const text of clickText ? clickText.split('|') : []) {
    // Presses the first label or button carrying this text, or the input inside
    // it: a radio tile, an answer option, a submit button.
    await send('Runtime.evaluate', {
      expression: text.startsWith('css:')
        ? `document.querySelector(${JSON.stringify(text.slice(4))})?.click()`
        : `(() => {
        const target = [...document.querySelectorAll('label, button')]
          .find((el) => el.textContent.includes(${JSON.stringify(text)}));
        (target?.querySelector('input') ?? target)?.click();
      })()`,
    });
    await wait(2000);
  }

  // VIEWPORT=1 captures only what is on screen, scrolled half way down: the
  // way to see a sticky or fixed element where it really sits, which a full
  // page capture cannot show.
  const viewportOnly = process.env.VIEWPORT === '1';
  if (viewportOnly) {
    await send('Runtime.evaluate', {
      expression: `window.scrollTo(0, document.documentElement.scrollHeight * ${Number(process.env.SCROLL ?? 0.5)})`,
    });
    await wait(800);
  }
  const { data } = await send('Page.captureScreenshot', { captureBeyondViewport: !viewportOnly });
  writeFileSync(out, Buffer.from(data, 'base64'));
  console.log(`wrote ${out}`);
  ws.close();
} finally {
  // Wait for Chrome to actually exit before removing its profile: it keeps
  // writing to it for a moment after the signal, and removing a directory that
  // is still being written to fails with ENOTEMPTY.
  const exited = new Promise((resolve) => chrome.once('exit', resolve));
  chrome.kill();
  await Promise.race([exited, wait(3000)]);
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  } catch {
    // A leftover temp profile is the operating system's to clean up.
  }
}
