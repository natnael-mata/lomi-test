import { StaffOnly } from '../../../components/StaffOnly';
import { HealthScreen } from './HealthScreen';

export const metadata = { title: 'Health · provider' };

export default function ProviderHealthPage() {
  return (
    <StaffOnly need="PROVIDER">
      <HealthScreen />
    </StaffOnly>
  );
}
