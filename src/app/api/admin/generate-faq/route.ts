import { NextResponse } from 'next/server';
import { generateFAQContent } from '@/lib/content/match-content';

/**
 * POST /api/admin/generate-faq
 *
 * Triggers FAQ content generation for a specific match.
 *
 * Body: { matchId: string }
 * Response:
 * - 200: { success: true, matchId: string }
 * - 400: { error: string } (missing matchId)
 * - 500: { error: string } (generation failed)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { matchId } = body;

    if (!matchId) {
      return NextResponse.json(
        { error: 'matchId is required' },
        { status: 400 }
      );
    }

    console.log(`[generate-faq] Starting FAQ generation for match ${matchId}`);
    await generateFAQContent(matchId);
    console.log(`[generate-faq] FAQ generation succeeded for match ${matchId}`);

    return NextResponse.json({ success: true, matchId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error generating FAQ content:', errorMessage);
    return NextResponse.json(
      { error: `Failed to generate FAQ content: ${errorMessage}` },
      { status: 500 }
    );
  }
}
