import type { LoginApi } from './login.js';
import type { BotApi } from './daily.js';

/**
 * The bot's client for the API's login routes (T-076).
 *
 * Thin on purpose. The bot decides nothing about sign-in: it relays an identity
 * Telegram handed it and shows whatever prompt the API describes. Every rule
 * about whether that identity may have a session lives on the other side of
 * this file.
 */
export function createLoginApi(baseUrl: string, sharedSecret: string): LoginApi {
  const call = async (path: string, method: 'GET' | 'POST', body?: unknown): Promise<unknown> => {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        // The bot is a server, not a student: no session, a shared secret.
        'x-bot-secret': sharedSecret,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!res.ok) {
      // The caller turns any failure into one message for the student, so the
      // reason is carried for logs rather than for display.
      throw new Error(`${method} ${path} → ${res.status}`);
    }
    return res.json();
  };

  return {
    prompt: (nonce) =>
      call(`/auth/login-link/${encodeURIComponent(nonce)}/prompt`, 'GET') as Promise<{
        pairingCode: string;
        deviceLabel: string | null;
      }>,
    approve: (nonce, telegram) =>
      call(`/auth/login-link/${encodeURIComponent(nonce)}/approve`, 'POST', {
        telegramId: telegram.id,
        telegramUsername: telegram.username,
      }) as Promise<{ pairingCode: string }>,
    decline: async (nonce) => {
      await call(`/auth/login-link/${encodeURIComponent(nonce)}/decline`, 'POST', {});
    },
  };
}

/** The routes behind `/bot`, for arrivals, opt-out and the daily job. */
export function createBotApi(baseUrl: string, sharedSecret: string): BotApi {
  const post = async (path: string, body: unknown): Promise<unknown> => {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-bot-secret': sharedSecret },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
    return res.json();
  };

  return {
    arrival: (telegram, chatId, payload) =>
      post('/bot/arrival', {
        telegramId: telegram.id,
        telegramUsername: telegram.username,
        chatId,
        payload,
      }) as Promise<{ userId: string; referredVia: string | null; wasFirst: boolean }>,
    optOut: (userId, optOut) =>
      post('/bot/opt-out', { userId, optOut }) as Promise<{ botOptOut: boolean }>,
    claimDaily: () => post('/bot/daily/claim', {}) as Promise<import('./daily.js').DailyClaim>,
  };
}
