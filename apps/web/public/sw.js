/*
 * The offline shell (T-202).
 *
 * **What this deliberately does not do is cache content.** The question bank is
 * the product's only asset, and a service worker that keeps questions and their
 * explanations for offline reading is a copy of the bank sitting on a device,
 * readable with devtools and survivable across a cancelled subscription. T-205
 * refuses to make content printable for the same reason; making it cacheable
 * would undo that quietly.
 *
 * So the rule is narrow and stated as a whitelist rather than as a set of
 * exclusions — an exclusion list is one forgotten path away from caching the
 * thing it was written to protect:
 *
 * - `/_next/static/*` and the fonts are **cache-first**. They are content-hashed
 *   and immutable, they are most of the bytes, and serving them from disk is
 *   what makes a second visit fast on a metered connection.
 * - Everything else is **network-only**. Every API call, every page.
 * - A navigation that fails with no network falls back to `/offline.html`, which
 *   says what happened and carries no question text.
 *
 * The practical effect: installed, the app opens and says it needs a connection
 * rather than showing a browser error page. It does not pretend to work offline,
 * because it cannot — the questions come from the server, by design.
 */

const VERSION = 'lomi-v1';
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll([OFFLINE_URL])),
  );
  // Take over on the next load rather than waiting for every tab to close: a
  // student with the app open for an hour should not be running last week's
  // worker.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Immutable, content-hashed, and safe to keep. Nothing else qualifies. */
function isImmutableAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/brand/'))
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never, under any circumstance, the API. Stated first and as its own line so
  // it cannot be reached past by a later branch.
  if (url.pathname.startsWith('/api/')) return;

  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            // Only successful, same-origin responses. Caching an opaque or a 404
            // pins a broken asset until the version changes.
            if (response.ok) {
              const copy = response.clone();
              void caches.open(STATIC).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((hit) => hit ?? Response.error())),
    );
  }
});
