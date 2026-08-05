import { createBot } from './bot.js';
import { createLoginApi } from './login-api.js';

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
  // Sign-in wiring is optional at boot: without it the bot still welcomes
  // people and answers everything else, and a login link simply gets the
  // "not usable" reply. Failing to start over a missing sign-in secret would
  // take the whole bot down for a feature most updates never touch.
  const apiBase = process.env.API_BASE_URL ?? '';
  const botSecret = process.env.BOT_SHARED_SECRET ?? '';
  const login = apiBase && botSecret ? createLoginApi(apiBase, botSecret) : undefined;
  if (!login) {
    console.warn(
      'Web sign-in is off: set API_BASE_URL and BOT_SHARED_SECRET to enable /start login links.',
    );
  }

  const bot = createBot(readToken(), undefined, login);

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
