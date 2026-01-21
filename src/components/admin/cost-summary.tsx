'use client';

import { DollarSign, TrendingUp, AlertCircle } from 'lucide-react';

interface BudgetStatus {
  dailyBudget: number;
  spent: number;
  remaining: number;
  percentUsed: number;
}

interface CostSummaryProps {
  budgetStatus: BudgetStatus;
}

export function CostSummary({ budgetStatus }: CostSummaryProps) {
  const isOverBudget = budgetStatus.remaining < 0;
  const isNearLimit = budgetStatus.percentUsed > 80;

  return (
    <div className="card-gradient rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Cost Summary</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Daily Budget */}
        <div>
          <p className="text-sm text-muted-foreground mb-1">Daily Budget</p>
          <p className="text-2xl font-bold">${budgetStatus.dailyBudget.toFixed(2)}</p>
        </div>

        {/* Spent Today */}
        <div>
          <p className="text-sm text-muted-foreground mb-1">Spent Today</p>
          <p className={`text-2xl font-bold ${isOverBudget ? 'text-red-400' : isNearLimit ? 'text-yellow-400' : 'text-green-400'}`}>
            ${budgetStatus.spent.toFixed(4)}
          </p>
        </div>

        {/* Remaining */}
        <div>
          <p className="text-sm text-muted-foreground mb-1">Remaining</p>
          <p className={`text-2xl font-bold ${isOverBudget ? 'text-red-400' : 'text-green-400'}`}>
            ${budgetStatus.remaining.toFixed(4)}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">Budget Usage</span>
          <span className={isNearLimit ? 'text-yellow-400' : 'text-muted-foreground'}>
            {budgetStatus.percentUsed.toFixed(1)}%
          </span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all rounded-full ${
              isOverBudget
                ? 'bg-red-500'
                : isNearLimit
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(budgetStatus.percentUsed, 100)}%` }}
          />
        </div>
      </div>

      {/* Warnings */}
      {isOverBudget && (
        <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">
            Daily budget exceeded! Premium models will be skipped.
          </p>
        </div>
      )}

      {!isOverBudget && isNearLimit && (
        <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <AlertCircle className="h-4 w-4 text-yellow-400 flex-shrink-0" />
          <p className="text-sm text-yellow-400">
            Approaching daily budget limit. Some premium models may be skipped.
          </p>
        </div>
      )}

      {/* Tier Cost Info */}
      <div className="mt-6 pt-4 border-t border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Estimated Costs by Tier (per prediction)</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="p-2 rounded bg-emerald-500/10">
            <span className="text-emerald-400 font-medium">Free</span>
            <p className="text-muted-foreground">$0.00</p>
          </div>
          <div className="p-2 rounded bg-blue-500/10">
            <span className="text-blue-400 font-medium">Ultra-Budget</span>
            <p className="text-muted-foreground">~$0.00001</p>
          </div>
          <div className="p-2 rounded bg-purple-500/10">
            <span className="text-purple-400 font-medium">Budget</span>
            <p className="text-muted-foreground">~$0.0001</p>
          </div>
          <div className="p-2 rounded bg-amber-500/10">
            <span className="text-amber-400 font-medium">Premium</span>
            <p className="text-muted-foreground">~$0.001</p>
          </div>
        </div>
      </div>
    </div>
  );
}
