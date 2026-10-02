/**
 * The frame every door shares — sign in, sign up, reset (redesign handoff,
 * 2026-10-01, § Auth).
 *
 * A back arrow, the mark, a step label, a heading and a sentence. The handoff
 * draws it once and uses it on all three screens, and so does this: the three
 * were drifting apart before — sign-in centred its logo and set a `text-title`,
 * the code flow set a bare `h1` with no mark at all and no way back — which is
 * three slightly different front doors to one product.
 *
 * **The way out is the point.** `/signup` and `/reset` had no back control of
 * any kind, so a visitor who opened the wrong one had the browser's own back
 * button and nothing else. On a phone opened from a link there may not be one.
 *
 * Narrow on purpose: 440px, not the 640px student measure. A form of three
 * fields set to 640px on a laptop is three very wide fields, and a wide text
 * input reads as a place to write a paragraph.
 */
import type { ReactNode } from 'react';

import { Icon } from './icons';
import { Logo } from './Logo';
import { copy } from '../lib/i18n';

const c = copy();

export interface AuthShellProps {
  /** Where the arrow goes. The landing page unless something else sent them. */
  back?: string | undefined;
  /** "Step 2 of 3", or nothing on a screen that is not part of a sequence. */
  step?: string | undefined;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}

export function AuthShell({ back = '/', step, title, subtitle, children }: AuthShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col gap-7 py-2">
      <div className="flex items-center justify-between">
        {/* 44px of target around a 20px arrow, pulled back by its own padding so
            the glyph still lines up with the heading below it. */}
        <a
          href={back}
          aria-label={c.auth.back}
          className="text-ink-2 hover:text-ink rounded-control -ml-3 inline-flex min-h-11 min-w-11 items-center justify-center"
        >
          <Icon name="chevronLeft" size={20} />
        </a>
        {/* The mark, not a link. It is here so a screen reached from an SMS
            says whose product it is; `/` is already the arrow to its left, and
            two controls to the same place is one of them wasted. */}
        <Logo size={26} wordmark />
      </div>

      <div className="flex flex-col gap-1.5">
        {step ? <span className="text-caption text-ink-3 uppercase">{step}</span> : null}
        <h1 className="font-display text-[clamp(26px,4vw,30px)] leading-[1.15] font-extrabold tracking-[-0.025em]">
          {title}
        </h1>
        {subtitle ? <p className="text-ink-2 text-[15px] leading-[1.55]">{subtitle}</p> : null}
      </div>

      {children}
    </div>
  );
}
