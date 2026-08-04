/**
 * The offline outbox for a sitting (T-131).
 *
 * A student on Ethiopian mobile data will lose the connection during a
 * three-hour mock. Not "might" — will. The only acceptable behaviour is that
 * they keep answering and nothing is lost, so every change is written to a local
 * queue first and sent when the network comes back.
 *
 * Two decisions worth stating, because both have an obvious wrong answer:
 *
 * 1. **Coalesced per question, merged not replaced.** Changing an answer four
 *    times offline should sync once, not four times — the intermediate states
 *    are not facts about anything. But a queued flag and a queued choice for the
 *    same question are *different fields*, and a naive "last write wins" drops
 *    one of them. So entries merge field-by-field.
 *
 * 2. **The queue never carries a timestamp the server is asked to trust.** It is
 *    tempting to record when the student answered and have the server honour
 *    that on sync, and it would make the deadline unenforceable — anyone could
 *    answer for an hour after time and claim it happened before. A sync that
 *    arrives after the deadline is refused, and the screen says so. That is the
 *    honest failure, and it is the same rule for everybody.
 *
 * Pure: no storage, no fetch, no clock. The screen owns those.
 */

export interface QueuedAnswer {
  position: number;
  chosenLabel?: string;
  isFlagged?: boolean;
}

/** What actually goes over the wire for one question. */
export type AnswerPatch = Omit<QueuedAnswer, 'position'>;

export const QUEUE_VERSION = 1;

export interface StoredQueue {
  version: number;
  sittingId: string;
  entries: QueuedAnswer[];
}

/**
 * Adds a change to the queue, merging with anything already waiting for that
 * question.
 *
 * Order is preserved by position of *first* entry: a question queued early stays
 * early, so the sync replays roughly in the order the student worked. Returns a
 * new array — the caller stores the result rather than the queue mutating under
 * a React render.
 */
export function enqueue(queue: readonly QueuedAnswer[], change: QueuedAnswer): QueuedAnswer[] {
  const index = queue.findIndex((e) => e.position === change.position);
  if (index === -1) return [...queue, { ...change }];

  const next = [...queue];
  // Field-by-field, so a flag queued after a choice does not erase the choice.
  next[index] = { ...next[index]!, ...change };
  return next;
}

/** Removes a question's entry, once the server has accepted it. */
export function dequeue(queue: readonly QueuedAnswer[], position: number): QueuedAnswer[] {
  return queue.filter((e) => e.position !== position);
}

/** The patch to send for one entry: everything except which question it is. */
export function patchOf(entry: QueuedAnswer): AnswerPatch {
  const patch: AnswerPatch = {};
  if (entry.chosenLabel !== undefined) patch.chosenLabel = entry.chosenLabel;
  if (entry.isFlagged !== undefined) patch.isFlagged = entry.isFlagged;
  return patch;
}

/**
 * Applies the queue over what the server last said, so the screen shows the
 * student's own work rather than the stale server copy while offline.
 *
 * Without this, answering offline and navigating away and back would show the
 * question as unanswered — the answer is safe in the queue, but the student has
 * no way to know that, and the reasonable thing for them to do is answer it
 * again.
 */
export function applyQueue<T extends { position: number; answered: boolean; flagged: boolean }>(
  slots: readonly T[],
  queue: readonly QueuedAnswer[],
): T[] {
  const byPosition = new Map(queue.map((e) => [e.position, e]));
  return slots.map((slot) => {
    const pending = byPosition.get(slot.position);
    if (!pending) return slot;
    return {
      ...slot,
      answered: pending.chosenLabel !== undefined ? true : slot.answered,
      flagged: pending.isFlagged !== undefined ? pending.isFlagged : slot.flagged,
    };
  });
}

/**
 * Reads a stored queue, refusing anything that is not this sitting's.
 *
 * A queue left over from a previous sitting must never be replayed into a new
 * one: the positions would line up and the answers would be somebody's work on a
 * different paper. Version, shape and sitting id are all checked, and anything
 * unrecognised is discarded rather than repaired.
 */
export function parseQueue(raw: string | null, sittingId: string): QueuedAnswer[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (typeof parsed !== 'object' || parsed === null) return [];

  const stored = parsed as Partial<StoredQueue>;
  if (stored.version !== QUEUE_VERSION) return [];
  if (stored.sittingId !== sittingId) return [];
  if (!Array.isArray(stored.entries)) return [];

  return stored.entries.filter(isQueuedAnswer).map((e) => ({ ...e }));
}

export function serialiseQueue(sittingId: string, entries: readonly QueuedAnswer[]): string {
  const stored: StoredQueue = { version: QUEUE_VERSION, sittingId, entries: [...entries] };
  return JSON.stringify(stored);
}

function isQueuedAnswer(value: unknown): value is QueuedAnswer {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  if (typeof entry.position !== 'number' || !Number.isInteger(entry.position)) return false;
  if (entry.position < 1) return false;
  if (entry.chosenLabel !== undefined && typeof entry.chosenLabel !== 'string') return false;
  if (entry.isFlagged !== undefined && typeof entry.isFlagged !== 'boolean') return false;
  // An entry with neither field says nothing and would sync an empty patch.
  return entry.chosenLabel !== undefined || entry.isFlagged !== undefined;
}

/** Where a sitting's queue lives. Keyed by sitting so two never mix. */
export const queueKey = (sittingId: string): string => `lomi.sitting.outbox.${sittingId}`;

export interface ReplayOutcome {
  /** What is still waiting — empty when everything went through. */
  remaining: QueuedAnswer[];
  /** How many the server accepted this time round. */
  sent: number;
  /** Set when the sitting turned out to be closed. Nothing more will be sent. */
  closed: boolean;
}

/**
 * Replays the outbox against the server, oldest first.
 *
 * **Sequential, and it stops at the first failure.** The entries are the
 * student's own work in the order they did it, and firing a hundred requests at
 * a link that has only just come back is how you lose the link again. Stopping
 * on the first failure leaves the rest queued rather than hammering a network
 * that is still down — the next `online` event, or the next answer, tries again.
 *
 * `isClosed` is asked about the error rather than the caller matching on codes
 * here: a sitting that closed while the answers sat in the queue means they are
 * genuinely too late. The deadline belongs to the server, and a queue that could
 * argue with it would make the deadline optional for anyone willing to turn off
 * their wifi. Those entries are dropped, not retried.
 */
export async function replay(
  entries: readonly QueuedAnswer[],
  send: (position: number, patch: AnswerPatch) => Promise<unknown>,
  isClosed: (error: unknown) => boolean,
): Promise<ReplayOutcome> {
  let remaining = [...entries];
  let sent = 0;

  for (const entry of entries) {
    try {
      await send(entry.position, patchOf(entry));
      remaining = dequeue(remaining, entry.position);
      sent += 1;
    } catch (error) {
      if (isClosed(error)) return { remaining: [], sent, closed: true };
      return { remaining, sent, closed: false };
    }
  }

  return { remaining, sent, closed: false };
}
