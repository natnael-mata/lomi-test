import { redirect } from 'next/navigation';

/**
 * Account (redesign step 10).
 *
 * A redirect to checkout, which is where the device list and the access state
 * currently live and where Account will absorb them from. See `today/page.tsx`.
 */
export default function AccountPage(): never {
  redirect('/checkout');
}
