import { StaffOnly } from '../../../components/StaffOnly';
import { ModerationScreen } from './ModerationScreen';

export const metadata = { title: 'Reported posts · admin' };

/**
 * The moderation queue.
 *
 * The API has had `GET /admin/community/reports`, `hide` and `restore` since
 * T-197 with no screen behind them — so a student could report a post, the
 * report was written, and nobody could ever see it. A report queue nobody reads
 * is worse than no report button: it tells a student their complaint went
 * somewhere.
 */
export default function AdminCommunityPage() {
  return (
    <StaffOnly need="ADMIN">
      <ModerationScreen />
    </StaffOnly>
  );
}
