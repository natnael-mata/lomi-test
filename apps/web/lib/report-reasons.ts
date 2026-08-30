/**
 * The four reasons a post can be reported, and what to call them (T-268).
 *
 * **One list, because two lists disagree.** The student's picker had the labels
 * and the moderation queue had none — so a student clicked "Off topic" and the
 * operator ruling on it read `OFF_TOPIC`, screaming snake case, underscore and
 * all. That is the stored value leaking through a screen that never got a
 * translation, and the way it stays fixed is for both screens to ask the same
 * function.
 *
 * The wire values are what the API stores and must not change; the labels are
 * what people read.
 */
import type { Copy } from './i18n/dictionary';

export const REPORT_REASONS = ['WRONG', 'ABUSIVE', 'SPAM', 'OFF_TOPIC'] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

/**
 * The human label for a stored reason.
 *
 * Falls back to the raw value rather than to a guess: a reason this build does
 * not know about is a deployment mismatch, and showing it plainly is how
 * somebody notices. It is only ever seen by staff.
 */
export function reasonLabel(reason: string, c: Copy): string {
  switch (reason) {
    case 'WRONG':
      return c.community.reportWrong;
    case 'ABUSIVE':
      return c.community.reportAbusive;
    case 'SPAM':
      return c.community.reportSpam;
    case 'OFF_TOPIC':
      return c.community.reportOffTopic;
    default:
      return reason;
  }
}
