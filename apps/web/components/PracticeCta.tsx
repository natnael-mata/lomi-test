/**
 * The practice call to action every analytics view ends with (T-139).
 *
 * DESIGN.md: "Every statement ends in a practice action." A screen that tells a
 * student they are 54% ready and stops has diagnosed them and left. The whole
 * point of the number is what to do about it, so the link is part of the
 * statement rather than something to go and find.
 *
 * **The href carries the topic's id, not its name.** Names are display strings —
 * they get renamed, they collide across fields, and they arrive with Ethiopic
 * characters that a hand-built query string mangles. The id is the thing that
 * still resolves next term.
 */
import { Button } from './Button';
import { copy } from '../lib/i18n';

export interface PracticeCtaProps {
  /** The topic to practise, or `null` when there is nothing to recommend. */
  topicId: string | null;
  topicName: string | null;
}

/** Where practice on one topic lives. One definition, so every CTA agrees. */
export function practiceHref(topicId: string): string {
  return `/practice?topic=${encodeURIComponent(topicId)}`;
}

export function PracticeCta({ topicId, topicName }: PracticeCtaProps) {
  const c = copy();

  // Nothing to recommend yet — but the action is still offered, because a
  // student who has answered nothing is exactly the one who should be
  // practising. It just does not pretend to know what.
  if (!topicId || !topicName) {
    return (
      <a href="/practice" data-practice-cta="" data-topic="">
        <Button className="w-full">{c.practice.startPractising}</Button>
      </a>
    );
  }

  return (
    <a href={practiceHref(topicId)} data-practice-cta="" data-topic={topicId}>
      <Button className="w-full">{c.practice.practiseTopic(topicName)}</Button>
    </a>
  );
}
