'use client';

import { cn } from '@/lib/utils';
import { Trophy, Target, Flame, Snowflake, Zap, TrendingUp, Award, BarChart3 } from 'lucide-react';
import type { Model } from '@/lib/db/schema';
import { AccuracyDisplay } from '@/components/accuracy-display';

interface ModelStats {
  totalPredictions: number;
  totalPoints: number;
  averagePoints: number;
  accuracy: number;
  exactScores: number;
  correctTendencies: number;
  correctGoalDiffs: number;
}

interface ModelStatsGridProps {
  model: Model;
  stats: ModelStats;
  tier?: 'free' | 'ultra-budget' | 'budget' | 'premium';
}

export function ModelStatsGrid({ model, stats, tier }: ModelStatsGridProps) {
  const getTierBadge = () => {
    switch (tier) {
      case 'free':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">Free</span>;
      case 'ultra-budget':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">Ultra-Budget</span>;
      case 'budget':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">Budget</span>;
      case 'premium':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">Premium</span>;
      default:
        return null;
    }
  };

  const getStreakIndicator = () => {
    const streak = model.currentStreak || 0;
    
    if (streak >= 3) {
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-500/20">
          <Flame className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-bold text-orange-500">+{streak}</span>
        </div>
      );
    } else if (streak <= -3) {
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-500/20">
          <Snowflake className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-bold text-blue-400">{streak}</span>
        </div>
      );
    } else if (streak > 0) {
      return (
        <span className="text-sm font-medium text-green-500 px-2 py-1">+{streak}</span>
      );
    } else if (streak < 0) {
      return (
        <span className="text-sm font-medium text-red-400 px-2 py-1">{streak}</span>
      );
    }
    return null;
  };

  const statCards = [
    {
      label: 'Matches',
      value: stats.totalPredictions.toString(),
      icon: BarChart3,
      color: 'text-foreground',
    },
    {
      label: 'Total Points',
      value: stats.totalPoints.toString(),
      icon: Trophy,
      color: 'text-primary',
    },
    {
      label: 'Avg/Match',
      value: Number(stats.averagePoints).toFixed(2),
      icon: TrendingUp,
      color: stats.averagePoints >= 4 ? 'text-green-400' : stats.averagePoints >= 2 ? 'text-yellow-400' : 'text-muted-foreground',
    },
    {
      label: 'Accuracy',
      value: `${stats.accuracy}%`,
      icon: Target,
      color: stats.accuracy >= 50 ? 'text-green-400' : stats.accuracy >= 30 ? 'text-yellow-400' : 'text-red-400',
    },
    {
      label: 'Exact Scores',
      value: stats.exactScores.toString(),
      icon: Award,
      color: 'text-green-400',
    },
    {
      label: 'Best Streak',
      value: `+${model.bestStreak || 0}`,
      icon: Flame,
      color: 'text-orange-400',
    },
    {
      label: 'Worst Streak',
      value: `${model.worstStreak || 0}`,
      icon: Snowflake,
      color: 'text-blue-400',
    },
    {
      label: 'Best Exact Str.',
      value: `+${model.bestExactStreak || 0}`,
      icon: Zap,
      color: 'text-purple-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with tier badge and streak */}
      <div className="flex flex-wrap items-center gap-3">
        {getTierBadge()}
        {getStreakIndicator()}
        {!model.active && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            Inactive
          </span>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl bg-card/50 border border-border/50 p-4 text-center"
          >
            <stat.icon className={cn("h-5 w-5 mx-auto mb-2", stat.color)} />
            {stat.label === 'Accuracy' ? (
              <AccuracyDisplay
                correct={stats.correctTendencies}
                total={stats.totalPredictions}
                size="md"
                className="justify-center"
              />
            ) : (
              <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
