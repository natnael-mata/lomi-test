import { StaffOnly } from '../../../components/StaffOnly';
import { WeightEditor } from './WeightEditor';

export const metadata = { title: 'Topic weights · admin' };

export default function AdminWeightsPage() {
  return (
    <StaffOnly need="ADMIN">
      <WeightEditor />
    </StaffOnly>
  );
}
