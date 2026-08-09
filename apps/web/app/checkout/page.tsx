import { CheckoutScreen } from './CheckoutScreen';

export const metadata = { title: 'Get full access' };

export default function CheckoutPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-4">
      <CheckoutScreen />
    </main>
  );
}
