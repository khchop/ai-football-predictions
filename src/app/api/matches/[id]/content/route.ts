import { NextResponse } from 'next/server';
import { getMatchContentUnified } from '@/lib/db/queries';
import { getMatchPreview } from '@/lib/content/queries';

/**
 * GET /api/matches/[id]/content
 *
 * Returns narrative content (pre-match and post-match) and preview data for a match.
 * Used by MatchNarrative component for client-side content fetching.
 *
 * Response:
 * - 200: { preMatchContent: string | null, postMatchContent: string | null, preview: PreviewData | null }
 * - 500: { error: string }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [content, preview] = await Promise.all([
      getMatchContentUnified(id),
      getMatchPreview(id),
    ]);

    return NextResponse.json({
      preMatchContent: content?.preMatchContent || null,
      postMatchContent: content?.postMatchContent || null,
      preview: preview ? {
        introduction: preview.introduction,
        teamFormAnalysis: preview.teamFormAnalysis,
        headToHead: preview.headToHead,
        keyPlayers: preview.keyPlayers,
        tacticalAnalysis: preview.tacticalAnalysis,
        prediction: preview.prediction,
        bettingInsights: preview.bettingInsights,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching match content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content' },
      { status: 500 }
    );
  }
}
