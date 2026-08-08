'use client';

/**
 * The last resort (T-208).
 *
 * `error.tsx` lives inside the root layout, so a throw in the layout itself — a
 * font, the theme boot script, the Telegram host adapter — is not caught by it.
 * This one replaces the whole document, which is why it has to render its own
 * `<html>` and `<body>` and cannot use any component that assumes the layout ran.
 *
 * Deliberately plain: no design tokens, because the stylesheet is one of the
 * things that may have failed. Inline styles so it renders with nothing loaded
 * at all — a white screen is the failure this file exists to prevent, and
 * reaching for a `<Card>` here is how it comes back.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '24px', lineHeight: 1.5 }}>
        <main data-error-boundary="global">
          <h1 style={{ fontSize: '20px', margin: '0 0 8px' }}>Lomi-Test could not start</h1>
          <p style={{ margin: '0 0 16px' }}>
            Nothing you have answered is lost. Reload the page, and if it keeps happening, tell
            support{error.digest ? ` and quote ${error.digest}` : ''}.
          </p>
          <button
            type="button"
            onClick={reset}
            data-recover=""
            style={{
              minHeight: '44px',
              padding: '0 20px',
              borderRadius: '12px',
              border: 0,
              background: '#5b4be0',
              color: '#fff',
              fontSize: '16px',
            }}
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
