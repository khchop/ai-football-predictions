/**
 * League Trend Data Query
 *
 * Fetches historical accuracy trends grouped by time period (week/month).
 * Used for CSS-only trend visualization on league pages.
 */

import { getDb, predictions, matches } from '@/lib/db';
import { eq, sql, and } from 'drizzle-orm';

/**
 * Trend data point for a single time period
 */
export interface TrendData {
  /** Period identifier (e.g., "2025-W01", "2025-01") */
  period: string;
  /** Accuracy percentage (0-100) */
  accuracy: number;
  /** Number of matches in this period */
  matchCount: number;
}

/**
 * Fetch historical accuracy trends for a competition
 *
 * Groups predictions by week (ISO week format) and calculates accuracy per period.
 * Returns data ordered chronologically (oldest to newest) for left-to-right chart display.
 *
 * @param competitionId - Competition ID (e.g., 'epl', 'seriea')
 * @param periods - Number of periods to return (default: 8)
 * @returns Array of TrendData sorted chronologically, or empty array if no data
 *
 * @example
 * const trends = await getLeagueTrends('epl', 8);
 * // Returns: [
 * //   { period: '2025-W48', accuracy: 65.2, matchCount: 10 },
 * //   { period: '2025-W49', accuracy: 72.1, matchCount: 8 },
 * //   ...
 * // ]
 */
export async function getLeagueTrends(
  competitionId: string,
  periods: number = 8
): Promise<TrendData[]> {
  const db = getDb();

  // Query predictions grouped by ISO week
  // Accuracy = (correct tendencies / scored predictions) * 100
  // Following the canonical formula from queries.ts
  const result = await db
    .select({
      period: sql<string>`TO_CHAR(${matches.kickoffTime}::timestamp, 'IYYY-"W"IW')`,
      accuracy: sql<number>`COALESCE(
        ROUND(
          100.0 * SUM(CASE WHEN ${predictions.tendencyPoints} > 0 THEN 1 ELSE 0 END)::numeric /
          NULLIF(SUM(CASE WHEN ${predictions.status} = 'scored' THEN 1 ELSE 0 END), 0),
          1
        ),
        0
      )`,
      matchCount: sql<number>`COUNT(DISTINCT ${matches.id})`,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .where(
      and(
        eq(matches.competitionId, competitionId),
        eq(predictions.status, 'scored')
      )
    )
    .groupBy(sql`TO_CHAR(${matches.kickoffTime}::timestamp, 'IYYY-"W"IW')`)
    .orderBy(sql`TO_CHAR(${matches.kickoffTime}::timestamp, 'IYYY-"W"IW') DESC`)
    .limit(periods);

  // Filter out periods with null accuracy (edge case: 0 scored predictions)
  // and reverse to chronological order (oldest first for left-to-right display)
  const filteredResults = result
    .filter((row) => row.accuracy !== null && row.matchCount > 0)
    .reverse();

  return filteredResults.map((row) => ({
    period: row.period,
    accuracy: Number(row.accuracy),
    matchCount: Number(row.matchCount),
  }));
}
