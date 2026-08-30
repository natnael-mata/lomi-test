import { AccountPanel } from './AccountPanel';
import { CheckoutScreen } from './CheckoutScreen';

export const metadata = { title: 'Get full access' };

/**
 * Access is the screen about *this account* — what it reaches and what has been
 * paid for. The panel sits below whichever state the checkout renders (plans,
 * pending claim, or a receipt) rather than inside it, because signing out and
 * seeing your devices must be reachable from all three. Putting it inside meant
 * choosing one.
 */
/*
 * **The panel sits under the checkout, not at the bottom of the window.**
 *
 * `CheckoutScreen` returned `flex-1` in two of its six states — the plan list
 * and the payment-method screen — which inside this column meant "grow to fill
 * whatever height is left". With a second child below it, that height became a
 * gap: roughly 195px of nothing between the payment block and "Where you are
 * signed in", on some accounts and not others depending on which state they
 * landed in. It read as a layout fault because it was one.
 *
 * `flex-1` was right when the checkout was the only thing on the page. It is
 * not any more, and content-height is what a stacked column wants.
 */
export default function CheckoutPage() {
  return (
    <div className="flex flex-col gap-4">
      <CheckoutScreen />
      <AccountPanel />
    </div>
  );
}
