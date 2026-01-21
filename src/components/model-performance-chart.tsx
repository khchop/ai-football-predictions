'use client';

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface WeeklyPerformance {
  weekStart: string;
  matchCount: number;
  totalPoints: number;
  avgPoints: number;
  accuracy: number;
}

interface ModelPerformanceChartProps {
  data: WeeklyPerformance[];
}

type TimeRange = '30d' | '90d' | 'all';

export function ModelPerformanceChart({ data }: ModelPerformanceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('90d');

  const filteredData = useMemo(() => {
    if (data.length === 0) return [];
    
    const now = new Date();
    let cutoffDate: Date;
    
    switch (timeRange) {
      case '30d':
        cutoffDate = new Date(now);
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        break;
      case '90d':
      case 'all':
      default:
        // Data is already capped at 90 days from the query
        cutoffDate = new Date(now);
        cutoffDate.setDate(cutoffDate.getDate() - 90);
        break;
    }

    return data
      .filter(d => new Date(d.weekStart) >= cutoffDate)
      .map(d => ({
        ...d,
        weekLabel: format(parseISO(d.weekStart), 'MMM d'),
      }));
  }, [data, timeRange]);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-12 text-center">
        <p className="text-muted-foreground">Not enough data for performance chart</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Check back after more predictions have been scored
        </p>
      </div>
    );
  }

  if (filteredData.length < 2) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-12 text-center">
        <p className="text-muted-foreground">Not enough data for selected time range</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Try selecting a longer time period
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Time range toggle */}
      <div className="flex justify-end gap-1">
        {(['30d', '90d', 'all'] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-md transition-colors",
              timeRange === range
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {range === 'all' ? 'All' : range}
          </button>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={filteredData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
          <XAxis
            dataKey="weekLabel"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
          />
          <YAxis
            yAxisId="left"
            domain={[0, 10]}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
            label={{ value: 'Avg Points', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' } }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
            label={{ value: 'Accuracy %', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' } }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelFormatter={(label) => `Week of ${label}`}
            formatter={(value, name) => {
              if (typeof value !== 'number') return [String(value), name];
              if (name === 'Avg Points') return [value.toFixed(2), name];
              if (name === 'Accuracy') return [`${value}%`, name];
              return [value, name];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px' }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="avgPoints"
            name="Avg Points"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3, fill: 'hsl(var(--primary))' }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="accuracy"
            name="Accuracy"
            stroke="hsl(142, 76%, 36%)"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 3, fill: 'hsl(142, 76%, 36%)' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Summary stats */}
      <div className="flex justify-center gap-6 text-sm text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">{filteredData.length}</span> weeks
        </span>
        <span>
          <span className="font-medium text-foreground">
            {filteredData.reduce((sum, d) => sum + d.matchCount, 0)}
          </span> matches
        </span>
        <span>
          Avg: <span className="font-medium text-primary">
            {(filteredData.reduce((sum, d) => sum + d.avgPoints, 0) / filteredData.length).toFixed(2)}
          </span> pts/match
        </span>
      </div>
    </div>
  );
}
