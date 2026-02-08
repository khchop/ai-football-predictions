'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  X,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------- Types ----------

interface ModelSummary {
  modelId: string;
  displayName: string;
  provider: string;
  active: boolean | null;
  successRate7d: number;
  successRate30d: number;
  totalAttempts7d: number;
  lastFailure: string | null;
  failureCategory: string | null;
  status: 'healthy' | 'warning' | 'critical';
}

interface SummaryData {
  timestamp: string;
  summary: {
    totalModels: number;
    healthy: number;
    warning: number;
    critical: number;
  };
  models: ModelSummary[];
}

interface DailyDataPoint {
  date: string;
  successRate: number;
  attempts: number;
}

interface TrendWindow {
  successRate: number;
  attempts: number;
  dailyData: DailyDataPoint[];
}

interface ModelTrendsResponse {
  timestamp: string;
  modelId: string;
  trends: {
    modelId: string;
    current: {
      successRate: number;
      lastFailure: string | null;
      failureCategory: string | null;
    };
    trends: {
      days7: TrendWindow;
      days30: TrendWindow;
      days90: TrendWindow;
    };
  };
}

type TimeWindow = '7d' | '30d' | '90d';

// ---------- Sub-components ----------

function StatusIcon({ status }: { status: 'healthy' | 'warning' | 'critical' }) {
  switch (status) {
    case 'healthy':
      return <CheckCircle className="h-4 w-4 text-green-400" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
    case 'critical':
      return <XCircle className="h-4 w-4 text-red-400" />;
  }
}

function ProviderBadge({ provider }: { provider: string }) {
  const colors: Record<string, string> = {
    together: 'bg-blue-500/20 text-blue-400',
    synthetic: 'bg-purple-500/20 text-purple-400',
  };
  return (
    <span
      className={cn(
        'px-2 py-0.5 rounded text-xs font-medium',
        colors[provider] || 'bg-gray-500/20 text-gray-400',
      )}
    >
      {provider}
    </span>
  );
}

function FailureCategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;

  const colors: Record<string, string> = {
    timeout: 'bg-orange-500/20 text-orange-400',
    parse: 'bg-pink-500/20 text-pink-400',
    apiError: 'bg-red-500/20 text-red-400',
    language: 'bg-cyan-500/20 text-cyan-400',
    other: 'bg-gray-500/20 text-gray-400',
  };

  return (
    <span
      className={cn(
        'px-2 py-0.5 rounded text-xs font-medium',
        colors[category] || 'bg-gray-500/20 text-gray-400',
      )}
    >
      {category}
    </span>
  );
}

function TrendIndicator({
  rate7d,
  rate30d,
}: {
  rate7d: number;
  rate30d: number;
}) {
  const diff = rate7d - rate30d;

  if (Math.abs(diff) < 2) {
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  }
  if (diff > 0) {
    return <TrendingUp className="h-3 w-3 text-green-400" />;
  }
  return <TrendingDown className="h-3 w-3 text-red-400" />;
}

function rateColor(rate: number): string {
  if (rate >= 90) return 'text-green-400';
  if (rate >= 80) return 'text-yellow-400';
  return 'text-red-400';
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Unknown';
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return 'Unknown';
  }
}

// ---------- Trend Chart ----------

function SuccessRateTrendChart({
  data,
  timeWindow,
}: {
  data: DailyDataPoint[];
  timeWindow: TimeWindow;
}) {
  const chartData = useMemo(
    () =>
      data
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((d) => ({
          ...d,
          dateLabel: format(parseISO(d.date), 'MMM d'),
        })),
    [data],
  );

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
        No data for {timeWindow} window
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            label={{
              value: '%',
              angle: 0,
              position: 'insideTopLeft',
              style: { fontSize: 10 },
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              fontSize: '11px',
            }}
            formatter={(value) => {
              const num = typeof value === 'number' ? value : 0;
              return [`${num.toFixed(1)}%`, 'Success Rate'];
            }}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <ReferenceLine
            y={90}
            stroke="hsl(142, 76%, 36%)"
            strokeWidth={1}
            strokeDasharray="5 5"
            label={{
              value: '90%',
              position: 'right',
              style: { fontSize: 9, fill: 'hsl(142, 76%, 36%)' },
            }}
          />
          <Line
            type="monotone"
            dataKey="successRate"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex justify-between text-xs text-muted-foreground px-1">
        <span>{chartData.length} days</span>
        <span>
          {chartData.reduce((sum, d) => sum + d.attempts, 0)} attempts
        </span>
      </div>
    </div>
  );
}

// ---------- Detail Modal ----------

function ModelDetailModal({
  model,
  password,
  onClose,
}: {
  model: ModelSummary;
  password: string;
  onClose: () => void;
}) {
  const [trends, setTrends] = useState<ModelTrendsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('7d');

  const fetchTrends = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/model-health?modelId=${encodeURIComponent(model.modelId)}`,
        {
          headers: { 'X-Admin-Password': password },
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch trends: ${response.status}`);
      }
      const data = await response.json();
      setTrends(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [model.modelId, password]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  const currentWindowData = useMemo(() => {
    if (!trends) return [];
    const windowKey =
      timeWindow === '7d'
        ? 'days7'
        : timeWindow === '30d'
          ? 'days30'
          : 'days90';
    return trends.trends.trends[windowKey]?.dailyData ?? [];
  }, [trends, timeWindow]);

  const currentWindowSummary = useMemo(() => {
    if (!trends) return { successRate: 0, attempts: 0 };
    const windowKey =
      timeWindow === '7d'
        ? 'days7'
        : timeWindow === '30d'
          ? 'days30'
          : 'days90';
    const window = trends.trends.trends[windowKey];
    return {
      successRate: window?.successRate ?? 0,
      attempts: window?.attempts ?? 0,
    };
  }, [trends, timeWindow]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 card-gradient rounded-xl border border-border/50 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <StatusIcon status={model.status} />
            <div>
              <h3 className="font-semibold">{model.displayName}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <ProviderBadge provider={model.provider} />
                <span className="text-xs text-muted-foreground">
                  {model.modelId}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-[250px]">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={fetchTrends}
                className="mt-3 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* Time window selector */}
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-muted-foreground">
                    {timeWindow} success rate:{' '}
                  </span>
                  <span
                    className={cn(
                      'font-semibold',
                      rateColor(currentWindowSummary.successRate),
                    )}
                  >
                    {currentWindowSummary.successRate.toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground ml-2">
                    ({currentWindowSummary.attempts} attempts)
                  </span>
                </div>
                <div className="flex gap-1">
                  {(['7d', '30d', '90d'] as TimeWindow[]).map((w) => (
                    <button
                      key={w}
                      onClick={() => setTimeWindow(w)}
                      className={cn(
                        'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                        timeWindow === w
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart */}
              <SuccessRateTrendChart
                data={currentWindowData}
                timeWindow={timeWindow}
              />

              {/* Current status details */}
              {trends && (
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">
                      Latest Rate
                    </p>
                    <p
                      className={cn(
                        'font-semibold',
                        rateColor(trends.trends.current.successRate),
                      )}
                    >
                      {trends.trends.current.successRate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">
                      Last Failure
                    </p>
                    <p className="font-medium text-sm">
                      {formatRelativeTime(trends.trends.current.lastFailure)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">
                      Failure Type
                    </p>
                    {trends.trends.current.failureCategory ? (
                      <FailureCategoryBadge
                        category={trends.trends.current.failureCategory}
                      />
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        None
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Main Component ----------

interface ModelHealthCardsProps {
  password: string;
}

export function ModelHealthCards({ password }: ModelHealthCardsProps) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'healthy' | 'warning' | 'critical'
  >('all');

  const fetchSummary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const storedPassword =
        sessionStorage.getItem('admin_password') || password;
      const response = await fetch('/api/admin/model-health', {
        headers: { 'X-Admin-Password': storedPassword },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch model health: ${response.status}`);
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [password]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const filteredModels = useMemo(() => {
    if (!data) return [];
    const models =
      statusFilter === 'all'
        ? data.models
        : data.models.filter((m) => m.status === statusFilter);
    // Sort: critical first, then warning, then healthy
    const order = { critical: 0, warning: 1, healthy: 2 };
    return models.slice().sort((a, b) => order[a.status] - order[b.status]);
  }, [data, statusFilter]);

  // Loading state
  if (isLoading && !data) {
    return (
      <div className="card-gradient rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Model Health Trends</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">
            Loading model health data...
          </span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="card-gradient rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Model Health Trends</h2>
        </div>
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={fetchSummary}
          className="mt-3 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Summary bar - 4 stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card-gradient rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">
              Total Models
            </span>
          </div>
          <div className="text-2xl font-bold">{data.summary.totalModels}</div>
        </div>

        <div className="card-gradient rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-green-400" />
            <span className="text-xs font-medium text-muted-foreground">
              Healthy
            </span>
          </div>
          <div className="text-2xl font-bold text-green-400">
            {data.summary.healthy}
          </div>
        </div>

        <div className="card-gradient rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            <span className="text-xs font-medium text-muted-foreground">
              Warning
            </span>
          </div>
          <div className="text-2xl font-bold text-yellow-400">
            {data.summary.warning}
          </div>
        </div>

        <div className="card-gradient rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-4 w-4 text-red-400" />
            <span className="text-xs font-medium text-muted-foreground">
              Critical
            </span>
          </div>
          <div className="text-2xl font-bold text-red-400">
            {data.summary.critical}
          </div>
        </div>
      </div>

      {/* Filter + Refresh bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          {(
            ['all', 'healthy', 'warning', 'critical'] as const
          ).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm transition-colors',
                statusFilter === status
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80',
              )}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {status !== 'all' && data
                ? ` (${data.models.filter((m) => m.status === status).length})`
                : ''}
            </button>
          ))}
        </div>
        <button
          onClick={fetchSummary}
          disabled={isLoading}
          className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw
            className={cn('h-4 w-4', isLoading && 'animate-spin')}
          />
        </button>
      </div>

      {/* Model cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredModels.map((model) => (
          <button
            key={model.modelId}
            onClick={() => setSelectedModel(model)}
            className={cn(
              'card-gradient rounded-xl p-4 text-left transition-all hover:ring-1 hover:ring-primary/50 cursor-pointer',
              model.status === 'critical' && 'border border-red-500/30',
              model.status === 'warning' && 'border border-yellow-500/20',
            )}
          >
            {/* Card header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <StatusIcon status={model.status} />
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {model.displayName}
                  </p>
                  <ProviderBadge provider={model.provider} />
                </div>
              </div>
              <TrendIndicator
                rate7d={model.successRate7d}
                rate30d={model.successRate30d}
              />
            </div>

            {/* Success rates */}
            <div className="flex items-baseline gap-3 mb-2">
              <div>
                <span
                  className={cn(
                    'text-2xl font-bold',
                    rateColor(model.successRate7d),
                  )}
                >
                  {model.successRate7d.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground ml-1">7d</span>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">
                  {model.successRate30d.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground ml-1">30d</span>
              </div>
            </div>

            {/* Footer info */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{model.totalAttempts7d} attempts (7d)</span>
              <div className="flex items-center gap-2">
                {model.failureCategory && (
                  <FailureCategoryBadge category={model.failureCategory} />
                )}
                {model.lastFailure && (
                  <span>{formatRelativeTime(model.lastFailure)}</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {filteredModels.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No models match the selected filter.
        </div>
      )}

      {/* Detail modal */}
      {selectedModel && (
        <ModelDetailModal
          model={selectedModel}
          password={sessionStorage.getItem('admin_password') || password}
          onClose={() => setSelectedModel(null)}
        />
      )}
    </div>
  );
}
