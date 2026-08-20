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
export default function CheckoutPage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <CheckoutScreen />
      <AccountPanel />
    </div>
  );
}
