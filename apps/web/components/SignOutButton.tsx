'use client';

/**
 * The way out (T-268).
 *
 * **Deliberately the quietest control on any screen it appears on.** Weight
 * should track how often something is pressed, and this is pressed least — so
 * it is drawn as chrome: ink-2, no fill, no border, an icon beside the word,
 * taking a surface-2 wash only on hover and focus.
 *
 * It was `.btn-ghost`, which is a *form control* — `w-full`, 52px tall, 24px of
 * horizontal padding, a white fill and a hairline border. In the navigation bar
 * that made the rarest action the heaviest object on screen, louder than the six
 * destinations beside it; on `/home` it rendered 343px wide under five
 * destination cards, which reads as a sixth and more important one. `self-start`
 * did not save it, because `w-full` wins.
 *
 * One component rather than the same classes written twice, because the two
 * copies are the same control and the second one is where a redesign forgets to
 * look.
 *
 * Quieter is not smaller: the target stays 44px, and the focus ring is the
 * global `:focus-visible` 2px ink outline, unchanged.
 */
import { Icon } from './icons';
import { api } from '../lib/api';
import { copy } from '../lib/i18n';

export function SignOutButton({ className = '' }: { className?: string }) {
  return (
    <button
      type="button"
      className={`text-ink-2 rounded-control hover:bg-surface-2 hover:text-ink text-caption inline-flex min-h-11 shrink-0 items-center gap-1.5 px-3 transition-[background-color,color] duration-150 ${className}`}
      data-sign-out=""
      onClick={() => {
        void api
          .signOut()
          .catch(() => {})
          /*
           * Leaves either way. The session is over on this device the moment
           * they press it, and a student left staring at the same screen after
           * a failed request cannot act on that — whereas a sign-in screen is
           * something they can. The server-side session is revoked on the next
           * successful call, or expires.
           */
          .finally(() => window.location.assign('/signin'));
      }}
    >
      <Icon name="leave" size={18} />
      {copy().account.signOut}
    </button>
  );
}
