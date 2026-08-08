/**
 * The daily question the bot sends (T-181), and how it says it.
 *
 * The bot decides nothing here. It asks the API for today's batch — which the
 * API has already marked as sent, at-most-once — and renders each one. Anything
 * about who is eligible lives on the other side of `claimDaily`.
 */

export interface DailyQuestion {
  stem: string;
  topic: string;
  options: { label: string; text: string }[];
}

export interface DailyClaim {
  today: string;
  recipients: { userId: string; chatId: string; question: DailyQuestion }[];
  skipped: { userId: string; reason: string }[];
}

export interface BotApi {
  arrival(
    telegram: { id: string; username?: string | undefined },
    chatId: string,
    payload: string,
  ): Promise<{ userId: string; referredVia: string | null; wasFirst: boolean }>;
  optOut(userId: string, optOut: boolean): Promise<{ botOptOut: boolean }>;
  claimDaily(): Promise<DailyClaim>;
}

/**
 * One question, as a message.
 *
 * **No answer, and no scoring.** This is a taste of the bank, not practice: a
 * student who answers here has not attempted anything, and telling them they
 * were right would make it look as though it counted. The action is to open the
 * app, where the attempt is real and the explanation is waiting.
 *
 * The options are lettered rather than bulleted, because that is how they will
 * appear on the paper.
 */
export function dailyMessage(question: DailyQuestion): string {
  const options = question.options.map((o) => `${o.label}. ${o.text}`).join('\n');
  return [
    `Today's question — ${question.topic}`,
    '',
    question.stem,
    '',
    options,
    '',
    'Open Lomi-Test to answer it and see why.',
  ].join('\n');
}

/** What the bot says when somebody turns the daily question off. */
export const OPTED_OUT_TEXT =
  'Daily questions are off. Send /daily to turn them back on whenever you want one.';

/** And when they turn it back on. */
export const OPTED_IN_TEXT = 'Daily questions are on. One a day, and /stop turns them off.';

export interface SendResult {
  sent: number;
  failed: number;
}

/**
 * Sends today's batch.
 *
 * A failure to deliver one message must not stop the rest: a student who has
 * blocked the bot makes Telegram return an error, and one blocked student is
 * not a reason for everybody else to get nothing.
 */
export async function sendDaily(
  claim: DailyClaim,
  send: (chatId: string, text: string) => Promise<unknown>,
): Promise<SendResult> {
  let sent = 0;
  let failed = 0;
  for (const recipient of claim.recipients) {
    try {
      await send(recipient.chatId, dailyMessage(recipient.question));
      sent += 1;
    } catch {
      failed += 1;
    }
  }
  return { sent, failed };
}
