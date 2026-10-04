import { AccountScreen } from './AccountScreen';

export const metadata = { title: 'Account' };

/**
 * Account (redesign step 10). It replaced a redirect to `/checkout`, where the
 * device list sat under the plans. See `AccountScreen`.
 */
export default function AccountPage() {
  return <AccountScreen />;
}
