import { Suspense } from 'react';

import { ReturnScreen } from './ReturnScreen';

export const metadata = { title: 'Payment' };

export default function CheckoutReturnPage() {
  // `useSearchParams` needs a boundary or the whole route opts out of static
  // rendering.
  return (
    <Suspense fallback={null}>
      <ReturnScreen />
    </Suspense>
  );
}
