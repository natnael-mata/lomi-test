import { StaffOnly } from '../../../components/StaffOnly';
import { ActivityScreen } from './ActivityScreen';

export const metadata = { title: 'Activity · provider' };

export default function ProviderActivityPage() {
  return (
    <StaffOnly need="PROVIDER">
      <ActivityScreen />
    </StaffOnly>
  );
}
