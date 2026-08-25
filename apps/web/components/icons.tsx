/**
 * Every icon the product draws (design handoff, § Assets).
 *
 * *"Icons: inline stroke SVGs (2px stroke, round caps)."* Inline rather than a
 * package: the whole set below is under 2 KB of markup, and an icon library is a
 * dependency whose tree-shaking you have to trust on a route with a 300 KB
 * budget (T-203). Drawing them here also means the paths in the design file and
 * the paths in the product are the same characters, which is the only way
 * "recreate pixel-perfectly" is checkable.
 *
 * **Icons are decoration, always.** Every one of them sits beside a word —
 * that is the rule the design system rests on (colour and shape never carry
 * meaning alone), so `aria-hidden` is not a prop, it is unconditional. An icon
 * that needed its own accessible name would be an icon that had become the
 * label, which is the thing being prevented.
 */
import type { ReactNode } from 'react';

/** Stroked paths. The default: 2px, round caps, no fill. */
const STROKE: Record<string, ReactNode> = {
  /* The five destinations, in nav order. */
  practise: <path d="M16.5 3.5l4 4L7 21l-4.5 1L3 17.5z" />,
  mock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  progress: <path d="M5 20v-8M12 20V4M19 20v-5" />,
  standing: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M8.5 13.5L7 21l5-3 5 3-1.5-7.5" />
    </>
  ),
  access: (
    <>
      <circle cx="8" cy="16" r="4" />
      <path d="M10.8 13.2L21 3M16 8l3 3" />
    </>
  ),

  /* Verdicts. Never shown without the word beside them. */
  /*
   * A speech bubble, for the community.
   *
   * Drawn on the same 24px grid and the same stroke weight as the rest: an icon
   * borrowed from another set is obvious in a row of five, and the navigation is
   * the one place every icon is seen side by side.
   */
  community: <path d="M21 11.5a7.5 7.5 0 0 1-10.9 6.7L4 20l1.8-5.1A7.5 7.5 0 1 1 21 11.5z" />,
  check: <path d="M4 12l5 5L20 7" />,
  cross: <path d="M6 6l12 12M18 6L6 18" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  star: <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9z" />,

  /* Ways to pay. */
  phone: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="3" />
      <path d="M11 18h2" />
    </>
  ),
  card: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="3" />
      <path d="M2 10h20" />
    </>
  ),
  bank: (
    <>
      <path d="M3 10l9-6 9 6" />
      <path d="M5 10v9M9.5 10v9M14.5 10v9M19 10v9M3 19h18" />
    </>
  ),

  /* Movement and theme. */
  chevronRight: <path d="M9 5l7 7-7 7" />,
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />,
};

/**
 * Filled paths. Only Telegram, and only because Telegram's mark is a solid
 * shape — drawing it as an outline would make it a paper plane rather than
 * *the* paper plane a student recognises on their home screen.
 */
const FILLED: Record<string, ReactNode> = {
  telegram: (
    <path d="M21.5 3.4L2.9 10.6c-1.1.4-1 1.9.1 2.2l4.6 1.4 1.8 5.5c.3 1 1.6 1.2 2.3.4l2.5-2.7 4.7 3.4c.8.6 2 .2 2.2-.8l2.6-14.9c.2-1.1-.9-2-2.2-1.7z" />
  ),
};

export type IconName = keyof typeof STROKE | keyof typeof FILLED;

export interface IconProps {
  name: IconName;
  /** 22 is the nav size; verdicts use 16–20, chips 14. */
  size?: number | undefined;
  /**
   * Heavier for the tick and the cross.
   *
   * A 2px tick beside 15px bold text reads as thinner than the word it belongs
   * to, and the pair then looks like two different weights of the same
   * statement.
   */
  strokeWidth?: number | undefined;
  className?: string | undefined;
}

export function Icon({ name, size = 20, strokeWidth = 2, className }: IconProps) {
  const filled = name in FILLED;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      {...(filled
        ? {}
        : {
            stroke: 'currentColor',
            strokeWidth,
            strokeLinecap: 'round' as const,
            strokeLinejoin: 'round' as const,
          })}
      // Unconditional: see the note at the top of this file.
      aria-hidden="true"
      focusable="false"
      {...(className === undefined ? {} : { className })}
    >
      {filled ? FILLED[name] : STROKE[name]}
    </svg>
  );
}
