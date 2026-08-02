/**
 * A chip (T-095).
 *
 * Surface 2 and a full pill by default; a state chip takes the soft fill and the
 * text colour of its state. The tones are the semantic ones — DESIGN.md is
 * explicit that these are never remapped, not even inside Telegram, because a
 * student learning that green means correct must not meet a green that means
 * something else two screens later.
 */
import type { HTMLAttributes, ReactNode } from 'react';

export type ChipTone = 'neutral' | 'correct' | 'wrong' | 'pending' | 'brand' | 'reward';

const TONE_CLASS: Record<ChipTone, string> = {
  neutral: '',
  correct: 'bg-correct-soft text-correct',
  wrong: 'bg-wrong-soft text-wrong',
  pending: 'bg-pending-soft text-pending',
  brand: 'bg-brand-soft text-brand',
  reward: 'bg-reward-fill text-on-reward',
};

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  tone?: ChipTone | undefined;
}

export function chipClasses(tone: ChipTone = 'neutral', className?: string): string {
  return ['chip', TONE_CLASS[tone], className].filter(Boolean).join(' ');
}

export function Chip({ children, tone = 'neutral', className, ...rest }: ChipProps) {
  return (
    <span className={chipClasses(tone, className)} {...rest}>
      {children}
    </span>
  );
}
