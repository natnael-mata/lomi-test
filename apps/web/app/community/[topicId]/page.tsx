import { CommunityScreen } from './CommunityScreen';

export const metadata = { title: 'Discussion' };

export default async function CommunityPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-4">
      <CommunityScreen topicId={topicId} />
    </main>
  );
}
