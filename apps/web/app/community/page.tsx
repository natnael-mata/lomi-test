import { CommunityIndex } from './CommunityIndex';

export const metadata = { title: 'Ask' };

/**
 * The community index — the student's own programme's topics.
 *
 * `/community/[topicId]` had no way in but a URL. See `CommunityIndex` for why
 * the list is built from the readiness response rather than a new endpoint.
 */
export default function CommunityPage() {
  return <CommunityIndex />;
}
