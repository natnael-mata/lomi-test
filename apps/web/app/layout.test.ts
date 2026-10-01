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

  /**
   * No page appends the site name itself (T-268).
   *
   * The template already does it, so five pages that also wrote it produced
   * "Home · Lomi-Exams · Lomi-Exams" in the tab. Easy to write and invisible
   * unless somebody reads the tab strip, which is why it is worth a test rather
   * than a habit.
   */
  it('leaves the site name to the template', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { dirname, join, resolve } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const root = dirname(fileURLToPath(import.meta.url));
    const pages: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (entry === 'page.tsx') pages.push(path);
      }
    };
    walk(root);

    expect(pages.length).toBeGreaterThan(10);
    for (const page of pages) {
      const source = readFileSync(resolve(page), 'utf8');
      // `title: { absolute: … }` opts out of the template deliberately — the
      // landing page's title is the tagline, not a section name — so only the
      // plain form is checked.
      const title = /title:\s*'([^']*)'/.exec(source)?.[1];
      if (title === undefined) continue;
      expect(title, page).not.toContain('Lomi-Exams');
    }
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
    // Outfit replaced Bricolage with the redesign, and the swap fixed a real
    // defect: Bricolage shipped as Regular and Bold only, so `font-extrabold`
    // rendered identically to `font-bold`. Outfit is one variable face.
    for (const file of ['outfit-variable.woff2', 'inter-variable.woff2']) {
      const path = resolve(here, 'fonts', file);
      expect(existsSync(path), `${file} is missing`).toBe(true);
      // A floor rather than an exact size: it catches the empty or truncated
      // download, which loads without error and renders nothing.
      const min = 10_000;
      expect(statSync(path).size, `${file} looks like the wrong subset`).toBeGreaterThan(min);
    }
  });
});
