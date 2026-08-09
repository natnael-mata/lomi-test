import { Suspense } from 'react';

import { ReturnScreen } from './ReturnScreen';

export const metadata = { title: 'Payment' };

export default function CheckoutReturnPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-4">
      {/* `useSearchParams` needs a boundary or the whole route opts out of
          static rendering. */}
      <Suspense fallback={null}>
        <ReturnScreen />
      </Suspense>
    </main>
  );
}
