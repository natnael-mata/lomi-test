import { describe, expect, it } from 'vitest';

import { AA_BODY, contrast, meetsAA, parseHex } from './contrast';
import {
  ADOPTABLE_VARS,
  NEVER_ADOPTED,
  adoptTelegramTheme,
  type ThemeFallbacks,
} from './telegram-theme';

/** Stand-ins for our own tokens; the real values are audited in `contrast.test.ts`. */
const OURS: ThemeFallbacks = {
  bg: '#f4f4f8',
  surface: '#ffffff',
  ink: '#16162b',
  ink2: '#5b5b75',
  brand: '#5b4be0',
  onBrand: '#ffffff',
};

/** A well-behaved dark host theme. */
const DARK = {
  bg_color: '#17212b',
  secondary_bg_color: '#232e3c',
  text_color: '#ffffff',
  hint_color: '#b1c3d5',
  button_color: '#2ea6ff',
  button_text_color: '#000000',
};

describe('adopting a Telegram host theme (T-176, T-177, T-178)', () => {
  describe('taking the host’s chrome (T-176)', () => {
    it('adopts ground, surface, text, hint and the button pair', () => {
      const { vars, adopted } = adoptTelegramTheme(DARK, OURS);
      expect(vars['--color-bg']).toBe(DARK.bg_color);
      expect(vars['--color-surface']).toBe(DARK.secondary_bg_color);
      expect(vars['--color-ink']).toBe(DARK.text_color);
      expect(vars['--color-ink-2']).toBe(DARK.hint_color);
      expect(vars['--color-brand']).toBe(DARK.button_color);
      expect(vars['--color-on-brand']).toBe(DARK.button_text_color);
      expect(adopted.sort()).toEqual(['button', 'hint', 'reading']);
    });

    /**
     * T-176's stated test: with a dark theme param, the background matches it.
     */
    it('makes the app background the host’s background', () => {
      expect(adoptTelegramTheme(DARK, OURS).vars['--color-bg']).toBe('#17212b');
    });

    /**
     * Every variable is returned, adopted or not, so a caller sets one complete
     * theme. A patch over whatever was there before is how a student ends up
     * with yesterday's background under today's text.
     */
    it('returns a complete theme even when nothing is adopted', () => {
      const { vars, adopted } = adoptTelegramTheme({}, OURS);
      expect(adopted).toEqual([]);
      expect(Object.keys(vars).sort()).toEqual([...ADOPTABLE_VARS].sort());
      expect(vars['--color-bg']).toBe(OURS.bg);
      expect(vars['--color-ink']).toBe(OURS.ink);
    });
  });

  describe('semantic colours are ours, always (T-177)', () => {
    /** T-177's stated test. */
    it('never writes a semantic variable, whatever the host sends', () => {
      const hostile = {
        ...DARK,
        // A host cannot smuggle these in; they are not read at all.
        correct_color: '#ff0000',
        wrong_color: '#00ff00',
      } as Record<string, string>;
      const { vars } = adoptTelegramTheme(hostile, OURS);
      for (const token of NEVER_ADOPTED) {
        expect(vars, `${token} must not be settable by a host theme`).not.toHaveProperty(token);
      }
    });

    /**
     * The allowlist and the never-list must stay disjoint. This is easy to break
     * by adding one convenient mapping, and the damage is invisible until a
     * student is told an answer was correct in a colour that means something
     * else everywhere else in the app.
     */
    it('keeps the adoptable and never-adopted lists disjoint', () => {
      const adoptable = new Set<string>(ADOPTABLE_VARS);
      for (const token of NEVER_ADOPTED) {
        expect(adoptable.has(token), `${token} appears in both lists`).toBe(false);
      }
    });

    it('writes nothing outside the allowlist', () => {
      const { vars } = adoptTelegramTheme(DARK, OURS);
      for (const key of Object.keys(vars)) {
        expect(ADOPTABLE_VARS, `${key} is not on the allowlist`).toContain(key);
      }
    });
  });

  describe('unreadable host colours are refused (T-178)', () => {
    /** T-178's stated test: a low-contrast param loses to our token. */
    it('keeps our colours when the host’s text would be illegible', () => {
      const murky = { ...DARK, text_color: '#1a2430' }; // near its own background
      expect(contrast('#1a2430', DARK.bg_color)!).toBeLessThan(AA_BODY);

      const { vars, adopted, rejected } = adoptTelegramTheme(murky, OURS);
      expect(vars['--color-ink']).toBe(OURS.ink);
      expect(vars['--color-bg']).toBe(OURS.bg);
      expect(adopted).not.toContain('reading');
      expect(rejected).toContainEqual({ group: 'reading', reason: 'unreadable' });
    });

    /**
     * The rule that makes this safe rather than merely cautious.
     *
     * Reverting only the failing side leaves their background under our ink — a
     * pair nobody has ever audited, and the one that looks fine on a reviewer's
     * phone and fails on a student's.
     */
    it('reverts the whole pair, never one side of it', () => {
      const murky = { ...DARK, text_color: '#1a2430' };
      const { vars } = adoptTelegramTheme(murky, OURS);
      expect(vars['--color-bg']).toBe(OURS.bg);
      expect(vars['--color-surface']).toBe(OURS.surface);
      expect(vars['--color-ink']).toBe(OURS.ink);
    });

    it('rejects a button whose label cannot be read on it', () => {
      const bad = { ...DARK, button_color: '#2ea6ff', button_text_color: '#3fb0ff' };
      const { vars, adopted } = adoptTelegramTheme(bad, OURS);
      expect(vars['--color-brand']).toBe(OURS.brand);
      expect(vars['--color-on-brand']).toBe(OURS.onBrand);
      expect(adopted).not.toContain('button');
    });

    it('rejects a hint colour that disappears into the surface', () => {
      const bad = { ...DARK, hint_color: '#26313f' };
      const { vars, adopted } = adoptTelegramTheme(bad, OURS);
      expect(vars['--color-ink-2']).toBe(OURS.ink2);
      expect(adopted).not.toContain('hint');
    });

    /**
     * Groups are independent. A host with an unreadable button still gets its
     * own background — rejecting everything because one param is bad would make
     * the app look foreign for a reason the student cannot see.
     */
    it('keeps the groups independent of each other', () => {
      const bad = { ...DARK, button_text_color: '#3fb0ff' };
      const { vars, adopted } = adoptTelegramTheme(bad, OURS);
      expect(adopted).toContain('reading');
      expect(vars['--color-bg']).toBe(DARK.bg_color);
      expect(adopted).not.toContain('button');
    });

    // The hint is checked against whichever ground actually won, not against
    // the host's — otherwise a rejected background leaves the hint verified
    // against a colour that is not on screen.
    it('checks the hint against the ground that was actually adopted', () => {
      // Reading is refused, so ink-2 must be legible on OUR light background.
      const murkyText = { ...DARK, text_color: '#1a2430', hint_color: '#b1c3d5' };
      const { vars, adopted } = adoptTelegramTheme(murkyText, OURS);
      expect(adopted).not.toContain('reading');
      // #b1c3d5 is a pale grey — fine on Telegram's dark ground, far too pale
      // on ours, and this is the case that would have slipped through.
      expect(meetsAA('#b1c3d5', OURS.bg)).toBe(false);
      expect(vars['--color-ink-2']).toBe(OURS.ink2);
    });
  });

  describe('a host that sends nonsense', () => {
    it('ignores values that are not colours', () => {
      const { vars, adopted } = adoptTelegramTheme(
        { ...DARK, text_color: 'rgb(255,255,255)' },
        OURS,
      );
      expect(adopted).not.toContain('reading');
      expect(vars['--color-ink']).toBe(OURS.ink);
    });

    it('refuses a partial group rather than mixing', () => {
      const { adopted, rejected } = adoptTelegramTheme({ bg_color: '#17212b' }, OURS);
      expect(adopted).toEqual([]);
      expect(rejected).toContainEqual({ group: 'reading', reason: 'incomplete' });
    });

    it('survives an empty theme, which is what a browser sends', () => {
      expect(() => adoptTelegramTheme({}, OURS)).not.toThrow();
      expect(adoptTelegramTheme({}, OURS).vars['--color-bg']).toBe(OURS.bg);
    });

    it('survives undefined values on every key', () => {
      const empty = {
        bg_color: undefined,
        secondary_bg_color: undefined,
        text_color: undefined,
        hint_color: undefined,
        button_color: undefined,
        button_text_color: undefined,
      };
      expect(adoptTelegramTheme(empty, OURS).adopted).toEqual([]);
    });
  });
});

describe('the contrast maths', () => {
  it('reads the hex forms Telegram actually sends', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex('ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex('#ffffffcc')).toEqual({ r: 255, g: 255, b: 255 });
  });

  /**
   * `null`, not a default. A caller deciding whether to trust a host colour has
   * to tell "fails the check" from "was never a colour" — defaulting to black
   * would pass a contrast check against a value nobody supplied.
   */
  it('says null for anything that is not a colour', () => {
    for (const bad of ['', 'red', 'rgb(0,0,0)', '#12', '#12345', 'var(--x)']) {
      expect(parseHex(bad), bad).toBeNull();
      expect(contrast(bad, '#fff'), bad).toBeNull();
      expect(meetsAA(bad, '#fff'), bad).toBe(false);
    }
  });

  it('agrees with the known extremes', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrast('#16162b', '#f4f4f8')).toBe(contrast('#f4f4f8', '#16162b'));
  });
});
