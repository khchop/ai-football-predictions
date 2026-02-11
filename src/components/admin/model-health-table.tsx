'use client';

import { Model } from '@/lib/db/schema';
import { OpenRouterProvider } from '@/lib/llm/providers/openrouter';
import { CheckCircle, AlertTriangle, XCircle, Ban, RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface ModelHealthTableProps {
  models: Model[];
  providerConfig: Map<string, OpenRouterProvider>;
}

type HealthStatus = 'healthy' | 'degraded' | 'failing' | 'disabled';

function getHealthStatus(model: Model): HealthStatus {
  if (model.autoDisabled) return 'disabled';
  const failures = model.consecutiveFailures || 0;
  if (failures >= 2) return 'failing';
  if (failures >= 1) return 'degraded';
  return 'healthy';
}

function HealthBadge({ status }: { status: HealthStatus }) {
  switch (status) {
    case 'healthy':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
          <CheckCircle className="h-3 w-3" />
          Healthy
        </span>
      );
    case 'degraded':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
          <AlertTriangle className="h-3 w-3" />
          Degraded
        </span>
      );
    case 'failing':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
          <XCircle className="h-3 w-3" />
          Failing
        </span>
      );
    case 'disabled':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400">
          <Ban className="h-3 w-3" />
          Disabled
        </span>
      );
  }
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    free: 'bg-emerald-500/20 text-emerald-400',
    'ultra-budget': 'bg-blue-500/20 text-blue-400',
    budget: 'bg-purple-500/20 text-purple-400',
    premium: 'bg-amber-500/20 text-amber-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[tier] || 'bg-gray-500/20 text-gray-400'}`}>
      {tier}
    </span>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function ModelHealthTable({ models, providerConfig }: ModelHealthTableProps) {
  const [filter, setFilter] = useState<'all' | HealthStatus>('all');
  const [isReEnabling, setIsReEnabling] = useState<string | null>(null);

  const filteredModels = models.filter(model => {
    if (filter === 'all') return true;
    return getHealthStatus(model) === filter;
  });

  const handleReEnable = async (modelId: string) => {
    setIsReEnabling(modelId);
    try {
      // Get password from sessionStorage
      const password = sessionStorage.getItem('admin_password') || '';
      const response = await fetch('/api/admin/re-enable-model', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Password': password,
        },
        body: JSON.stringify({ modelId }),
      });
      if (response.ok) {
        // Refresh the page to show updated state
        window.location.reload();
      } else if (response.status === 401) {
        alert('Session expired. Please refresh and log in again.');
      }
    } catch (error) {
      console.error('Failed to re-enable model:', error);
    } finally {
      setIsReEnabling(null);
    }
  };

  return (
    <div className="card-gradient rounded-xl overflow-hidden">
      <div className="p-4 border-b border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-semibold">Model Health Status</h2>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'healthy', 'degraded', 'failing', 'disabled'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  filter === status
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50 text-left">
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Model</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Tier</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Failures</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Last Success</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Last Failure</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Error</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredModels.map(model => {
              const config = providerConfig.get(model.id);
              const status = getHealthStatus(model);
              
              return (
                <tr key={model.id} className="border-b border-border/30 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-sm">{model.displayName}</div>
                      <div className="text-xs text-muted-foreground">{model.id}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {config && <TierBadge tier={config.tier} />}
                  </td>
                  <td className="px-4 py-3">
                    <HealthBadge status={status} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono ${(model.consecutiveFailures || 0) > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                      {model.consecutiveFailures || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(model.lastSuccessAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(model.lastFailureAt)}
                  </td>
                  <td className="px-4 py-3">
                    {model.failureReason ? (
                      <span 
                        className="text-xs text-red-400 max-w-[200px] truncate block" 
                        title={model.failureReason}
                      >
                        {model.failureReason}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {model.autoDisabled && (
                      <button
                        onClick={() => handleReEnable(model.id)}
                        disabled={isReEnabling === model.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3 w-3 ${isReEnabling === model.id ? 'animate-spin' : ''}`} />
                        Re-enable
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredModels.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          No models match the selected filter.
        </div>
      )}
    </div>
  );
}
