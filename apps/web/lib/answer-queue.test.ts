import { describe, expect, it } from 'vitest';

import {
  QUEUE_VERSION,
  applyQueue,
  dequeue,
  enqueue,
  parseQueue,
  patchOf,
  queueKey,
  replay,
  serialiseQueue,
  type QueuedAnswer,
} from './answer-queue';

describe('the offline outbox (T-131)', () => {
  describe('queueing', () => {
    it('holds an answer made with no network', () => {
      const q = enqueue([], { position: 3, chosenLabel: 'B' });
      expect(q).toEqual([{ position: 3, chosenLabel: 'B' }]);
    });

    it('keeps answers to different questions separately', () => {
      const q = enqueue(enqueue([], { position: 1, chosenLabel: 'A' }), {
        position: 2,
        chosenLabel: 'C',
      });
      expect(q).toHaveLength(2);
    });

    // Four changes of mind are one answer, not four requests.
    it('coalesces repeated changes to the same question', () => {
      let q: QueuedAnswer[] = [];
      for (const label of ['A', 'B', 'C', 'D']) q = enqueue(q, { position: 5, chosenLabel: label });
      expect(q).toEqual([{ position: 5, chosenLabel: 'D' }]);
    });

    /**
     * The bug a naive "last write wins" queue has.
     *
     * Answer B, then flag it, both offline. If the flag replaces the entry the
     * answer is gone, and the student comes back online having lost the one
     * thing they were sure about.
     */
    it('merges a flag into a queued answer instead of replacing it', () => {
      const q = enqueue(enqueue([], { position: 7, chosenLabel: 'B' }), {
        position: 7,
        isFlagged: true,
      });
      expect(q).toEqual([{ position: 7, chosenLabel: 'B', isFlagged: true }]);
    });

    it('merges an answer into a queued flag the same way', () => {
      const q = enqueue(enqueue([], { position: 7, isFlagged: true }), {
        position: 7,
        chosenLabel: 'D',
      });
      expect(q).toEqual([{ position: 7, isFlagged: true, chosenLabel: 'D' }]);
    });

    it('records unflagging rather than dropping the field', () => {
      const q = enqueue(enqueue([], { position: 2, isFlagged: true }), {
        position: 2,
        isFlagged: false,
      });
      expect(q).toEqual([{ position: 2, isFlagged: false }]);
    });

    it('replays roughly in the order the student worked', () => {
      let q: QueuedAnswer[] = [];
      q = enqueue(q, { position: 9, chosenLabel: 'A' });
      q = enqueue(q, { position: 2, chosenLabel: 'B' });
      q = enqueue(q, { position: 9, chosenLabel: 'C' });
      expect(q.map((e) => e.position)).toEqual([9, 2]);
    });

    it('does not mutate the queue it was given', () => {
      const before: QueuedAnswer[] = [{ position: 1, chosenLabel: 'A' }];
      enqueue(before, { position: 1, chosenLabel: 'B' });
      expect(before).toEqual([{ position: 1, chosenLabel: 'A' }]);
    });

    it('clears an entry once the server has it', () => {
      const q = enqueue(enqueue([], { position: 1, chosenLabel: 'A' }), {
        position: 2,
        chosenLabel: 'B',
      });
      expect(dequeue(q, 1)).toEqual([{ position: 2, chosenLabel: 'B' }]);
    });

    it('sends only the fields that changed', () => {
      expect(patchOf({ position: 4, isFlagged: true })).toEqual({ isFlagged: true });
      expect(patchOf({ position: 4, chosenLabel: 'A', isFlagged: false })).toEqual({
        chosenLabel: 'A',
        isFlagged: false,
      });
    });

    /**
     * No client timestamp, ever.
     *
     * A queue that told the server when the student answered would make the
     * deadline unenforceable: answer for an hour after time, claim it happened
     * before. A sync arriving late is refused, for everybody, the same way.
     */
    it('carries nothing the server would have to take on trust', () => {
      const patch = patchOf({ position: 1, chosenLabel: 'A', isFlagged: true });
      expect(Object.keys(patch).sort()).toEqual(['chosenLabel', 'isFlagged']);
    });
  });

  describe('what the screen shows while offline', () => {
    const slots = [
      { position: 1, answered: false, flagged: false },
      { position: 2, answered: true, flagged: false },
      { position: 3, answered: false, flagged: false },
    ];

    /**
     * T-131's stated test, at the grid: answer two questions with the network
     * down and the grid must show them answered. Otherwise the student sees
     * their own work missing and reasonably answers it all again.
     */
    it('shows a queued answer as answered', () => {
      const applied = applyQueue(slots, [
        { position: 1, chosenLabel: 'A' },
        { position: 3, chosenLabel: 'D' },
      ]);
      expect(applied.map((s) => s.answered)).toEqual([true, true, true]);
    });

    it('shows a queued flag as flagged', () => {
      expect(applyQueue(slots, [{ position: 2, isFlagged: true }])[1]!.flagged).toBe(true);
    });

    it('shows a queued unflag as unflagged', () => {
      const flagged = [{ position: 1, answered: true, flagged: true }];
      expect(applyQueue(flagged, [{ position: 1, isFlagged: false }])[0]!.flagged).toBe(false);
    });

    // A queued flag says nothing about whether the question was answered.
    it('leaves what the queue does not mention alone', () => {
      const applied = applyQueue(slots, [{ position: 2, isFlagged: true }]);
      expect(applied[1]!.answered).toBe(true);
      expect(applied[0]).toEqual(slots[0]);
    });

    it('is the server’s own view when nothing is queued', () => {
      expect(applyQueue(slots, [])).toEqual(slots);
    });
  });

  describe('surviving a reload', () => {
    const SITTING = 'sit_abc';

    it('round-trips through storage', () => {
      const entries: QueuedAnswer[] = [
        { position: 1, chosenLabel: 'A' },
        { position: 4, isFlagged: true },
      ];
      expect(parseQueue(serialiseQueue(SITTING, entries), SITTING)).toEqual(entries);
    });

    it('starts empty when there is nothing stored', () => {
      expect(parseQueue(null, SITTING)).toEqual([]);
    });

    /**
     * The dangerous one. Positions line up across papers, so replaying an old
     * sitting's queue would file somebody's answers to a different exam against
     * this one. Refused on the sitting id, not repaired.
     */
    it('refuses a queue belonging to another sitting', () => {
      const other = serialiseQueue('sit_other', [{ position: 1, chosenLabel: 'A' }]);
      expect(parseQueue(other, SITTING)).toEqual([]);
    });

    it('refuses a queue written by an older version', () => {
      const stale = JSON.stringify({
        version: QUEUE_VERSION - 1,
        sittingId: SITTING,
        entries: [{ position: 1, chosenLabel: 'A' }],
      });
      expect(parseQueue(stale, SITTING)).toEqual([]);
    });

    it('survives corrupt storage rather than throwing mid-exam', () => {
      for (const raw of ['', 'not json', '[]', 'null', '{"version":1}', '"a string"']) {
        expect(() => parseQueue(raw, SITTING)).not.toThrow();
        expect(parseQueue(raw, SITTING)).toEqual([]);
      }
    });

    it('drops individual entries that are not answers', () => {
      const mixed = JSON.stringify({
        version: QUEUE_VERSION,
        sittingId: SITTING,
        entries: [
          { position: 1, chosenLabel: 'A' },
          { position: 0, chosenLabel: 'B' },
          { position: 2.5, chosenLabel: 'B' },
          { position: 3, chosenLabel: 99 },
          { position: 4, isFlagged: 'yes' },
          { position: 5 },
          null,
          'nonsense',
        ],
      });
      expect(parseQueue(mixed, SITTING)).toEqual([{ position: 1, chosenLabel: 'A' }]);
    });

    it('keys storage by sitting so two never share a queue', () => {
      expect(queueKey('a')).not.toBe(queueKey('b'));
      expect(queueKey('a')).toContain('a');
    });
  });

  describe('syncing on reconnect', () => {
    const offline = () => Promise.reject(new Error('Failed to fetch'));
    const notClosed = () => false;

    /**
     * T-131's stated test, end to end over the queue: the network goes, two
     * answers are made, the network comes back, both reach the server.
     */
    it('sends everything queued while the network was down', async () => {
      let queue: QueuedAnswer[] = [];
      // Offline: both attempts fail, both stay queued.
      for (const change of [
        { position: 4, chosenLabel: 'B' },
        { position: 9, chosenLabel: 'D' },
      ]) {
        queue = enqueue(queue, change);
        const attempt = await replay(queue, offline, notClosed);
        queue = attempt.remaining;
        expect(attempt.sent).toBe(0);
      }
      expect(queue).toHaveLength(2);

      // Reconnected.
      const seen: [number, unknown][] = [];
      const outcome = await replay(
        queue,
        (position, patch) => {
          seen.push([position, patch]);
          return Promise.resolve();
        },
        notClosed,
      );

      expect(outcome.remaining).toEqual([]);
      expect(outcome.sent).toBe(2);
      expect(seen).toEqual([
        [4, { chosenLabel: 'B' }],
        [9, { chosenLabel: 'D' }],
      ]);
    });

    // A burst at a link that just came back is how you lose the link again.
    it('sends one at a time, in the order the student worked', async () => {
      const order: number[] = [];
      let inFlight = 0;
      await replay(
        [
          { position: 1, chosenLabel: 'A' },
          { position: 2, chosenLabel: 'B' },
          { position: 3, chosenLabel: 'C' },
        ],
        async (position) => {
          expect(inFlight).toBe(0);
          inFlight += 1;
          await Promise.resolve();
          order.push(position);
          inFlight -= 1;
        },
        notClosed,
      );
      expect(order).toEqual([1, 2, 3]);
    });

    it('keeps the rest queued when the link drops again mid-sync', async () => {
      const outcome = await replay(
        [
          { position: 1, chosenLabel: 'A' },
          { position: 2, chosenLabel: 'B' },
          { position: 3, chosenLabel: 'C' },
        ],
        (position) => (position === 2 ? Promise.reject(new Error('down')) : Promise.resolve()),
        notClosed,
      );
      expect(outcome.sent).toBe(1);
      expect(outcome.remaining.map((e) => e.position)).toEqual([2, 3]);
      expect(outcome.closed).toBe(false);
    });

    /**
     * The deadline belongs to the server.
     *
     * If the queue could argue with it, turning off wifi would buy unlimited
     * time — answer for an hour after the bell, reconnect, sync. So a sitting
     * that closed while the answers waited drops them and says so, rather than
     * retrying until something accepts them.
     */
    it('drops the queue rather than retrying once the sitting has closed', async () => {
      const outcome = await replay(
        [
          { position: 1, chosenLabel: 'A' },
          { position: 2, chosenLabel: 'B' },
        ],
        () => Promise.reject(new Error('SITTING_EXPIRED')),
        () => true,
      );
      expect(outcome.closed).toBe(true);
      expect(outcome.remaining).toEqual([]);
      expect(outcome.sent).toBe(0);
    });

    it('does nothing, successfully, with an empty queue', async () => {
      const outcome = await replay([], () => Promise.reject(new Error('never called')), notClosed);
      expect(outcome).toEqual({ remaining: [], sent: 0, closed: false });
    });
  });
});
