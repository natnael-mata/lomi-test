import { StaffOnly } from '../../../components/StaffOnly';
import { ReviewScreen } from './ReviewScreen';

export const metadata = { title: 'Review · admin' };

export default function AdminReviewPage() {
  return (
    <StaffOnly need="REVIEWER">
      <ReviewScreen />
    </StaffOnly>
  );
}
