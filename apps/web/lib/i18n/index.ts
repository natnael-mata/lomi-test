/**
 * Resolving copy (T-210).
 *
 * **A plain function, not a hook and not a context.** `copy()` works identically
 * in a server component, a client component and a test, which matters here
 * because the same components are rendered by both — the design gallery is a
 * server component and the exam screen is a client one, and a hook would have
 * forced one of them to change for reasons that have nothing to do with
 * language.
 *
 * **English only, since 2026-08-20.** The exam is set in English, so the product
 * is too: the questions, the worked solutions and the interface around them.
 *
 * An Amharic dictionary existed here before and no student ever saw a word of
 * it — there was no locale switcher, and `DEFAULT_LOCALE` was already English.
 * It was ~718 lines of unreviewed first draft plus a 198KB Ethiopic font on
 * every first load, which is the largest single payload saving in this app for a
 * student on a metered connection.
 *
 * The signature keeps its shape rather than collapsing to a constant: every call
 * site says `copy()`, and a second locale later means adding a dictionary here
 * rather than editing eighty components.
 */
import { en, type Copy } from './dictionary';

/** The copy. */
export function copy(): Copy {
  return en;
}

export type { Copy };
