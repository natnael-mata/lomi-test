/**
 * The Telegram Mini App bridge (T-175, T-179).
 *
 * **One app, one build, detected at runtime** (T-175). There is no separate
 * Mini App bundle and no `NEXT_PUBLIC_IS_TELEGRAM` flag baked in at build time,
 * because two bundles means two things to deploy, two things to test, and one of
 * them being a version behind — which is exactly the bug nobody finds until a
 * student in Telegram is looking at last week's app.
 *
 * So everything here asks the *page*, not the build. Outside Telegram every
 * function is a no-op and the app is an ordinary website.
 */
import {
  adoptTelegramTheme,
  type TelegramThemeParams,
  type ThemeFallbacks,
} from './telegram-theme';

/** Only the parts of Telegram's SDK this app touches. */
export interface TelegramWebApp {
  themeParams?: TelegramThemeParams;
  colorScheme?: 'light' | 'dark';
  ready?: () => void;
  expand?: () => void;
  onEvent?: (event: string, handler: () => void) => void;
  offEvent?: (event: string, handler: () => void) => void;
  MainButton?: {
    setText: (text: string) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    onClick: (handler: () => void) => void;
    offClick: (handler: () => void) => void;
  };
  BackButton?: {
    show: () => void;
    hide: () => void;
    onClick: (handler: () => void) => void;
    offClick: (handler: () => void) => void;
  };
}

interface TelegramGlobal {
  Telegram?: { WebApp?: TelegramWebApp };
}

/**
 * The Mini App SDK, or `null` in an ordinary browser.
 *
 * Read every time rather than cached at module load: the script that defines it
 * is loaded by the host and there is no guarantee it has run when this module
 * is first evaluated. A cached `null` from the wrong moment turns the whole
 * integration off with nothing to show for it.
 */
export function telegramWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as TelegramGlobal).Telegram?.WebApp ?? null;
}

/** Whether this page is running inside Telegram. */
export function isTelegram(): boolean {
  return telegramWebApp() !== null;
}

/**
 * Applies the host theme to the document, contrast-checked (T-176–T-178).
 *
 * Returns what was adopted so a caller can log or test it. Writing the variables
 * on `documentElement` rather than swapping a stylesheet keeps this one
 * mechanism: the tokens are already CSS custom properties, so a host theme is
 * the same kind of override as the dark-mode class.
 */
export function applyTelegramTheme(
  app: TelegramWebApp,
  fallbacks: ThemeFallbacks,
  root: { style: { setProperty: (k: string, v: string) => void } },
): ReturnType<typeof adoptTelegramTheme> {
  const result = adoptTelegramTheme(app.themeParams ?? {}, fallbacks);
  for (const [name, value] of Object.entries(result.vars)) {
    root.style.setProperty(name, value);
  }
  return result;
}

/** Reads our own tokens off the page, to fall back to when a host colour is refused. */
export function currentTokens(
  root: Element,
  read: (el: Element) => { getPropertyValue: (k: string) => string },
): ThemeFallbacks {
  const computed = read(root);
  const get = (name: string): string => computed.getPropertyValue(name).trim();
  return {
    bg: get('--color-bg'),
    surface: get('--color-surface'),
    ink: get('--color-ink'),
    ink2: get('--color-ink-2'),
    brand: get('--color-brand'),
    onBrand: get('--color-on-brand'),
  };
}

export interface MainButtonSpec {
  label: string;
  onClick: () => void;
  enabled?: boolean;
}

/**
 * Hands the primary action to Telegram's own MainButton (T-179).
 *
 * Returns a cleanup function. **The handler must be removed, not just the
 * button hidden**: `onClick` appends, so a screen that mounts twice — which is
 * what React does in development, and what a back-and-forward does anywhere —
 * leaves two handlers and fires the action twice. A double submit on an exam is
 * not a cosmetic bug.
 */
export function bindMainButton(app: TelegramWebApp, spec: MainButtonSpec): () => void {
  const button = app.MainButton;
  if (!button) return () => undefined;

  button.setText(spec.label);
  if (spec.enabled === false) button.disable();
  else button.enable();
  button.onClick(spec.onClick);
  button.show();

  return () => {
    button.offClick(spec.onClick);
    button.hide();
  };
}

/** The same, for the host's back arrow. Hidden when there is nowhere to go back to. */
export function bindBackButton(app: TelegramWebApp, onBack: (() => void) | null): () => void {
  const button = app.BackButton;
  if (!button) return () => undefined;

  if (!onBack) {
    button.hide();
    return () => undefined;
  }

  button.onClick(onBack);
  button.show();
  return () => {
    button.offClick(onBack);
    button.hide();
  };
}
