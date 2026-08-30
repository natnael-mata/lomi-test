import { ReviewScreen } from './ReviewScreen';

export const metadata = { title: 'Your paper' };

/**
 * A paper you sat, read back in full.
 *
 * The id is in the URL rather than in state so the screen is linkable — from
 * the sitting history on `/progress`, and from a student's own bookmarks. The
 * server decides whether the caller may see it; a guessable URL is not a
 * disclosure when the thing behind it is checked.
 */
export default async function ExamReviewPage({
  params,
}: {
  params: Promise<{ sittingId: string }>;
}) {
  const { sittingId } = await params;
  return <ReviewScreen sittingId={sittingId} />;
}
