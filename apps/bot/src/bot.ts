import { Bot } from 'grammy';

/**
 * Wires the bot without contacting Telegram.
 *
 * Kept separate from starting long-polling so that configuration and handler
 * registration can be verified without a network call or a live token — see
 * `main.ts` and the `--check` mode.
 *
 * The bot is deliberately thin: it holds no business logic. Anything that
 * decides *what* a student sees belongs in the API.
 */
export function createBot(token: string): Bot {
  const bot = new Bot(token);

  bot.command('start', async (ctx) => {
    await ctx.reply(
      [
        'Lomi-Test — exit exam practice where every answer is explained.',
        '',
        'Practice in the app, and I will send you a question a day.',
      ].join('\n'),
    );
  });

  return bot;
}
