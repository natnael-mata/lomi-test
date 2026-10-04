import { CheckoutScreen } from './CheckoutScreen';

export const metadata = { title: 'Get full access' };

/**
 * Plans and payment. The device list and sign out that used to sit below the
 * checkout moved to Account in the redesign (step 10): this page is about
 * buying access, and Account is about the account.
 */
export default function CheckoutPage() {
  return <CheckoutScreen />;
}
