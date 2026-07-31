import type { Update, UserFromGetMe } from 'grammy/types';
import { describe, expect, it } from 'vitest';

import { createBot } from './bot.js';

/** Supplied so grammY never calls getMe — the test must not touch the network. */
const BOT_INFO: UserFromGetMe = {
  id: 1,
  is_bot: true,
  first_name: 'Lomi-Test',
  username: 'lomi_test_bot',
  can_join_groups: false,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
  has_topics_enabled: false,
  allows_users_to_create_topics: false,
  can_manage_bots: false,
  supports_join_request_queries: false,
};

function startUpdate(): Update {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      date: 0,
      chat: { id: 42, type: 'private', first_name: 'Student' },
      from: { id: 42, is_bot: false, first_name: 'Student' },
      text: '/start',
      entities: [{ type: 'bot_command', offset: 0, length: 6 }],
    },
  };
}

describe('bot', () => {
  it('registers a /start handler that replies', async () => {
    const bot = createBot('123456:TEST-TOKEN', { botInfo: BOT_INFO });

    // Intercept outbound API calls instead of letting them reach Telegram.
    const calls: { method: string; text?: string }[] = [];
    bot.api.config.use((_prev, method, payload) => {
      const text =
        typeof payload === 'object' && payload !== null && 'text' in payload
          ? String((payload as { text: unknown }).text)
          : undefined;
      calls.push(text === undefined ? { method } : { method, text });
      return Promise.resolve({ ok: true, result: true } as never);
    });

    await bot.handleUpdate(startUpdate());

    const sent = calls.filter((c) => c.method === 'sendMessage');
    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toContain('Lomi-Test');
  });
});
