import { NextRequest, NextResponse } from 'next/server';
import { getModelPredictionHistory } from '@/lib/db/queries';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: modelId } = await params;
  const searchParams = request.nextUrl.searchParams;
  
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const competitionId = searchParams.get('competition') || undefined;

  try {
    // Fetch one extra to determine if there are more
    const predictions = await getModelPredictionHistory(modelId, {
      limit: limit + 1,
      offset,
      competitionId,
    });

    const hasMore = predictions.length > limit;
    const data = hasMore ? predictions.slice(0, limit) : predictions;

    return NextResponse.json({
      predictions: data,
      hasMore,
      offset: offset + data.length,
    });
  } catch (error) {
    console.error('Error fetching model predictions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch predictions' },
      { status: 500 }
    );
  }
}
