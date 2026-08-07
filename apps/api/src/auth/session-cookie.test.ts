import { describe, expect, it } from 'vitest';

import {
  SESSION_COOKIE,
  SESSION_COOKIE_MAX_AGE_SEC,
  clearedSessionCookie,
  cookieOptionsFor,
  readSessionCookie,
  sessionCookie,
} from './session-cookie';
import { TOKEN_TTL_SEC } from './tokens';

const secure = { secure: true };
const insecure = { secure: false };

describe('the session cookie (T-112a)', () => {
  describe('the flags that make this an upgrade rather than a sideways move', () => {
    /**
     * The point of the whole task. `localStorage` is readable by any script on
     * the page, so an XSS was a token an attacker could carry away and reuse
     * from their own machine for ninety days.
     */
    it('is HttpOnly, so no script can read it', () => {
      expect(sessionCookie('tok', secure)).toContain('HttpOnly');
    });

    /**
     * The flag that keeps this from being a downgrade.
     *
     * An Authorization header is never sent automatically; a cookie is. Without
     * SameSite, any site could POST to our API from a victim's browser and be
     * authenticated — a class of attack the header simply did not have.
     */
    it('is SameSite=Lax, which is what stops CSRF', () => {
      expect(sessionCookie('tok', secure)).toContain('SameSite=Lax');
    });

    it('is Secure in production', () => {
      expect(sessionCookie('tok', secure)).toContain('Secure');
    });

    /**
     * And not over plain http, or the browser discards it — which presents as
     * "sign-in does nothing" on a local machine, with no error anywhere.
     */
    it('is not Secure in local development', () => {
      expect(sessionCookie('tok', insecure)).not.toContain('Secure');
    });

    it('takes Secure from NODE_ENV', () => {
      expect(cookieOptionsFor({ NODE_ENV: 'production' })).toEqual({ secure: true });
      expect(cookieOptionsFor({ NODE_ENV: 'development' })).toEqual({ secure: false });
      expect(cookieOptionsFor({})).toEqual({ secure: false });
    });

    // A narrower path means a student who navigates to the wrong prefix is
    // silently signed out.
    it('covers every route with Path=/', () => {
      expect(sessionCookie('tok', secure)).toContain('Path=/');
    });

    /** A cookie outliving its token would present as a session that 401s forever. */
    it('expires with the token, not after it', () => {
      expect(SESSION_COOKIE_MAX_AGE_SEC).toBe(TOKEN_TTL_SEC);
      expect(sessionCookie('tok', secure)).toContain(`Max-Age=${TOKEN_TTL_SEC}`);
    });
  });

  describe('carrying the token', () => {
    it('round-trips', () => {
      const header = sessionCookie('abc.def.ghi', secure);
      const value = header.split(';')[0]!.split('=').slice(1).join('=');
      expect(readSessionCookie(`${SESSION_COOKIE}=${value}`)).toBe('abc.def.ghi');
    });

    it('finds ours among others', () => {
      expect(readSessionCookie(`theme=dark; ${SESSION_COOKIE}=tok; other=1`)).toBe('tok');
    });

    it('is absent when there is no cookie header at all', () => {
      expect(readSessionCookie(undefined)).toBeNull();
      expect(readSessionCookie('')).toBeNull();
    });

    it('is absent when some other cookie is set but ours is not', () => {
      expect(readSessionCookie('theme=dark; other=1')).toBeNull();
    });

    // An empty value is not a session — that is what a cleared cookie looks like
    // on the way back, and treating it as a token hands the verifier nonsense.
    it('treats an empty value as no session', () => {
      expect(readSessionCookie(`${SESSION_COOKIE}=`)).toBeNull();
      expect(readSessionCookie(`${SESSION_COOKIE}=  `)).toBeNull();
    });

    it('survives a malformed value rather than throwing mid-request', () => {
      expect(() => readSessionCookie(`${SESSION_COOKIE}=%E0%A4%A`)).not.toThrow();
      expect(readSessionCookie(`${SESSION_COOKIE}=%E0%A4%A`)).toBeNull();
    });

    it('is not fooled by a cookie whose name merely ends the same way', () => {
      expect(readSessionCookie(`not_${SESSION_COOKIE}=tok`)).toBeNull();
    });

    it('ignores a stray fragment with no equals sign', () => {
      expect(readSessionCookie(`nonsense; ${SESSION_COOKIE}=tok`)).toBe('tok');
    });
  });

  describe('signing out', () => {
    /**
     * Every attribute that identified the original has to match, or the browser
     * treats this as a different cookie and keeps the old one — leaving somebody
     * who pressed Sign out still signed in.
     */
    it('matches the original’s attributes so the browser actually drops it', () => {
      const cleared = clearedSessionCookie(secure);
      for (const attribute of ['Path=/', 'HttpOnly', 'SameSite=Lax', 'Secure']) {
        expect(cleared, `cleared cookie is missing ${attribute}`).toContain(attribute);
      }
    });

    it('expires immediately and carries no token', () => {
      const cleared = clearedSessionCookie(secure);
      expect(cleared).toContain('Max-Age=0');
      expect(cleared.startsWith(`${SESSION_COOKIE}=;`)).toBe(true);
    });

    it('reads back as no session', () => {
      expect(readSessionCookie(clearedSessionCookie(secure).split(';')[0])).toBeNull();
    });
  });
});
