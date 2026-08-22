import { describe, expect, it } from 'vitest';

import { metadata, viewport } from './layout';

describe('root layout', () => {
  it('carries the product name and a mobile viewport', () => {
    // A title object since T-201: the default carries the Amharic name, and the
    // template appends the short one so a tab strip stays readable.
    expect(metadata.title).toEqual({
      default: 'Lomi-Exams',
      template: '%s · Lomi-Exams',
    });
    // The real device is a low-end phone; a missing viewport makes every page
    // render at desktop width and shrink to unreadable.
    expect(viewport.width).toBe('device-width');
    expect(viewport.initialScale).toBe(1);
  });
});

describe('self-hosted fonts (T-091)', () => {
  it('exposes a CSS variable for each face it ships', async () => {
    const { fontVariables } = await import('./fonts');
    // Under Vitest these are stub values (see test/next-font-stub.ts); what is
    // asserted here is the WIRING — that all three are declared and reach the
    // <html> element. That they actually load is verified in the browser, which
    // is the only place it can be.
    // Two, not three. The Ethiopic face went with the move to English only —
    // it was 198KB carried by every student so one logo glyph could render.
    expect(fontVariables.split(' ')).toHaveLength(2);
    expect(fontVariables).toContain('font-display-face');
    expect(fontVariables).toContain('font-body-face');
    expect(fontVariables).not.toContain('ethiopic');
  });

  it('ships the font files it references', async () => {
    const { existsSync, statSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const here = dirname(fileURLToPath(import.meta.url));
    for (const file of ['archivo-700.woff2', 'archivo-800.woff2', 'inter-variable.woff2']) {
      const path = resolve(here, 'fonts', file);
      expect(existsSync(path), `${file} is missing`).toBe(true);
      // A floor rather than an exact size: it catches the empty or truncated
      // download, which loads without error and renders nothing.
      const min = 10_000;
      expect(statSync(path).size, `${file} looks like the wrong subset`).toBeGreaterThan(min);
    }
  });
});
