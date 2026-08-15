import { CommunityScreen } from './CommunityScreen';

export const metadata = { title: 'Discussion' };

export default async function CommunityPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  return <CommunityScreen topicId={topicId} />;
}
