/**
 * Resolving copy for a locale (T-210).
 *
 * **A plain function, not a hook and not a context.** `copy()` works identically
 * in a server component, a client component and a test, which matters here
 * because the same components are rendered by both — the design gallery is a
 * server component and the exam screen is a client one, and a hook would have
 * forced one of them to change for reasons that have nothing to do with
 * language.
 *
 * There is **no locale switcher yet**, and that is the honest state: `am` exists,
 * is type-checked against `en`, and is not reachable. Telegram supplies
 * `language_code` on its host object, so the switch belongs with the Mini App
 * work — wiring it before the Amharic has been reviewed would ship a draft.
 */
import { am, en, type Copy } from './dictionary';

export type Locale = 'en' | 'am';

export const LOCALES: Record<Locale, Copy> = { en, am };

/**
 * English, until the Amharic has been reviewed.
 *
 * Not a guess at the student's language: getting this wrong shows somebody an
 * unreviewed draft of their own language, which reads worse than the language
 * they did not ask for.
 */
export const DEFAULT_LOCALE: Locale = 'en';

/** The copy for a locale. Unknown locales fall back rather than throwing. */
export function copy(locale: Locale = DEFAULT_LOCALE): Copy {
  return LOCALES[locale] ?? LOCALES[DEFAULT_LOCALE];
}

export type { Copy };
