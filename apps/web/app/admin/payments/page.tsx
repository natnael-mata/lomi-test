import { StaffOnly } from '../../../components/StaffOnly';
import { PaymentsScreen } from './PaymentsScreen';

export const metadata = { title: 'Payments · admin' };

export default function AdminPaymentsPage() {
  return (
    <StaffOnly need="ADMIN">
      <PaymentsScreen />
    </StaffOnly>
  );
}
