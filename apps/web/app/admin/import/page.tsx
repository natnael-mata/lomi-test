import { StaffOnly } from '../../../components/StaffOnly';
import { ImportScreen } from './ImportScreen';

export const metadata = { title: 'Upload questions · admin' };

export default function AdminImportPage() {
  return (
    <StaffOnly need="ADMIN">
      <ImportScreen />
    </StaffOnly>
  );
}
