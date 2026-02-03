import { NextResponse } from 'next/server';
import { getMatchContentUnified } from '@/lib/db/queries';

/**
 * GET /api/matches/[id]/content
 *
 * Returns narrative content (pre-match and post-match) for a match.
 * Used by MatchNarrative component for client-side content fetching.
 *
 * Response:
 * - 200: { preMatchContent: string | null, postMatchContent: string | null }
 * - 500: { error: string }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const content = await getMatchContentUnified(id);

    // Return null values if no content exists (not 404 - absence of content is valid)
    if (!content) {
      return NextResponse.json(
        { preMatchContent: null, postMatchContent: null },
        { status: 200 }
      );
    }

    return NextResponse.json({
      preMatchContent: content.preMatchContent || null,
      postMatchContent: content.postMatchContent || null,
    });
  } catch (error) {
    console.error('Error fetching match content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content' },
      { status: 500 }
    );
  }
}
