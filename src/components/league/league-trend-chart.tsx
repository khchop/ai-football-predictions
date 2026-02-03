/**
 * League Trend Chart - CSS-only bar chart for accuracy visualization
 *
 * Features:
 * - Pure CSS implementation (no Chart.js/D3.js dependencies)
 * - Color coding based on accuracy thresholds (matches AccuracyBadge)
 * - Responsive design with flexible bar widths
 * - Accessible with title attributes and visible labels
 * - Graceful empty data handling (returns null)
 */

import type { TrendData } from '@/lib/league/get-league-trends';

interface LeagueTrendChartProps {
  /** Array of trend data points to visualize */
  data: TrendData[];
  /** Chart title (default: "Accuracy Trend") */
  title?: string;
}

/**
 * Format period string for compact display
 * - "2025-W01" -> "W1"
 * - "2025-01" -> "Jan"
 */
function formatPeriod(period: string): string {
  // ISO week format: "2025-W01"
  const weekMatch = period.match(/\d{4}-W(\d{2})/);
  if (weekMatch) {
    return `W${parseInt(weekMatch[1], 10)}`;
  }

  // Month format: "2025-01"
  const monthMatch = period.match(/\d{4}-(\d{2})/);
  if (monthMatch) {
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const monthIndex = parseInt(monthMatch[1], 10) - 1;
    return monthNames[monthIndex] || period;
  }

  // Fallback: return as-is
  return period;
}

/**
 * Get color class based on accuracy thresholds
 * Matches AccuracyBadge thresholds:
 * - < 40%: Red (--loss)
 * - 40-70%: Amber (--draw)
 * - >= 70%: Green (--win)
 */
function getColorClass(accuracy: number): string {
  if (accuracy < 40) {
    return 'bg-loss';
  }
  if (accuracy < 70) {
    return 'bg-draw';
  }
  return 'bg-win';
}

/**
 * CSS-only trend visualization component
 *
 * Renders a bar chart showing accuracy trends over time.
 * Returns null for empty data to prevent broken UI.
 *
 * @example
 * <LeagueTrendChart
 *   data={trends}
 *   title="Weekly Accuracy"
 * />
 */
export function LeagueTrendChart({
  data,
  title = 'Accuracy Trend',
}: LeagueTrendChartProps) {
  // Empty data: return null for graceful handling
  // Filter out invalid accuracy values (non-numbers)
  if (!data || data.length === 0) {
    return null;
  }

  const validData = data.filter(
    (item) => typeof item.accuracy === 'number' && !isNaN(item.accuracy)
  );
  if (validData.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>

      <div className="flex items-end gap-1 h-24">
        {validData.map((item, index) => {
          const height = Math.max(item.accuracy, 2); // Minimum 2% height for visibility
          const colorClass = getColorClass(item.accuracy);

          return (
            <div
              key={`${item.period}-${index}`}
              className="flex-1 flex flex-col items-center gap-1"
            >
              <div
                className={`w-full rounded-t ${colorClass} transition-all duration-300`}
                style={{ height: `${height}%` }}
                title={`${item.period}: ${item.accuracy.toFixed(1)}% (${item.matchCount} matches)`}
              />
              <span className="text-xs text-muted-foreground truncate w-full text-center">
                {formatPeriod(item.period)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
