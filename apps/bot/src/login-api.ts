import type { LoginApi } from './login.js';

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
