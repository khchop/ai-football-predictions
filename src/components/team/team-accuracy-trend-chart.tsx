'use client';

import { format, parseISO } from 'date-fns';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  TooltipProps,
} from 'recharts';
import type { AccuracyTrendPoint } from '@/lib/db/queries/team-stats';

interface TeamAccuracyTrendChartProps {
  data: AccuracyTrendPoint[];
}

// Custom tooltip component
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0].payload as AccuracyTrendPoint & { date: string; accuracy: number };

  return (
    <div
      className="rounded-lg border border-border bg-background p-3 shadow-lg"
      style={{
        backgroundColor: 'hsl(var(--background))',
        border: '1px solid hsl(var(--border))',
      }}
    >
      <p className="text-sm font-medium mb-1">{data.date}</p>
      <p className="text-sm text-muted-foreground">
        Accuracy: <span className="font-semibold text-foreground">{data.accuracy}%</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Matches: {data.matchCount}
      </p>
      <p className="text-xs text-muted-foreground">
        Predictions: {data.predictionCount}
      </p>
    </div>
  );
}

export function TeamAccuracyTrendChart({ data }: TeamAccuracyTrendChartProps) {
  if (data.length < 3) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        <p>Insufficient data for trend chart (need at least 3 weeks of predictions)</p>
      </div>
    );
  }

  // Transform data: format dates and add accuracy as separate field
  const chartData = data.map((point) => ({
    ...point,
    date: format(parseISO(point.weekStart), 'MMM dd'),
    accuracy: point.accuracyPct,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          angle={-45}
          textAnchor="end"
          height={60}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 12 }}
          label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="accuracy"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
