import { getRedis, isRedisAvailable } from '@/lib/cache/redis';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Always fresh stats

export async function GET() {
  const redis = getRedis();

  if (!redis) {
    return NextResponse.json(
      {
        error: 'Redis not configured',
        status: 'unavailable'
      },
      { status: 503 }
    );
  }

  const available = await isRedisAvailable();
  if (!available) {
    return NextResponse.json(
      {
        error: 'Redis not available',
        status: 'unavailable'
      },
      { status: 503 }
    );
  }

  try {
    const info = await redis.info('stats');

    // Parse INFO output for keyspace metrics
    const hitsMatch = info.match(/keyspace_hits:(\d+)/);
    const missesMatch = info.match(/keyspace_misses:(\d+)/);

    const hits = hitsMatch ? parseInt(hitsMatch[1], 10) : 0;
    const misses = missesMatch ? parseInt(missesMatch[1], 10) : 0;
    const total = hits + misses;
    const hitRate = total > 0 ? (hits / total * 100) : 0;
    const hitRateFormatted = hitRate.toFixed(2);

    // Determine health status based on 70% target
    const status = hitRate >= 70
      ? 'healthy'
      : hitRate >= 50
        ? 'acceptable'
        : 'needs-optimization';

    return NextResponse.json({
      hits,
      misses,
      total,
      hitRate: `${hitRateFormatted}%`,
      hitRateRaw: hitRate,
      target: '70%+',
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch cache stats:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
