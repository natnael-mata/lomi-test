/**
 * The session cookie (T-112a).
 *
 * **What this move actually buys, and what it costs.** Until now the token lived
 * in `localStorage`, which any script on the page can read — so an XSS was not
 * just script execution, it was a token an attacker could carry away and reuse
 * from their own machine for ninety days. `httpOnly` closes that: the token
 * cannot be read by JavaScript at all, so it cannot be exfiltrated.
 *
 * It does **not** make XSS harmless, and pretending otherwise is how the next
 * person mis-reads this file. A script running on the page can still call the
 * API, because the browser attaches the cookie for it. What changes is that the
 * damage stays in that page, in that session, for as long as the script runs,
 * instead of walking out of the building.
 *
 * **And it introduces CSRF, which the header did not have.** An `Authorization`
 * header is never sent automatically; a cookie is. Without `SameSite`, any site
 * could POST to our API from a victim's browser and be authenticated. `Lax` is
 * what makes that safe: cookies are withheld from cross-site POSTs, which is
 * every state-changing route here. It is not decoration on the end of the
 * string — it is the thing that keeps this change from being a downgrade.
 */

export const SESSION_COOKIE = 'lomi_session';

/** 90 days, matching `TOKEN_TTL_SEC` — a cookie outliving its token is a bug. */
export const SESSION_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 90;

export interface CookieOptions {
  /** `Secure` is omitted over plain http, or the browser drops the cookie. */
  secure: boolean;
}

/**
 * The `Set-Cookie` value for a fresh session.
 *
 * `Path=/` because the API serves `/auth`, `/me`, `/questions` and more, and a
 * narrower path means a signed-in student who navigates to the wrong prefix is
 * silently signed out.
 */
export function sessionCookie(token: string, options: CookieOptions): string {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    // See the file header: this is the CSRF defence, not a nicety.
    'SameSite=Lax',
    `Max-Age=${SESSION_COOKIE_MAX_AGE_SEC}`,
    ...(options.secure ? ['Secure'] : []),
  ].join('; ');
}

/**
 * The `Set-Cookie` value that removes it.
 *
 * Every attribute that identified the original has to match or the browser
 * treats this as a different cookie and keeps the old one — which would leave
 * somebody who pressed Sign out still signed in.
 */
export function clearedSessionCookie(options: CookieOptions): string {
  return [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    ...(options.secure ? ['Secure'] : []),
  ].join('; ');
}

/**
 * Pulls our cookie out of a `Cookie` header.
 *
 * Hand-parsed rather than pulling in a dependency for one header. Values are
 * `decodeURIComponent`-ed because that is what was written; a token containing
 * no escapable character round-trips either way, but relying on that is relying
 * on the JWT alphabet never changing.
 */
export function readSessionCookie(header: string | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== SESSION_COOKIE) continue;
    const raw = part.slice(eq + 1).trim();
    if (raw === '') return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      // A malformed value is not a session. Refusing beats handing the verifier
      // a half-decoded string and letting it fail somewhere less obvious.
      return null;
    }
  }
  return null;
}

/** `Secure` everywhere except plain-http local development. */
export function cookieOptionsFor(env: NodeJS.ProcessEnv): CookieOptions {
  return { secure: env.NODE_ENV === 'production' };
}
