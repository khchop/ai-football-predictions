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
  allowRetroactive?: boolean; // Skip status check for retroactive backfill
}

// Refresh odds (T-2h)
export interface RefreshOddsPayload {
  matchId: string;
  externalId: string;
}

// Predict match (T-30m)
export interface PredictMatchPayload {
  matchId: string;
  attempt: 1 | 2 | 3;
  skipIfDone?: boolean;  // Skip if bets already exist
  allowRetroactive?: boolean; // Skip status check for retroactive backfill
}

// Prediction job data (extends payload with retry tracking)
export interface PredictionJobData extends PredictMatchPayload {
  retryCount?: number;
}

// Job execution result
export interface JobResult {
  success: boolean;
  predictionCount?: number;
  failedCount?: number;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

// Job status enumeration
export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

// Worker configuration
export interface WorkerConfig {
  concurrency: number;
  maxRetries: number;
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
// Also includes monitoring job types for worker health and content completeness checks
export interface GenerateContentPayload {
  type: 'match_preview' | 'league_roundup' | 'model_report' | 'scan_matches' | 'scan_match_content' | 'scan_league_roundups' | 'generate-roundup' | 'worker_health_check' | 'content_completeness_check';
  data: Record<string, unknown>;
}

// Generate post-match roundup content (triggered after settlement)
export interface GenerateRoundupPayload {
  type: 'generate-roundup';
  data: {
    matchId: string;
    triggeredAt: string; // ISO timestamp when settlement completed
  };
}

// Update standings (repeatable, daily)
export interface UpdateStandingsPayload {
  maxAgeHours?: number; // Only update standings older than this (default 24)
}

// Union type for all payloads
export type JobPayload =
  | FetchFixturesPayload
  | BackfillMissingPayload
  | AnalyzeMatchPayload
  | RefreshOddsPayload
  | PredictMatchPayload
  | MonitorLivePayload
  | SettleMatchPayload
  | CatchUpPayload
  | GenerateContentPayload
  | GenerateRoundupPayload
  | UpdateStandingsPayload;
