import { describe, expect, it } from 'vitest';

import { metadata, viewport } from './layout';

describe('root layout', () => {
  it('carries the product name and a mobile viewport', () => {
    // A title object since T-201: the default carries the Amharic name, and the
    // template appends the short one so a tab strip stays readable.
    expect(metadata.title).toEqual({
      default: 'Lomi-Test (ሎሚ)',
      template: '%s · Lomi-Test',
    });
    // The real device is a low-end phone; a missing viewport makes every page
    // render at desktop width and shrink to unreadable.
    expect(viewport.width).toBe('device-width');
    expect(viewport.initialScale).toBe(1);
  });
});

describe('self-hosted fonts (T-091)', () => {
  it('exposes a CSS variable for each of the three faces', async () => {
    const { fontVariables } = await import('./fonts');
    // Under Vitest these are stub values (see test/next-font-stub.ts); what is
    // asserted here is the WIRING — that all three are declared and reach the
    // <html> element. That they actually load is verified in the browser, which
    // is the only place it can be.
    expect(fontVariables.split(' ')).toHaveLength(3);
    expect(fontVariables).toContain('font-gabarito');
    expect(fontVariables).toContain('font-figtree');
    expect(fontVariables).toContain('font-ethiopic');
  });

  it('ships the font files it references', async () => {
    const { existsSync, statSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const here = dirname(fileURLToPath(import.meta.url));
    for (const file of [
      'gabarito-variable.woff2',
      'figtree-variable.woff2',
      'noto-sans-ethiopic-variable.woff2',
    ]) {
      const path = resolve(here, 'fonts', file);
      expect(existsSync(path), `${file} is missing`).toBe(true);
      // The Ethiopic file was 31 KB when the LATIN subset was downloaded by
      // mistake — a file that exists, loads, and contains no Ge'ez glyph at all.
      // The floor catches that specific wrong-subset failure.
      const min = file.includes('ethiopic') ? 100_000 : 10_000;
      expect(statSync(path).size, `${file} looks like the wrong subset`).toBeGreaterThan(min);
    }
  });
});
