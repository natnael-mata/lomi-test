/**
 * The daily question as the bot sends it (T-181, T-182).
 *
 * The eligibility rules live in the API and are tested there. What is checked
 * here is what the bot does with a batch it has been handed.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  OPTED_IN_TEXT,
  OPTED_OUT_TEXT,
  dailyMessage,
  sendDaily,
  type DailyClaim,
} from './daily.js';

const QUESTION = {
  stem: 'Which of these is a current asset?',
  topic: 'Financial Accounting',
  options: [
    { label: 'A', text: 'Goodwill' },
    { label: 'B', text: 'Inventory' },
    { label: 'C', text: 'Land' },
    { label: 'D', text: 'Patents' },
  ],
};

const claim = (n: number): DailyClaim => ({
  today: '2026-08-08',
  recipients: Array.from({ length: n }, (_, i) => ({
    userId: `u${i}`,
    chatId: String(900 + i),
    question: QUESTION,
  })),
  skipped: [],
});

describe('the daily message', () => {
  it('carries the question and its topic', () => {
    const text = dailyMessage(QUESTION);
    expect(text).toContain('Financial Accounting');
    expect(text).toContain('Which of these is a current asset?');
  });

  it('letters the options the way the paper will', () => {
    const text = dailyMessage(QUESTION);
    expect(text).toContain('A. Goodwill');
    expect(text).toContain('D. Patents');
  });

  /**
   * No answer and no scoring. This is a taste of the bank, not practice: a
   * student who answers here has attempted nothing, and marking it would make it
   * look as though it counted.
   */
  it('gives away neither the answer nor a verdict', () => {
    const text = dailyMessage(QUESTION);
    for (const banned of ['correct', 'Correct', 'answer is', 'B is', 'Well done']) {
      expect(text, banned).not.toContain(banned);
    }
  });

  it('ends by pointing at the app, where the attempt is real', () => {
    expect(dailyMessage(QUESTION)).toContain('Open Lomi-Test to answer it');
  });
});

describe('sending the batch', () => {
  it('sends one message per recipient', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const result = await sendDaily(claim(3), send);
    expect(send).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ sent: 3, failed: 0 });
  });

  it('sends each one to its own chat', async () => {
    const chats: string[] = [];
    await sendDaily(claim(2), (chatId) => {
      chats.push(chatId);
      return Promise.resolve();
    });
    expect(chats).toEqual(['900', '901']);
  });

  /**
   * One blocked student is not a reason for everybody else to get nothing.
   * Telegram returns an error for a chat the bot has been blocked in, and that
   * is an ordinary daily occurrence rather than a failed run.
   */
  it('keeps going when one delivery fails', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('blocked'))
      .mockResolvedValueOnce(undefined);
    const result = await sendDaily(claim(3), send);
    expect(result).toEqual({ sent: 2, failed: 1 });
  });

  it('does nothing, successfully, with an empty batch', async () => {
    const send = vi.fn();
    expect(await sendDaily(claim(0), send)).toEqual({ sent: 0, failed: 0 });
    expect(send).not.toHaveBeenCalled();
  });
});

describe('opting out (T-182)', () => {
  // Says how to come back. An off switch with no on switch reads as permanent,
  // and the student who wanted a quieter week uninstalls instead.
  it('tells a student how to turn it back on', () => {
    expect(OPTED_OUT_TEXT).toContain('/daily');
  });

  it('tells a student how to turn it off', () => {
    expect(OPTED_IN_TEXT).toContain('/stop');
  });

  it('neither message blames anybody for choosing', () => {
    for (const text of [OPTED_OUT_TEXT, OPTED_IN_TEXT]) {
      for (const banned of ['miss out', 'sure?', 'sorry', 'shame']) {
        expect(text.toLowerCase(), banned).not.toContain(banned);
      }
    }
  });
});
