/**
 * The bot's half of the web sign-in (T-076).
 *
 * The confirmation step is a security control, not a courtesy, so it is tested
 * as one: the API is never told an identity until a student has tapped Yes, and
 * tapping No settles the request rather than merely closing the message.
 */
import type { Update, UserFromGetMe } from 'grammy/types';
import { beforeEach, describe, expect, it } from 'vitest';

import { createBot } from './bot.js';
import { CONFIRM_PREFIX, DECLINE_PREFIX, confirmText, type LoginApi } from './login.js';

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

const STUDENT = { id: 42, is_bot: false as const, first_name: 'Student', username: 'student42' };

function startUpdate(payload: string): Update {
  const text = payload ? `/start ${payload}` : '/start';
  return {
    update_id: 1,
    message: {
      message_id: 1,
      date: 0,
      chat: { id: 42, type: 'private', first_name: 'Student' },
      from: STUDENT,
      text,
      entities: [{ type: 'bot_command', offset: 0, length: 6 }],
    },
  };
}

function callbackUpdate(data: string): Update {
  return {
    update_id: 2,
    callback_query: {
      id: 'cb1',
      from: STUDENT,
      chat_instance: 'ci',
      data,
      message: {
        message_id: 1,
        date: 0,
        chat: { id: 42, type: 'private', first_name: 'Student' },
        text: 'prompt',
      },
    },
  } as Update;
}

/** Records what the API was asked to do, and what went out to Telegram. */
function harness(api: Partial<LoginApi> = {}) {
  const calls: { method: string; text: string | undefined; markup: unknown }[] = [];
  const seen = { prompted: [] as string[], approved: [] as unknown[], declined: [] as string[] };

  const login: LoginApi = {
    prompt: async (nonce) => {
      seen.prompted.push(nonce);
      return api.prompt
        ? api.prompt(nonce)
        : { pairingCode: '314', deviceLabel: 'Firefox on Linux' };
    },
    approve: async (nonce, telegram) => {
      seen.approved.push({ nonce, telegram });
      return api.approve ? api.approve(nonce, telegram) : { pairingCode: '314' };
    },
    decline: async (nonce) => {
      seen.declined.push(nonce);
      if (api.decline) await api.decline(nonce);
    },
  };

  const bot = createBot('123456:TEST-TOKEN', { botInfo: BOT_INFO }, login);
  bot.api.config.use((_prev, method, payload) => {
    const body = payload as Record<string, unknown> | undefined;
    calls.push({
      method,
      text: typeof body?.text === 'string' ? body.text : undefined,
      markup: body?.reply_markup,
    });
    return Promise.resolve({ ok: true, result: true } as never);
  });

  const sent = () => calls.filter((c) => c.method === 'sendMessage');
  const edited = () => calls.filter((c) => c.method === 'editMessageText');
  return { bot, calls, seen, sent, edited };
}

describe('signing in from the web (T-076)', () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness();
  });

  it('asks for confirmation on a login deep link', async () => {
    await h.bot.handleUpdate(startUpdate('login_abc123'));
    expect(h.seen.prompted).toEqual(['abc123']);
    expect(h.sent()).toHaveLength(1);
    expect(h.sent()[0]?.text).toContain('314');
    expect(h.sent()[0]?.markup).toBeDefined();
  });

  /**
   * The whole point of the step. Until a student taps Yes, the API has not been
   * told who is signing in — so a forwarded link, opened and ignored, produces
   * nothing.
   */
  it('tells the API nothing until the student confirms', async () => {
    await h.bot.handleUpdate(startUpdate('login_abc123'));
    expect(h.seen.approved).toEqual([]);
    expect(h.seen.declined).toEqual([]);
  });

  it('approves with the Telegram identity Telegram supplied', async () => {
    await h.bot.handleUpdate(startUpdate('login_abc123'));
    await h.bot.handleUpdate(callbackUpdate(`${CONFIRM_PREFIX}abc123`));
    expect(h.seen.approved).toEqual([
      { nonce: 'abc123', telegram: { id: '42', username: 'student42' } },
    ]);
  });

  it('declines when the student says it was not them', async () => {
    await h.bot.handleUpdate(startUpdate('login_abc123'));
    await h.bot.handleUpdate(callbackUpdate(`${DECLINE_PREFIX}abc123`));
    expect(h.seen.declined).toEqual(['abc123']);
    expect(h.seen.approved).toEqual([]);
  });

  /**
   * The message is edited, not replied to, so the buttons go with it. A live
   * "Yes" sitting under a completed sign-in is one a student taps again a week
   * later, wondering why nothing happens.
   */
  it('replaces the prompt rather than leaving the buttons live', async () => {
    await h.bot.handleUpdate(startUpdate('login_abc123'));
    await h.bot.handleUpdate(callbackUpdate(`${CONFIRM_PREFIX}abc123`));
    expect(h.edited()).toHaveLength(1);
    expect(h.edited()[0]?.text).toContain('Signed in');
  });

  it('says plainly that a decline signed nothing in', async () => {
    await h.bot.handleUpdate(callbackUpdate(`${DECLINE_PREFIX}abc123`));
    expect(h.edited()[0]?.text).toContain('Nothing was signed in');
  });

  describe('links that cannot be used', () => {
    /**
     * One message for expired, used and never-real alike. A student can do the
     * same thing about all three, and telling them apart out loud only informs
     * whoever is holding a stranger's link which kind they have.
     */
    it('says the same thing whatever the reason', async () => {
      const failing = harness({
        prompt: () => Promise.reject(new Error('gone')),
      });
      await failing.bot.handleUpdate(startUpdate('login_dead'));
      expect(failing.sent()[0]?.text).toContain('run out or has already been used');
      expect(failing.sent()[0]?.markup).toBeUndefined();
    });

    it('does not crash when the API refuses an approval', async () => {
      const failing = harness({ approve: () => Promise.reject(new Error('gone')) });
      await failing.bot.handleUpdate(callbackUpdate(`${CONFIRM_PREFIX}dead`));
      expect(failing.edited()[0]?.text).toContain('run out or has already been used');
    });

    /**
     * Declining something already settled is not a failure worth reporting: the
     * student's intent — do not sign this in — is satisfied either way.
     */
    it('still says nothing was signed in when the decline errors', async () => {
      const failing = harness({ decline: () => Promise.reject(new Error('gone')) });
      await failing.bot.handleUpdate(callbackUpdate(`${DECLINE_PREFIX}dead`));
      expect(failing.edited()[0]?.text).toContain('Nothing was signed in');
    });
  });

  describe('a plain /start is still a welcome', () => {
    /**
     * `/start` is how people meet the bot and how referral links arrive (T-180),
     * so a login-shaped reply to every `/start` would be wrong far more often
     * than right.
     */
    it('welcomes a first-time visitor', async () => {
      await h.bot.handleUpdate(startUpdate(''));
      expect(h.sent()[0]?.text).toContain('exit exam practice');
      expect(h.seen.prompted).toEqual([]);
    });

    it('ignores a payload that is not a login', async () => {
      await h.bot.handleUpdate(startUpdate('amb_123'));
      expect(h.seen.prompted).toEqual([]);
      expect(h.sent()[0]?.text).toContain('exit exam practice');
    });
  });

  describe('what the prompt says', () => {
    it('shows the pairing code so there is something to check against', () => {
      expect(confirmText('314', 'Firefox on Linux')).toContain('314');
    });

    it('names where the sign-in came from when it knows', () => {
      expect(confirmText('314', 'Firefox on Linux')).toContain('Firefox on Linux');
      expect(confirmText('314', null)).not.toContain('undefined');
    });

    // The line that does the work: it tells somebody who was not expecting this
    // what to do, which is the case the whole step exists for.
    it('tells a student what to do if they were not signing in', () => {
      const text = confirmText('314', null);
      expect(text).toContain('were not signing in');
      expect(text).toContain('nothing happens');
    });
  });
});
