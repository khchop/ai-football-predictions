import type { Match } from '@/lib/db/schema';
import { MatchStatus } from './constants';

// Re-export for convenience
export type { MatchStatus };

export interface TeamData {
  name: string;
  logo: string | null;
}

export interface MatchSeoData {
  // Core identity
  id: string;
  homeTeam: string;
  awayTeam: string;
  
  // Scores (null for upcoming)
  homeScore: number | null;
  awayScore: number | null;
  
  // State
  status: MatchStatus;
  
  // Context
  competition: string;
  startDate: string;
  venue: string | null;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  
  // Additional match info
  round: string | null;
  matchMinute?: string | null;
  
  // SEO-specific derived data
  predictionsCount?: number;
  topModelName?: string;
  topModelAccuracy?: number;
}

export function mapMatchToSeoData(match: Match): MatchSeoData {
  return {
    id: match.id,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    status: mapMatchStatus(match.status),
    competition: (match.competitionId ?? 'Football') as string,
    startDate: match.kickoffTime,
    venue: match.venue,
    homeTeamLogo: match.homeTeamLogo,
    awayTeamLogo: match.awayTeamLogo,
    round: match.round,
  };
}

function mapMatchStatus(status: string | null): MatchStatus {
  switch (status) {
    case 'scheduled':
    case 'upcoming':
      return 'upcoming';
    case 'live':
      return 'live';
    case 'finished':
    case 'postponed':
    case 'cancelled':
      return 'finished';
    default:
      return 'upcoming';
  }
}

export interface MetadataInput {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogImageAlt?: string;
  noindex?: boolean;
  nofollow?: boolean;
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  section?: string;
  tags?: string[];
}

export interface SchemaInput {
  type: 'SportsEvent' | 'Article' | 'Organization' | 'Person' | 'WebSite';
  data: Record<string, unknown>;
}

export interface OGTemplateConfig {
  name: string;
  background: string;
  textColor: string;
  accentColor: string;
  badge?: {
    text: string;
    color: string;
  };
}

export function isMatchUpcoming(status: MatchStatus): boolean {
  return status === 'upcoming';
}

export function isMatchLive(status: MatchStatus): boolean {
  return status === 'live';
}

export function isMatchFinished(status: MatchStatus): boolean {
  return status === 'finished';
}

export function getMatchTitleSeparator(status: MatchStatus): string {
  return isMatchFinished(status) ? '' : 'vs';
}

export function formatMatchTitle(
  homeTeam: string,
  awayTeam: string,
  homeScore: number | null,
  awayScore: number | null,
  status: MatchStatus
): string {
  const separator = getMatchTitleSeparator(status);
  if (isMatchFinished(status) && homeScore !== null && awayScore !== null) {
    return `${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`;
  }
  return `${homeTeam} ${separator} ${awayTeam}`;
}