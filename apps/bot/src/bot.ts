import { Bot, InlineKeyboard, Keyboard, type BotConfig } from 'grammy';
import type { Context } from 'grammy';

import { OPTED_IN_TEXT, OPTED_OUT_TEXT, type BotApi } from './daily.js';
import {
  ASK_BUTTON,
  ASK_TEXT,
  NOT_OWN_TEXT,
  NO_NUMBER_TEXT,
  acceptedText,
  verifiedContact,
} from './contact.js';
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
export function createBot(
  token: string,
  config?: BotConfig<Context>,
  login?: LoginApi,
  api?: BotApi,
): Bot {
  // `config` exists so tests can supply `botInfo` and dispatch updates without
  // grammY calling getMe over the network. Production passes nothing.
  const bot = new Bot(token, config);

  bot.command('start', async (ctx) => {
    const payload = ctx.match?.toString() ?? '';

    /*
     * Attribution happens at FIRST CONTACT, before anything else (T-180).
     *
     * Somebody arriving on a referral link has never signed in, so there is no
     * later moment to record it: if this is skipped because the payload turned
     * out to be a login nonce, or because the reply failed, the referral is lost
     * and an ambassador is not paid for work they did.
     *
     * Failures are swallowed for the same reason the welcome still sends: a
     * student's first impression of the product must not be an error because a
     * bookkeeping call timed out.
     */
    const from = ctx.from;
    if (api && from) {
      try {
        await api.arrival(
          { id: String(from.id), username: from.username },
          String(ctx.chat?.id ?? from.id),
          payload,
        );
      } catch {
        // Logged by the caller; never shown to the student.
      }
    }

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

  /*
   * Turning the daily question off and on (T-182).
   *
   * Two plain commands rather than a settings screen: the student is already in
   * a chat, and the shortest path to "stop messaging me" is the one that keeps
   * somebody from blocking the bot outright.
   */
  bot.command('stop', async (ctx) => {
    const from = ctx.from;
    if (!api || !from) return;
    try {
      const { userId } = await api.arrival(
        { id: String(from.id), username: from.username },
        String(ctx.chat?.id ?? from.id),
        '',
      );
      await api.optOut(userId, true);
      await ctx.reply(OPTED_OUT_TEXT);
    } catch {
      await ctx.reply(UNUSABLE_TEXT);
    }
  });

  bot.command('daily', async (ctx) => {
    const from = ctx.from;
    if (!api || !from) return;
    try {
      const { userId } = await api.arrival(
        { id: String(from.id), username: from.username },
        String(ctx.chat?.id ?? from.id),
        '',
      );
      await api.optOut(userId, false);
      await ctx.reply(OPTED_IN_TEXT);
    } catch {
      await ctx.reply(UNUSABLE_TEXT);
    }
  });

  /*
   * The number a payment request goes to (T-078a).
   *
   * Asked for **at checkout, not at sign-up** — a permission prompt before
   * somebody has seen anything worth paying for is a prompt they decline; asked
   * at the moment it has a purpose, it is a button that saves them typing. The
   * web checkout links here with `?start=pay`, and `/pay` is the same thing for
   * anyone who reaches the bot directly.
   */
  const askForNumber = async (ctx: Context): Promise<void> => {
    await ctx.reply(ASK_TEXT, {
      reply_markup: new Keyboard().requestContact(ASK_BUTTON).oneTime().resized(),
    });
  };

  bot.command('pay', askForNumber);

  bot.on('message:contact', async (ctx) => {
    const outcome = verifiedContact({
      from: ctx.from ? { id: ctx.from.id } : undefined,
      contact: ctx.message.contact,
    });

    if (!outcome.ok) {
      // Worded as a mistake rather than an accusation: sharing the wrong
      // contact is one tap away from sharing the right one.
      await ctx.reply(outcome.reason === 'no-number' ? NO_NUMBER_TEXT : NOT_OWN_TEXT, {
        reply_markup: { remove_keyboard: true },
      });
      return;
    }

    const from = ctx.from;
    if (!api || !from) return;

    try {
      const result = await api.contact({
        telegramId: String(from.id),
        // Sent separately rather than as a single "trust me" flag: the API
        // compares them itself, so a bug in the check above cannot write an
        // arbitrary number into a column that says verified.
        contactUserId: String(ctx.message.contact.user_id ?? ''),
        phone: outcome.phone,
      });

      await ctx.reply(result.stored ? acceptedText(outcome.phone) : UNUSABLE_TEXT, {
        reply_markup: { remove_keyboard: true },
      });
    } catch {
      await ctx.reply(UNUSABLE_TEXT, { reply_markup: { remove_keyboard: true } });
    }
  });

  return bot;
}
