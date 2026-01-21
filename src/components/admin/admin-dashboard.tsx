'use client';

import { useState, useEffect, useCallback } from 'react';
import { ModelHealthTable } from './model-health-table';
import { CostSummary } from './cost-summary';
import { Activity, AlertTriangle, DollarSign, Lock, Loader2, RefreshCw } from 'lucide-react';

interface AdminData {
  models: Array<{
    id: string;
    provider: string;
    modelName: string;
    displayName: string;
    isPremium: boolean | null;
    active: boolean | null;
    createdAt: string | null;
    currentStreak: number | null;
    currentStreakType: string | null;
    bestStreak: number | null;
    worstStreak: number | null;
    bestExactStreak: number | null;
    bestTendencyStreak: number | null;
    totalRetryAttempts: number | null;
    totalRetrySuccesses: number | null;
    lastRetryAt: string | null;
    consecutiveFailures: number | null;
    lastFailureAt: string | null;
    lastSuccessAt: string | null;
    failureReason: string | null;
    autoDisabled: boolean | null;
  }>;
  budgetStatus: {
    dailyBudget: number;
    spent: number;
    remaining: number;
    percentUsed: number;
  };
  providerConfig: Array<{
    id: string;
    tier: string;
  }>;
  healthCounts: {
    healthy: number;
    degraded: number;
    failing: number;
    disabled: number;
  };
  unscoredMatches: Array<{
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number | null;
    awayScore: number | null;
    kickoffTime: string;
  }>;
}

export function AdminDashboard() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<AdminData | null>(null);
  const [isRescoring, setIsRescoring] = useState(false);
  const [rescoreResult, setRescoreResult] = useState<string | null>(null);
  const [showUnscoredMatches, setShowUnscoredMatches] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const storedPassword = sessionStorage.getItem('admin_password') || password;
      const response = await fetch('/api/admin/data', {
        headers: {
          'X-Admin-Password': storedPassword,
        },
      });

      if (response.status === 401) {
        setIsAuthenticated(false);
        sessionStorage.removeItem('admin_authenticated');
        sessionStorage.removeItem('admin_password');
        setError('Session expired. Please log in again.');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch admin data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [password]);

  // Check if already authenticated (from sessionStorage)
  useEffect(() => {
    const storedAuth = sessionStorage.getItem('admin_authenticated');
    if (storedAuth === 'true') {
      setIsAuthenticated(true);
      fetchData();
    }
  }, [fetchData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/data', {
        headers: {
          'X-Admin-Password': password,
        },
      });

      if (response.status === 401) {
        setError('Invalid password');
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to authenticate');
      }

      const result = await response.json();
      setData(result);
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_authenticated', 'true');
      sessionStorage.setItem('admin_password', password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRescore = async () => {
    setIsRescoring(true);
    setRescoreResult(null);
    
    try {
      const storedPassword = sessionStorage.getItem('admin_password') || password;
      const response = await fetch('/api/admin/rescore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': storedPassword,
        },
        body: JSON.stringify({}), // Empty body = rescore all unscored
      });
      
      const result = await response.json();
      
      if (result.success) {
        setRescoreResult(`✓ ${result.message}`);
        // Refresh data after rescoring
        await fetchData();
      } else {
        setRescoreResult(`✗ Error: ${result.error}`);
      }
    } catch (error) {
      setRescoreResult(`✗ Failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsRescoring(false);
    }
  };

  // Login form
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="card-gradient rounded-xl p-8 w-full max-w-md">
          <div className="flex items-center justify-center mb-6">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-center mb-2">Admin Access Required</h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Enter the admin password to access the dashboard
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 rounded-lg bg-muted border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                autoFocus
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !password}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                'Access Dashboard'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  // Build provider config map
  const providerConfigMap = new Map(
    data.providerConfig.map(p => [p.id, { id: p.id, tier: p.tier } as { id: string; tier: string; name: string; model: string; displayName: string; isPremium: boolean; pricing: { promptPer1M: number; completionPer1M: number } }])
  );

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Model Health Summary */}
        <div className="card-gradient rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-green-400" />
            <span className="text-sm font-medium">Healthy Models</span>
          </div>
          <div className="text-3xl font-bold text-green-400">{data.healthCounts.healthy}</div>
          <p className="text-xs text-muted-foreground mt-1">0 consecutive failures</p>
        </div>

        <div className="card-gradient rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            <span className="text-sm font-medium">Degraded</span>
          </div>
          <div className="text-3xl font-bold text-yellow-400">{data.healthCounts.degraded}</div>
          <p className="text-xs text-muted-foreground mt-1">1 consecutive failure</p>
        </div>

        <div className="card-gradient rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-sm font-medium">Failing / Disabled</span>
          </div>
          <div className="text-3xl font-bold text-red-400">{data.healthCounts.failing + data.healthCounts.disabled}</div>
          <p className="text-xs text-muted-foreground mt-1">2+ failures or auto-disabled</p>
        </div>

        <div className="card-gradient rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium">Budget Used</span>
          </div>
          <div className="text-3xl font-bold text-blue-400">{data.budgetStatus.percentUsed.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground mt-1">
            ${data.budgetStatus.spent.toFixed(4)} / ${data.budgetStatus.dailyBudget.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Cost Summary */}
      <CostSummary budgetStatus={data.budgetStatus} />

      {/* Rescore Section */}
      {data.unscoredMatches.length > 0 && (
        <div className="card-gradient rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
                Unscored Matches
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {data.unscoredMatches.length} finished {data.unscoredMatches.length === 1 ? 'match' : 'matches'} with unscored predictions
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowUnscoredMatches(!showUnscoredMatches)}
                className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors text-sm"
              >
                {showUnscoredMatches ? 'Hide' : 'Show'} Matches
              </button>
              <button
                onClick={handleRescore}
                disabled={isRescoring}
                className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-2"
              >
                {isRescoring ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Rescoring...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Rescore All
                  </>
                )}
              </button>
            </div>
          </div>

          {rescoreResult && (
            <div className={`p-3 rounded-lg mb-4 ${rescoreResult.startsWith('✓') ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
              <p className={`text-sm ${rescoreResult.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                {rescoreResult}
              </p>
            </div>
          )}

          {showUnscoredMatches && (
            <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto">
              {data.unscoredMatches.map((match) => (
                <div key={match.id} className="p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {match.homeTeam} vs {match.awayTeam}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Score: {match.homeScore}-{match.awayScore} • {new Date(match.kickoffTime).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Model Health Table */}
      <ModelHealthTable 
        models={data.models as Parameters<typeof ModelHealthTable>[0]['models']} 
        providerConfig={providerConfigMap as Parameters<typeof ModelHealthTable>[0]['providerConfig']} 
      />
    </div>
  );
}
