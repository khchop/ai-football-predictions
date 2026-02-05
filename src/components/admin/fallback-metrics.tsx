'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, TrendingUp } from 'lucide-react';

interface FallbackStat {
  modelId: string;
  modelName: string;
  fallbackTo: string | null;
  fallbackToName: string | null;
  totalPredictions: number;
  fallbackCount: number;
  fallbackRate: number;
  estimatedOriginalCost: number;
  estimatedFallbackCost: number;
  costMultiplier: number;
  exceeds2x: boolean;
}

interface FallbackStats {
  stats: FallbackStat[];
  summary: {
    totalModelsWithFallback: number;
    totalFallbacksToday: number;
    modelsExceeding2x: number;
  };
}

export function FallbackMetrics() {
  const [data, setData] = useState<FallbackStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const storedPassword = sessionStorage.getItem('admin_password') || '';
      const response = await fetch('/api/admin/fallback-stats', {
        headers: {
          'X-Admin-Password': storedPassword,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch fallback statistics');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="card-gradient rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Fallback Metrics</h2>
        </div>
        <p className="text-sm text-muted-foreground">Loading fallback statistics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-gradient rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Fallback Metrics</h2>
        </div>
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={fetchData}
          className="mt-3 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data || data.stats.length === 0) {
    return (
      <div className="card-gradient rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Fallback Metrics</h2>
        </div>
        <p className="text-sm text-muted-foreground">No fallback usage detected today</p>
      </div>
    );
  }

  return (
    <div className="card-gradient rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Fallback Metrics</h2>
        </div>
        <button
          onClick={fetchData}
          disabled={isLoading}
          className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary badges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground mb-1">Total Fallbacks Today</p>
          <p className="text-xl font-bold">{data.summary.totalFallbacksToday}</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground mb-1">Models Using Fallbacks</p>
          <p className="text-xl font-bold">{data.summary.totalModelsWithFallback}</p>
        </div>
        <div className="p-3 rounded-lg bg-amber-500/10">
          <p className="text-xs text-muted-foreground mb-1">Exceeding 2x Cost</p>
          <p className="text-xl font-bold text-amber-400">{data.summary.modelsExceeding2x}</p>
        </div>
      </div>

      {/* Fallback stats table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-2 px-3 font-medium text-muted-foreground">Model</th>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground">Fallback</th>
              <th className="text-right py-2 px-3 font-medium text-muted-foreground">Rate</th>
              <th className="text-right py-2 px-3 font-medium text-muted-foreground">Count</th>
              <th className="text-right py-2 px-3 font-medium text-muted-foreground">Cost</th>
            </tr>
          </thead>
          <tbody>
            {data.stats.map((stat) => (
              <tr
                key={stat.modelId}
                className={`border-b border-border/30 ${
                  stat.exceeds2x ? 'bg-amber-500/5' : ''
                }`}
              >
                <td className="py-3 px-3">
                  <div className="font-medium">{stat.modelName}</div>
                  <div className="text-xs text-muted-foreground">{stat.modelId}</div>
                </td>
                <td className="py-3 px-3">
                  {stat.fallbackTo ? (
                    <>
                      <div className="text-sm">{stat.fallbackToName}</div>
                      <div className="text-xs text-muted-foreground">{stat.fallbackTo}</div>
                    </>
                  ) : (
                    <span className="text-muted-foreground text-sm">None configured</span>
                  )}
                </td>
                <td className="py-3 px-3 text-right">
                  <span
                    className={
                      stat.fallbackRate > 0.5
                        ? 'text-red-400 font-medium'
                        : stat.fallbackRate > 0.2
                        ? 'text-yellow-400'
                        : ''
                    }
                  >
                    {(stat.fallbackRate * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="py-3 px-3 text-right">
                  {stat.fallbackCount} / {stat.totalPredictions}
                </td>
                <td className="py-3 px-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {stat.exceeds2x && (
                      <div title="Cost exceeds 2x original">
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                      </div>
                    )}
                    <div>
                      <div
                        className={`text-sm ${
                          stat.exceeds2x ? 'text-amber-400 font-medium' : ''
                        }`}
                      >
                        {stat.costMultiplier.toFixed(2)}x
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ${stat.estimatedFallbackCost.toFixed(6)}
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cost warning footer */}
      {data.summary.modelsExceeding2x > 0 && (
        <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-400">
            <p className="font-medium mb-1">High Fallback Costs Detected</p>
            <p className="text-amber-400/80">
              {data.summary.modelsExceeding2x} model{data.summary.modelsExceeding2x > 1 ? 's are' : ' is'} using fallbacks
              that cost more than 2x the original model. Consider reviewing these models for reliability issues.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
