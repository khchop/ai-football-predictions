'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown, Medal, Minus } from 'lucide-react';

interface BettingLeaderboardEntry {
  modelId: string;
  displayName: string;
  provider: string;
  active: boolean | null;
  balance: number;
  profit: number;
  roi: number;
  totalBets: number;
  winningBets: number;
  losingBets: number;
  winRate: number;
  totalWagered: number;
  totalWon: number;
  averageOdds: number;
}

interface Props {
  entries: BettingLeaderboardEntry[];
}

export function BettingLeaderboardTable({ entries }: Props) {
  const formatCurrency = (amount: number) => {
    return `€${amount.toFixed(2)}`;
  };

  const formatPercent = (percent: number) => {
    return `${percent.toFixed(1)}%`;
  };

  const getProfitColor = (profit: number) => {
    if (profit > 0) return 'text-green-400';
    if (profit < 0) return 'text-red-400';
    return 'text-muted-foreground';
  };

  const getProfitIcon = (profit: number) => {
    if (profit > 0) return <TrendingUp className="h-3 w-3" />;
    if (profit < 0) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getMedalForRank = (rank: number) => {
    if (rank === 1) return <Medal className="h-5 w-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    return null;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border/50">
            <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Rank
            </th>
            <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Model
            </th>
            <th className="text-right p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Balance
            </th>
            <th className="text-right p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Profit
            </th>
            <th className="text-right p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              ROI
            </th>
            <th className="text-right p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Bets
            </th>
            <th className="text-right p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Win Rate
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => {
            const rank = index + 1;
            const medal = getMedalForRank(rank);
            
            return (
              <tr
                key={entry.modelId}
                className="border-b border-border/30 hover:bg-accent/50 transition-colors"
              >
                {/* Rank */}
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    {medal || (
                      <span className="text-sm font-medium text-muted-foreground w-5 text-center">
                        {rank}
                      </span>
                    )}
                  </div>
                </td>

                {/* Model Name */}
                <td className="p-4">
                  <Link
                    href={`/models/${entry.modelId}`}
                    className="block group"
                  >
                    <div className="font-medium group-hover:text-primary transition-colors">
                      {entry.displayName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {entry.provider}
                    </div>
                  </Link>
                </td>

                {/* Balance */}
                <td className="p-4 text-right">
                  <div className="font-mono font-medium">
                    {formatCurrency(entry.balance)}
                  </div>
                </td>

                {/* Profit */}
                <td className="p-4 text-right">
                  <div className={`flex items-center justify-end gap-1 font-mono font-medium ${getProfitColor(entry.profit)}`}>
                    {getProfitIcon(entry.profit)}
                    {formatCurrency(Math.abs(entry.profit))}
                  </div>
                </td>

                {/* ROI */}
                <td className="p-4 text-right">
                  <div className={`font-mono font-medium ${getProfitColor(entry.profit)}`}>
                    {entry.roi > 0 ? '+' : ''}{formatPercent(entry.roi)}
                  </div>
                </td>

                {/* Bets */}
                <td className="p-4 text-right">
                  <div className="text-sm">
                    <span className="font-medium">{entry.totalBets}</span>
                    <span className="text-muted-foreground text-xs ml-1">
                      ({entry.winningBets}W-{entry.losingBets}L)
                    </span>
                  </div>
                </td>

                {/* Win Rate */}
                <td className="p-4 text-right">
                  <div className="font-mono font-medium">
                    {formatPercent(entry.winRate)}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
