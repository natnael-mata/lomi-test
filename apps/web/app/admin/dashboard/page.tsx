import { StaffOnly } from '../../../components/StaffOnly';
import { Dashboard } from './Dashboard';

export const metadata = { title: 'Overview · admin' };

export default function AdminDashboardPage() {
  return (
    <StaffOnly need="ADMIN">
      <Dashboard />
    </StaffOnly>
  );
}
