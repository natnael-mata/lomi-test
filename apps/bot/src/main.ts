import { createBot } from './bot.js';

const TOKEN_VAR = 'TELEGRAM_BOT_TOKEN';

function readToken(): string {
  const token = process.env[TOKEN_VAR];
  if (token === undefined || token.trim() === '') {
    console.error(
      `${TOKEN_VAR} is not set. The bot cannot start without it.\n` +
        `Fix: copy .env.example to .env and set ${TOKEN_VAR} to the token from @BotFather.`,
    );
    process.exit(1);
  }
  return token;
}

async function main(): Promise<void> {
  const bot = createBot(readToken());

  // Wiring check: prove config and handlers are valid without opening a
  // long-polling connection to Telegram. Used by the T-007 test so the check
  // is deterministic, needs no live token, and cannot collide with another
  // running instance via getUpdates.
  if (process.argv.includes('--check')) {
    console.log('bot wiring ok');
    return;
  }

  await bot.start({
    onStart: (info) => {
      console.log(`bot listening as @${info.username}`);
    },
  });
}

void main();
