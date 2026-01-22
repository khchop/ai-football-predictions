/**
 * Settlement Worker
 * 
 * Settles all pending bets for a finished match.
 * Evaluates each bet (won/lost/void), updates balances, and scores legacy predictions.
 */

import { Worker, Job } from 'bullmq';
import { getQueueConnection, JOB_TYPES } from '../index';
import type { SettleMatchPayload } from '../types';
import { 
  getPendingBetsByMatch,
  settleBetsTransaction,
  getCurrentSeason,
} from '@/lib/db/queries';
import { 
  evaluateResultBet, 
  evaluateOverUnderBet, 
  evaluateBttsBet,
  calculatePayout,
  calculateProfit,
} from '@/lib/betting/bet-settlement';

export function createSettlementWorker() {
  return new Worker<SettleMatchPayload>(
    'match-jobs',
    async (job: Job<SettleMatchPayload>) => {
      if (job.name !== JOB_TYPES.SETTLE_MATCH) return;

      const { matchId, homeScore, awayScore, status } = job.data;
      
      console.log(`[Settlement Worker] Settling bets for match ${matchId} (${homeScore}-${awayScore}, ${status})`);
      
      try {
        const seasonName = await getCurrentSeason();
        const pendingBets = await getPendingBetsByMatch(matchId);

        if (pendingBets.length === 0) {
          console.log(`[Settlement Worker] No pending bets for match ${matchId}`);
          return { settled: 0, won: 0, lost: 0, voids: 0 };
        }

        console.log(`[Settlement Worker] Settling ${pendingBets.length} pending bets...`);

        const betsToSettle: Array<{
          betId: string;
          status: 'won' | 'lost' | 'void';
          payout: number;
          profit: number;
        }> = [];

        let wonCount = 0;
        let lostCount = 0;
        let voidCount = 0;

        // Evaluate each bet
        for (const bet of pendingBets) {
          let won = false;

          // Evaluate bet based on type
          switch (bet.betType) {
            case 'result':
              won = evaluateResultBet(bet.selection, homeScore, awayScore);
              break;
            case 'over_under':
              won = evaluateOverUnderBet(bet.selection, homeScore, awayScore);
              break;
            case 'btts':
              won = evaluateBttsBet(bet.selection, homeScore, awayScore);
              break;
            default:
              console.error(`  Unknown bet type: ${bet.betType}, marking as void`);
              betsToSettle.push({
                betId: bet.id,
                status: 'void',
                payout: 0,
                profit: 0,
              });
              voidCount++;
              continue;
          }

          const payout = calculatePayout(bet.stake || 1.0, bet.odds, won);
          const profit = calculateProfit(bet.stake || 1.0, payout);
          const betStatus = won ? 'won' : 'lost';

          betsToSettle.push({
            betId: bet.id,
            status: betStatus,
            payout,
            profit,
          });

          if (won) wonCount++;
          else lostCount++;
        }

        // Group bets by model for batch balance updates
        const balanceUpdates = new Map<string, { totalPayout: number; winsCount: number }>();

        for (const bet of pendingBets) {
          const settled = betsToSettle.find(b => b.betId === bet.id);
          if (!settled) continue;

          const existing = balanceUpdates.get(bet.modelId) || { totalPayout: 0, winsCount: 0 };
          existing.totalPayout += settled.payout;
          if (settled.status === 'won') existing.winsCount++;
          balanceUpdates.set(bet.modelId, existing);
        }

        // Settle bets in a single transaction
        await settleBetsTransaction(betsToSettle, balanceUpdates, seasonName);

        console.log(`[Settlement Worker] ✓ Settled ${betsToSettle.length} bets (${wonCount} won, ${lostCount} lost, ${voidCount} void)`);

        return {
          success: true,
          settled: betsToSettle.length,
          won: wonCount,
          lost: lostCount,
          voids: voidCount,
          modelsUpdated: balanceUpdates.size,
        };
      } catch (error: any) {
        console.error(`[Settlement Worker] Error:`, error);
        throw error; // Let BullMQ handle retry
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: 3, // Process 3 settlements in parallel
    }
  );
}
