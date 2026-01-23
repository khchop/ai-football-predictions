/**
 * TypeScript types for all job payloads
 */

// Fetch fixtures (repeatable, no payload needed)
export interface FetchFixturesPayload {
  manual?: boolean; // True if triggered manually via API
}

// Analyze match (T-6h)
export interface AnalyzeMatchPayload {
  matchId: string;
  externalId: string;
  homeTeam: string;
  awayTeam: string;
}

// Refresh odds (T-2h)
export interface RefreshOddsPayload {
  matchId: string;
  externalId: string;
}

// Fetch lineups (T-60m)
export interface FetchLineupsPayload {
  matchId: string;
  externalId: string;
  homeTeam: string;
  awayTeam: string;
}

// Predict match (T-90m, T-30m, T-5m)
export interface PredictMatchPayload {
  matchId: string;
  attempt: 1 | 2 | 3;
  skipIfDone?: boolean;  // Skip if bets already exist
  force?: boolean;       // Generate even without lineups
}

// Monitor live (kickoff, repeats every 60s)
export interface MonitorLivePayload {
  matchId: string;
  externalId: string;
  kickoffTime: string;
  pollCount?: number; // Track how many times we've polled
}

// Settle match (when match ends)
export interface SettleMatchPayload {
  matchId: string;
  homeScore: number;
  awayScore: number;
  status: string; // FT, AET, PEN, etc.
}

// Catch-up (one-time on deploy)
export interface CatchUpPayload {
  since?: string; // ISO date string
}

// Backfill missing data (repeatable)
export interface BackfillMissingPayload {
  manual?: boolean;     // True if triggered manually via API
  hoursAhead?: number;  // How far ahead to look (default 12)
  type?: 'stuck-matches'; // Special type for stuck match recovery
}

// Generate AI content (match previews, league roundups, model reports)
export interface GenerateContentPayload {
  type: 'match_preview' | 'league_roundup' | 'model_report' | 'scan_matches' | 'scan_match_content' | 'scan_league_roundups';
  data: Record<string, unknown>;
}

// Union type for all payloads
export type JobPayload =
  | FetchFixturesPayload
  | BackfillMissingPayload
  | AnalyzeMatchPayload
  | RefreshOddsPayload
  | FetchLineupsPayload
  | PredictMatchPayload
  | MonitorLivePayload
  | SettleMatchPayload
  | CatchUpPayload
  | GenerateContentPayload;
