import type { MatchSeoData, MatchStatus } from '../types';
import { isMatchFinished, isMatchLive, isMatchUpcoming } from '../types';

export interface OGTemplateConfig {
  name: string;
  background: {
    gradient: string;
    angle: number;
  };
  textColor: string;
  accentColor: string;
  badge?: {
    text: string;
    textColor: string;
    background: string;
  };
  statusIndicator?: {
    text: string;
    textColor: string;
    background: string;
  };
}

export const OG_TEMPLATES: Record<MatchStatus, OGTemplateConfig> = {
  upcoming: {
    name: 'upcoming',
    background: {
      gradient: 'linear-gradient(to bottom right, #1f4037, #99b993)',
      angle: 135,
    },
    textColor: '#ffffff',
    accentColor: '#4ade80',
    badge: {
      text: 'Predictions Open',
      textColor: '#ffffff',
      background: 'rgba(74, 222, 128, 0.2)',
    },
  },
  live: {
    name: 'live',
    background: {
      gradient: 'linear-gradient(to bottom right, #2d1f3d, #1a1a2e)',
      angle: 135,
    },
    textColor: '#ffffff',
    accentColor: '#ef4444',
    statusIndicator: {
      text: '● LIVE',
      textColor: '#ffffff',
      background: 'rgba(239, 68, 68, 0.3)',
    },
  },
  finished: {
    name: 'finished',
    background: {
      gradient: 'linear-gradient(to bottom right, #1a1a2e, #16213e)',
      angle: 135,
    },
    textColor: '#ffffff',
    accentColor: '#fbbf24',
    statusIndicator: {
      text: 'FINAL',
      textColor: '#1a1a2e',
      background: 'rgba(251, 191, 36, 0.9)',
    },
  },
};

export function getTemplateForMatch(match: MatchSeoData): OGTemplateConfig {
  if (isMatchFinished(match.status)) {
    return OG_TEMPLATES.finished;
  }
  if (isMatchLive(match.status)) {
    return OG_TEMPLATES.live;
  }
  return OG_TEMPLATES.upcoming;
}

export function getScoreDisplay(
  homeScore: number | null,
  awayScore: number | null,
  status: MatchStatus
): string {
  if (isMatchUpcoming(status)) {
    return 'VS';
  }
  
  if (homeScore !== null && awayScore !== null) {
    return `${homeScore} - ${awayScore}`;
  }
  
  return 'VS';
}

export function getStatusText(match: MatchSeoData): string | null {
  if (isMatchFinished(match.status)) {
    return match.round ?? null;
  }
  if (isMatchLive(match.status)) {
    return match.matchMinute ?? 'Live';
  }
  if (isMatchUpcoming(match.status)) {
    return formatMatchDate(match.startDate);
  }
  return null;
}

function formatMatchDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export function getGradientStyles(template: OGTemplateConfig): Record<string, string> {
  return {
    background: template.background.gradient,
    backgroundAttachment: 'fixed',
    backgroundSize: 'cover',
  };
}

export function getAccentColor(status: MatchStatus): string {
  return OG_TEMPLATES[status].accentColor;
}