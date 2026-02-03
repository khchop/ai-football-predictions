import { NextRequest, NextResponse } from 'next/server';
import { formatMatchMinute } from '@/lib/football/api-football';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const res = await fetch(
      `https://v3.football.api-sports.io/fixtures?id=${id}`,
      {
        headers: {
          'x-apisports-key': process.env.API_FOOTBALL_KEY || '',
        },
        next: { revalidate: 30 },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ minute: null }, { status: res.status });
    }

    const data = await res.json();
    const fixture = data.response?.[0];

    if (!fixture) {
      return NextResponse.json({ minute: null }, { status: 404 });
    }

    const minute = formatMatchMinute(fixture.fixture.status);

    return NextResponse.json(
      { minute },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error) {
    console.error('Failed to fetch match minute:', error);
    return NextResponse.json({ minute: null }, { status: 500 });
  }
}
