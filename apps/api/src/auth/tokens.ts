/**
 * Issuing and checking session tokens.
 *
 * A JWT carries the claims, but **the session row is the authority**: the
 * product promises a device list and immediate revocation (T-083, T-084), and a
 * purely stateless token can deliver neither. So a token is only half of a valid
 * credential — `AuthService` checks the row on every use, and this module's job
 * is limited to the signature and the claims.
 */
import { sign, verify, type JwtPayload } from 'jsonwebtoken';

export interface SessionClaims {
  /** The user id. */
  sub: string;
  /** The session row this token belongs to — what makes revocation possible. */
  sid: string;
}

export type TokenResult = { ok: true; claims: SessionClaims } | { ok: false; reason: string };

/** Long-lived because the session row, not the expiry, is how access is ended. */
export const TOKEN_TTL_SEC = 60 * 60 * 24 * 90;

export function signSessionToken(
  claims: SessionClaims,
  secret: string,
  ttlSec: number = TOKEN_TTL_SEC,
): string {
  if (secret === '') throw new Error('JWT_SECRET is not configured — refusing to sign a token.');
  return sign({ sub: claims.sub, sid: claims.sid }, secret, {
    algorithm: 'HS256',
    expiresIn: ttlSec,
  });
}

export function verifySessionToken(token: string, secret: string): TokenResult {
  if (secret === '') return { ok: false, reason: 'JWT_SECRET is not configured.' };
  if (!token) return { ok: false, reason: 'No token.' };

  let payload: string | JwtPayload;
  try {
    // `algorithms` is pinned. Without it a token declaring `alg: none`, or one
    // signed with a different family, is accepted — the oldest JWT bug there is.
    payload = verify(token, secret, { algorithms: ['HS256'] });
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'Token is not valid.' };
  }

  if (typeof payload === 'string') return { ok: false, reason: 'Token carries no claims.' };
  const { sub, sid } = payload;
  if (typeof sub !== 'string' || typeof sid !== 'string') {
    return { ok: false, reason: 'Token is missing sub or sid.' };
  }
  return { ok: true, claims: { sub, sid } };
}
