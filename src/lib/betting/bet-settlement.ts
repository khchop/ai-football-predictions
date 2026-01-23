// Bet settlement logic - evaluate bets and calculate payouts

import { loggers } from '@/lib/logger/modules';

/**
 * Evaluate a result bet (match winner or double chance)
 * @param selection - '1', 'X', '2', '1X', 'X2', '12'
 * @param homeScore - Home team score
 * @param awayScore - Away team score
 * @returns true if bet won, false if lost
 */
export function evaluateResultBet(
  selection: string,
  homeScore: number,
  awayScore: number
): boolean {
  const homeWin = homeScore > awayScore;
  const draw = homeScore === awayScore;
  const awayWin = awayScore > homeScore;

  switch (selection) {
    case '1': // Home win
      return homeWin;
    case 'X': // Draw
      return draw;
    case '2': // Away win
      return awayWin;
    case '1X': // Home win or draw
      return homeWin || draw;
    case 'X2': // Draw or away win
      return draw || awayWin;
     case '12': // Home win or away win (no draw)
       return homeWin || awayWin;
     default:
       loggers.betSettlement.error({ selection }, 'Unknown result bet selection');
       return false;
  }
}

/**
 * Evaluate an over/under bet
 * @param selection - 'O2.5', 'U1.5', etc.
 * @param homeScore - Home team score
 * @param awayScore - Away team score
 * @returns true if bet won, false if lost
 */
export function evaluateOverUnderBet(
  selection: string,
  homeScore: number,
  awayScore: number
): boolean {
  const totalGoals = homeScore + awayScore;
  
  // Parse selection (e.g., "O2.5" or "U1.5")
  const isOver = selection.startsWith('O');
   const line = parseFloat(selection.substring(1)); // Remove 'O' or 'U' and parse

   if (isNaN(line)) {
     loggers.betSettlement.error({ selection }, 'Invalid over/under selection');
     return false;
   }

  if (isOver) {
    return totalGoals > line;
  } else {
    return totalGoals < line;
  }
}

/**
 * Evaluate a BTTS (Both Teams To Score) bet
 * @param selection - 'Yes' or 'No'
 * @param homeScore - Home team score
 * @param awayScore - Away team score
 * @returns true if bet won, false if lost
 */
export function evaluateBttsBet(
  selection: string,
  homeScore: number,
  awayScore: number
): boolean {
  const bothScored = homeScore > 0 && awayScore > 0;

   if (selection === 'Yes') {
     return bothScored;
   } else if (selection === 'No') {
     return !bothScored;
   } else {
     loggers.betSettlement.error({ selection }, 'Unknown BTTS selection');
     return false;
   }
}

/**
 * Calculate payout for a bet
 * @param stake - Amount wagered
 * @param odds - Decimal odds
 * @param won - Whether the bet won
 * @returns Payout amount (stake returned + winnings if won, 0 if lost)
 */
export function calculatePayout(stake: number, odds: number, won: boolean): number {
  if (won) {
    return stake * odds; // Payout includes stake
  }
  return 0; // Lost bets return nothing
}

/**
 * Calculate profit for a bet
 * @param stake - Amount wagered
 * @param payout - Payout amount
 * @returns Profit (payout - stake, negative if lost)
 */
export function calculateProfit(stake: number, payout: number): number {
  return payout - stake;
}
