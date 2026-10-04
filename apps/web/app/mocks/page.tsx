import { MocksScreen } from './MocksScreen';

export const metadata = { title: 'Mock exams' };

/**
 * Mocks: the next paper and the past ones (redesign step 8). It replaced a
 * redirect to `/exam`. See `MocksScreen`.
 */
export default function MocksPage() {
  return <MocksScreen />;
}
