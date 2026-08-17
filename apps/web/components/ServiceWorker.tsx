'use client';

/**
 * Registers the offline shell (T-202).
 *
 * **Production only.** A service worker in development serves yesterday's
 * chunks against today's HTML, which presents as a page that renders and then
 * dies on hydration — a failure that costs an afternoon and has nothing to do
 * with the code being changed. Next.js's dev server assumes nothing is caching
 * its output.
 *
 * Registered after load rather than during it: the worker's own fetch competes
 * with the fetches for the first screen, and the first screen is the one a
 * student is looking at. Nothing on the page waits for this — a failed
 * registration means no offline page, not a broken app, so it fails silently
 * on purpose.
 */
import { useEffect } from 'react';

export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = (): void => {
      void navigator.serviceWorker.register('/sw.js').catch(() => {
        // Private mode, an unsupported browser, or a server that did not serve
        // the file. None of them are worth a message to a student.
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
