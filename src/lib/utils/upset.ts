// Upset detection utilities
// An upset occurs when the underdog (team with lower win probability) wins

// Determine which team is the underdog based on win percentages
// Returns null if no clear underdog (within 5% of each other)
export function getUnderdog(
  homeWinPct: number | null,
  awayWinPct: number | null
): 'home' | 'away' | null {
  if (homeWinPct === null || awayWinPct === null) {
    return null;
  }

  const diff = Math.abs(homeWinPct - awayWinPct);
  
  // If difference is less than 5%, no clear underdog
  if (diff < 5) {
    return null;
  }

  // The team with lower win percentage is the underdog
  return homeWinPct < awayWinPct ? 'home' : 'away';
}

// Check if a match result is an upset
// An upset occurs when the underdog wins
export function isUpsetResult(
  homeWinPct: number | null,
  awayWinPct: number | null,
  actualHome: number,
  actualAway: number
): boolean {
  const underdog = getUnderdog(homeWinPct, awayWinPct);
  
  if (!underdog) {
    return false; // No clear underdog
  }

  // Check if the underdog won
  if (underdog === 'home') {
    return actualHome > actualAway; // Home team (underdog) won
  } else {
    return actualAway > actualHome; // Away team (underdog) won
  }
}

// Check if a prediction predicted the underdog to win
export function predictedUnderdogWin(
  predictedHome: number,
  predictedAway: number,
  underdog: 'home' | 'away' | null
): boolean {
  if (!underdog) {
    return false; // No underdog to predict
  }

  if (underdog === 'home') {
    return predictedHome > predictedAway; // Predicted home (underdog) win
  } else {
    return predictedAway > predictedHome; // Predicted away (underdog) win
  }
}

// Combined check: did the prediction correctly call an upset?
export function calledUpsetCorrectly(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
  homeWinPct: number | null,
  awayWinPct: number | null
): boolean {
  const underdog = getUnderdog(homeWinPct, awayWinPct);
  
  if (!underdog) {
    return false; // No underdog
  }

  const wasUpset = isUpsetResult(homeWinPct, awayWinPct, actualHome, actualAway);
  
  if (!wasUpset) {
    return false; // No upset occurred
  }

  // Check if prediction also predicted the underdog to win
  return predictedUnderdogWin(predictedHome, predictedAway, underdog);
}
