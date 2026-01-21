'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface LeaderboardEntry {
  modelId: string;
  displayName: string;
  provider: string;
  totalPredictions: number;
  exactScores?: number;
  correctResults?: number;
  correctTendencies?: number;
  totalPoints: number;
  exactScorePercent?: number;
  correctResultPercent?: number;
  averagePoints: number;
}

interface AccuracyChartProps {
  data: LeaderboardEntry[];
}

export function AccuracyChart({ data }: AccuracyChartProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground h-[400px] flex items-center justify-center">
        No data available for chart
      </div>
    );
  }

  // Transform data for the chart
  const chartData = data.map(entry => {
    // Calculate accuracy if not provided
    const correctCount = entry.correctTendencies ?? entry.correctResults ?? 0;
    const accuracy = entry.totalPredictions > 0 
      ? Math.round((correctCount / entry.totalPredictions) * 100) / 10
      : 0;
    
    return {
      name: entry.displayName.split(' (')[0], // Shorten name
      'Exact Score %': entry.exactScorePercent ?? 0,
      'Accuracy %': entry.correctResultPercent ?? accuracy,
      'Avg Points': entry.averagePoints,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="name" 
          angle={-45} 
          textAnchor="end" 
          height={80}
          tick={{ fontSize: 12 }}
        />
        <YAxis 
          yAxisId="left"
          tick={{ fontSize: 12 }}
          label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }}
        />
        <YAxis 
          yAxisId="right" 
          orientation="right"
          tick={{ fontSize: 12 }}
          label={{ value: 'Avg Points', angle: 90, position: 'insideRight' }}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'hsl(var(--background))', 
            border: '1px solid hsl(var(--border))' 
          }}
        />
        <Legend />
        <Bar yAxisId="left" dataKey="Exact Score %" fill="#22c55e" radius={[4, 4, 0, 0]} />
        <Bar yAxisId="left" dataKey="Accuracy %" fill="#eab308" radius={[4, 4, 0, 0]} />
        <Bar yAxisId="right" dataKey="Avg Points" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
