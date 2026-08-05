import { Bot, InlineKeyboard, type BotConfig } from 'grammy';
import type { Context } from 'grammy';

import {
  APPROVED_TEXT,
  CONFIRM_PREFIX,
  DECLINE_PREFIX,
  DECLINED_TEXT,
  UNUSABLE_TEXT,
  WELCOME_TEXT,
  confirmText,
  type LoginApi,
} from './login.js';

/** The login payload prefix, mirroring `apps/api/src/auth/login-link.ts`. */
const LOGIN_PAYLOAD_PREFIX = 'login_';

/**
 * Wires the bot without contacting Telegram.
 *
 * Kept separate from starting long-polling so that configuration and handler
 * registration can be verified without a network call or a live token — see
 * `main.ts` and the `--check` mode.
 *
 * The bot is deliberately thin: it holds no business logic. Anything that
 * decides *what* a student sees belongs in the API. The sign-in flow (T-076) is
 * the same — the bot relays an identity Telegram gave it and renders a prompt;
 * every decision about whether that identity may have a session is the API's.
 */
export function createBot(token: string, config?: BotConfig<Context>, login?: LoginApi): Bot {
  // `config` exists so tests can supply `botInfo` and dispatch updates without
  // grammY calling getMe over the network. Production passes nothing.
  const bot = new Bot(token, config);

  bot.command('start', async (ctx) => {
    const payload = ctx.match?.toString() ?? '';
    const nonce = payload.startsWith(LOGIN_PAYLOAD_PREFIX)
      ? payload.slice(LOGIN_PAYLOAD_PREFIX.length)
      : '';

    if (!nonce || !login) {
      await ctx.reply(WELCOME_TEXT);
      return;
    }

    try {
      const { pairingCode, deviceLabel } = await login.prompt(nonce);
      await ctx.reply(confirmText(pairingCode, deviceLabel), {
        reply_markup: new InlineKeyboard()
          .text('Yes, that is me', `${CONFIRM_PREFIX}${nonce}`)
          .row()
          .text('No', `${DECLINE_PREFIX}${nonce}`),
      });
    } catch {
      // Expired, used, or never real. One message for all three: a student can
      // do the same thing about each of them, and distinguishing them out loud
      // only tells whoever is holding a stranger's link which kind it is.
      await ctx.reply(UNUSABLE_TEXT);
    }
  });

  bot.callbackQuery(new RegExp(`^${CONFIRM_PREFIX}`), async (ctx) => {
    const nonce = ctx.callbackQuery.data.slice(CONFIRM_PREFIX.length);
    const from = ctx.callbackQuery.from;
    try {
      await login?.approve(nonce, { id: String(from.id), username: from.username });
      await ctx.answerCallbackQuery();
      // Edited rather than appended, so the buttons go with it. A live "Yes"
      // button under a completed sign-in is one a student taps again later.
      await ctx.editMessageText(APPROVED_TEXT);
    } catch {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(UNUSABLE_TEXT);
    }
  });

  bot.callbackQuery(new RegExp(`^${DECLINE_PREFIX}`), async (ctx) => {
    const nonce = ctx.callbackQuery.data.slice(DECLINE_PREFIX.length);
    try {
      await login?.decline(nonce);
    } catch {
      // Declining something already settled is not a failure worth reporting:
      // the student's intent — "do not sign this in" — is satisfied either way.
    }
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(DECLINED_TEXT);
  });

  return bot;
}
