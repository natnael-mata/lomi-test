'use client';

/**
 * Adopts the Telegram host's theme when the app is running inside it (T-175–T-178).
 *
 * Mounted once, in the root layout. Outside Telegram it does nothing at all and
 * renders nothing — there is one build and one bundle, and this component is how
 * it tells where it is (T-175).
 *
 * **After the theme boot script, not instead of it.** That script sets light or
 * dark before first paint; this reads the tokens it settled on and uses them as
 * the fallback for any host colour that fails the contrast check. Doing it the
 * other way round would fall back to whichever theme happened to be compiled
 * first, which is a light-mode flash inside a dark Telegram.
 */
import { useEffect } from 'react';

import { applyTelegramTheme, currentTokens, telegramWebApp } from '../lib/telegram';

export function TelegramHost() {
  useEffect(() => {
    const app = telegramWebApp();
    if (!app) return;

    const root = document.documentElement;
    const apply = (): void => {
      applyTelegramTheme(
        app,
        currentTokens(root, (el) => getComputedStyle(el)),
        root,
      );
    };

    apply();
    // The host tells the page to expand and marks it ready; both are safe to
    // call more than once and harmless when absent on an older client.
    app.ready?.();
    app.expand?.();

    // A student can change Telegram's theme while the app is open, and the app
    // is on screen when they do it.
    app.onEvent?.('themeChanged', apply);
    return () => app.offEvent?.('themeChanged', apply);
  }, []);

  return null;
}
