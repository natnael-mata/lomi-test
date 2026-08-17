import type { MetadataRoute } from 'next';

/**
 * The install manifest (T-202).
 *
 * A student who installs this gets an icon on the home screen beside their
 * other apps, which on a phone in Ethiopia is the difference between opening
 * the product and remembering a URL. That is the whole reason the task exists.
 *
 * Four decisions worth stating:
 *
 * - **`start_url` is `/practice`, not `/`.** The home screen is a list of links
 *   to the five destinations; somebody who pressed an icon has already chosen
 *   one. Opening on the question is opening on the thing they came for.
 * - **`display: standalone`**, not `fullscreen`. Fullscreen takes the status bar
 *   with it, and a student practising between lectures wants to see the time.
 * - **`theme_color` is Brand Violet and `background_color` is the app's
 *   ground.** The background is what a launcher paints during the splash before
 *   the first frame arrives — matching it means the app appears rather than
 *   flashing white first, which on a slow phone is most of the perceived load.
 * - **Both icon purposes are declared.** `maskable` is a separate file with the
 *   glyph inside the safe zone; a launcher that crops to a circle would
 *   otherwise bite the corners off the mark.
 *
 * The Amharic name rides on `name` and not on `short_name` — a home screen
 * truncates hard, and a name that only ever appears cut in half is not a name
 * (the same reasoning as the page title in `layout.tsx`).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Lomi-Test (ሎሚ)',
    short_name: 'Lomi-Test',
    description:
      'Exit-exam preparation for Ethiopian university students — every answer fully explained.',
    start_url: '/practice',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F6F6FB',
    theme_color: '#5B4BE0',
    lang: 'en',
    categories: ['education'],
    icons: [
      { src: '/brand/lomi-test-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/lomi-test-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/brand/lomi-test-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
