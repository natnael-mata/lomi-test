import { StaffOnly } from '../../../components/StaffOnly';
import { UsersScreen } from './UsersScreen';

export const metadata = { title: 'Students · admin' };

export default function AdminUsersPage() {
  return (
    <StaffOnly need="ADMIN">
      <UsersScreen />
    </StaffOnly>
  );
}
