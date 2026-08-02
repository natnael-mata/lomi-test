/**
 * A card (T-095).
 *
 * DESIGN.md: surface fill, 16px radius, card shadow, 16px padding — and
 * **never nested**. Cards group things that genuinely belong together; a card
 * around a paragraph is a border pretending to be structure, and a card inside a
 * card destroys the one thing the pattern buys, which is a stressed reader
 * seeing where one idea ends.
 *
 * **The nesting rule is not enforced at runtime, deliberately.** The obvious
 * enforcement — a context flag that throws on a nested render — requires
 * `createContext`, which makes this a Client Component. Cards appear on every
 * screen, so that ships a JavaScript boundary to every phone in the product to
 * catch a mistake that only a developer can make and that a reviewer sees
 * instantly. On the low-end Android this app is built for, that is the wrong
 * trade. This stays a zero-JavaScript Server Component, and the rule is enforced
 * where it is broken: in review.
 *
 * For an inner grouping, use a Surface 2 well (`bg-surface-2 rounded-card p-3`).
 */
import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Renders as `<section>` etc. when the card is a landmark rather than a box. */
  as?: 'div' | 'section' | 'article' | undefined;
}

export function cardClasses(className?: string): string {
  return ['card', className].filter(Boolean).join(' ');
}

export function Card({ children, className, as: Tag = 'div', ...rest }: CardProps) {
  return (
    <Tag className={cardClasses(className)} {...rest}>
      {children}
    </Tag>
  );
}
