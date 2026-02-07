export interface MatchGap {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  hoursUntilKickoff: number;
  missingJobs: ('analysis' | 'predictions')[];
}

export interface MatchCoverageResult {
  percentage: number;       // 0-100, coverage of upcoming matches with jobs
  totalMatches: number;     // Total scheduled matches in time window
  coveredMatches: number;   // Matches with both analysis AND predictions jobs
  gaps: MatchGap[];         // Matches missing one or both job types
}

export interface PipelineHealthSummary {
  timestamp: string;
  coverage: MatchCoverageResult;
  gapsBySeverity: {
    critical: MatchGap[];   // < 2h to kickoff
    warning: MatchGap[];    // 2-4h to kickoff
    info: MatchGap[];       // 4-6h to kickoff
  };
}
