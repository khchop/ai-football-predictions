import { NextResponse } from 'next/server';
import { getMatchCoverage } from '@/lib/monitoring/pipeline-coverage';
import { isQueueConnectionHealthy } from '@/lib/queue';

// Cache coverage data for 60 seconds to avoid expensive queries on frequent polling
let cachedCoverage: {
  percentage: number;
  totalMatches: number;
  coveredMatches: number;
  gaps: number;
  timestamp: number;
} | null = null;
const CACHE_TTL_MS = 60_000; // 60 seconds

export async function GET() {
  // Check Redis health
  const redisHealthy = isQueueConnectionHealthy();

  // Get cached or fresh coverage
  const now = Date.now();
  if (!cachedCoverage || now - cachedCoverage.timestamp > CACHE_TTL_MS) {
    try {
      const coverage = await getMatchCoverage(6); // Next 6 hours
      cachedCoverage = {
        percentage: Math.round(coverage.percentage * 10) / 10,
        totalMatches: coverage.totalMatches,
        coveredMatches: coverage.coveredMatches,
        gaps: coverage.gaps.length,
        timestamp: now,
      };
    } catch {
      // If coverage check fails, don't crash health endpoint
      // Keep stale cache if available, otherwise cachedCoverage stays null
      // Health status will be based on Redis health alone when cachedCoverage is null
    }
  }

  // Determine overall health status
  const status = !redisHealthy ? 'unhealthy'
    : (cachedCoverage && cachedCoverage.percentage < 90) ? 'degraded'
    : 'ok';

  return NextResponse.json({
    status,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    checks: {
      redis: redisHealthy ? 'healthy' : 'unhealthy',
      matchCoverage: cachedCoverage ? {
        percentage: cachedCoverage.percentage,
        totalMatches: cachedCoverage.totalMatches,
        coveredMatches: cachedCoverage.coveredMatches,
        gaps: cachedCoverage.gaps,
      } : null,
    },
  }, {
    status: status === 'unhealthy' ? 503 : 200,
  });
}
