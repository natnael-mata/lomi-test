import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { stripComments } from './strip-comments';
import {
  applyTelegramTheme,
  bindBackButton,
  bindMainButton,
  currentTokens,
  isTelegram,
  telegramWebApp,
  type TelegramWebApp,
} from './telegram';

const HERE = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(HERE, 'telegram.ts'), 'utf8');
const code = stripComments(source);

const OURS = {
  bg: '#f4f4f8',
  surface: '#ffffff',
  ink: '#16162b',
  ink2: '#5b5b75',
  brand: '#5b4be0',
  onBrand: '#ffffff',
};

/** A stand-in for the host SDK, recording what the app asked it to do. */
function fakeApp(over: Partial<TelegramWebApp> = {}) {
  const main = {
    text: '',
    shown: false,
    enabled: true,
    handlers: [] as (() => void)[],
    setText(t: string) {
      this.text = t;
    },
    show() {
      this.shown = true;
    },
    hide() {
      this.shown = false;
    },
    enable() {
      this.enabled = true;
    },
    disable() {
      this.enabled = false;
    },
    onClick(h: () => void) {
      this.handlers.push(h);
    },
    offClick(h: () => void) {
      this.handlers = this.handlers.filter((x) => x !== h);
    },
  };
  const back = {
    shown: false,
    handlers: [] as (() => void)[],
    show() {
      this.shown = true;
    },
    hide() {
      this.shown = false;
    },
    onClick(h: () => void) {
      this.handlers.push(h);
    },
    offClick(h: () => void) {
      this.handlers = this.handlers.filter((x) => x !== h);
    },
  };
  return { app: { MainButton: main, BackButton: back, ...over } as TelegramWebApp, main, back };
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

describe('one app, detected at runtime (T-175)', () => {
  /**
   * T-175's stated test, asserted where it can actually be enforced.
   *
   * "One build output serves both" is a property of how the app decides it is in
   * Telegram. A build-time flag would mean two bundles, two deploys, and one of
   * them a version behind — which nobody finds until a student in Telegram is
   * looking at last week's app.
   */
  it('decides at runtime, never from a build-time flag', () => {
    expect(code).toContain('typeof window');
    for (const banned of ['NEXT_PUBLIC_IS_TELEGRAM', 'process.env.TELEGRAM', 'IS_MINI_APP']) {
      expect(code, `${banned} would split this into two bundles`).not.toContain(banned);
    }
  });

  it('is an ordinary website when there is no host', () => {
    (globalThis as Record<string, unknown>).window = {};
    expect(telegramWebApp()).toBeNull();
    expect(isTelegram()).toBe(false);
  });

  it('finds the host when Telegram has injected it', () => {
    (globalThis as Record<string, unknown>).window = { Telegram: { WebApp: {} } };
    expect(isTelegram()).toBe(true);
  });

  // Server-rendered: there is no window at all, and asking must not throw.
  it('survives being called on the server', () => {
    expect(() => telegramWebApp()).not.toThrow();
    expect(isTelegram()).toBe(false);
  });

  /**
   * Read every time, not cached at module load. The host's script may not have
   * run when this module is first evaluated, and a cached `null` from the wrong
   * moment turns the integration off with nothing to show for it.
   */
  it('re-reads the host rather than caching the first answer', () => {
    (globalThis as Record<string, unknown>).window = {};
    expect(isTelegram()).toBe(false);
    (globalThis as Record<string, unknown>).window = { Telegram: { WebApp: {} } };
    expect(isTelegram()).toBe(true);
  });
});

describe('applying the host theme', () => {
  it('writes the adopted variables onto the root', () => {
    const set = vi.fn();
    const { app } = fakeApp({
      themeParams: {
        bg_color: '#17212b',
        secondary_bg_color: '#232e3c',
        text_color: '#ffffff',
      },
    });

    const result = applyTelegramTheme(app, OURS, { style: { setProperty: set } });
    expect(result.adopted).toContain('reading');
    expect(set).toHaveBeenCalledWith('--color-bg', '#17212b');
    expect(set).toHaveBeenCalledWith('--color-ink', '#ffffff');
  });

  it('writes our own values when there is nothing to adopt', () => {
    const set = vi.fn();
    const { app } = fakeApp({ themeParams: {} });
    applyTelegramTheme(app, OURS, { style: { setProperty: set } });
    expect(set).toHaveBeenCalledWith('--color-bg', OURS.bg);
  });

  it('reads our tokens off the page to fall back to', () => {
    const tokens = currentTokens({} as Element, () => ({
      getPropertyValue: (k: string) => (k === '--color-bg' ? ' #f4f4f8 ' : '#000000'),
    }));
    expect(tokens.bg).toBe('#f4f4f8');
  });
});

describe('the host’s own buttons (T-179)', () => {
  /** T-179's stated test: MainButton is wired and carries the label. */
  it('shows MainButton with the primary action’s label', () => {
    const { app, main } = fakeApp();
    bindMainButton(app, { label: 'Submit', onClick: () => undefined });
    expect(main.text).toBe('Submit');
    expect(main.shown).toBe(true);
    expect(main.handlers).toHaveLength(1);
  });

  it('fires the action when the host button is tapped', () => {
    const { app, main } = fakeApp();
    const onClick = vi.fn();
    bindMainButton(app, { label: 'Submit', onClick });
    main.handlers[0]!();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('can start disabled', () => {
    const { app, main } = fakeApp();
    bindMainButton(app, { label: 'Submit', onClick: () => undefined, enabled: false });
    expect(main.enabled).toBe(false);
  });

  /**
   * The bug this cleanup exists for.
   *
   * `onClick` appends, so a screen mounting twice — React in development, or a
   * back-and-forward anywhere — leaves two handlers and fires the action twice.
   * A double submit on an exam is not a cosmetic bug.
   */
  it('removes its handler on cleanup, not just the button', () => {
    const { app, main } = fakeApp();
    const cleanup = bindMainButton(app, { label: 'Submit', onClick: () => undefined });
    cleanup();
    expect(main.handlers).toHaveLength(0);
    expect(main.shown).toBe(false);
  });

  it('leaves exactly one handler after a remount', () => {
    const { app, main } = fakeApp();
    const onClick = vi.fn();
    bindMainButton(app, { label: 'Submit', onClick })();
    bindMainButton(app, { label: 'Submit', onClick });
    main.handlers.forEach((h) => h());
    expect(onClick).toHaveBeenCalledOnce();
  });

  describe('the back arrow', () => {
    it('shows and wires it when there is somewhere to go', () => {
      const { app, back } = fakeApp();
      const onBack = vi.fn();
      bindBackButton(app, onBack);
      expect(back.shown).toBe(true);
      back.handlers[0]!();
      expect(onBack).toHaveBeenCalledOnce();
    });

    // Hidden rather than left showing and inert: a back arrow that does nothing
    // is worse than none, because it is the control people press hardest when
    // they feel stuck.
    it('hides it when there is nowhere to go back to', () => {
      const { app, back } = fakeApp();
      back.shown = true;
      bindBackButton(app, null);
      expect(back.shown).toBe(false);
      expect(back.handlers).toHaveLength(0);
    });

    it('removes its handler on cleanup', () => {
      const { app, back } = fakeApp();
      bindBackButton(app, () => undefined)();
      expect(back.handlers).toHaveLength(0);
    });
  });

  /**
   * An older Telegram client, or a browser. Binding must be a no-op that still
   * returns a cleanup, so every caller can use the same shape unconditionally.
   */
  it('is a no-op when the host has no buttons', () => {
    const app = {} as TelegramWebApp;
    expect(() => bindMainButton(app, { label: 'x', onClick: () => undefined })()).not.toThrow();
    expect(() => bindBackButton(app, () => undefined)()).not.toThrow();
  });
});
