import { MatchDataProvider } from '@/components/match/match-data-provider';
import { MatchHero } from '@/components/match/match-hero';
import type { Match, Competition } from '@/types';

// Mock Competition
const mockCompetition: Competition = {
  id: 'comp-1',
  name: 'Premier League',
  apiFootballId: 39,
  season: 2024,
  active: true,
  slug: 'premier-league',
  createdAt: new Date().toISOString(),
};

// Mock Upcoming Match
const mockUpcoming: Match = {
  id: 'test-1',
  externalId: null,
  competitionId: 'comp-1',
  homeTeam: 'Manchester United',
  awayTeam: 'Liverpool',
  homeTeamLogo: '/team-logos/man-utd.png',
  awayTeamLogo: '/team-logos/liverpool.png',
  kickoffTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
  homeScore: null,
  awayScore: null,
  status: 'scheduled',
  matchMinute: null,
  round: 'Matchday 20',
  matchday: 20,
  venue: 'Old Trafford',
  isUpset: false,
  quotaHome: null,
  quotaDraw: null,
  quotaAway: null,
  slug: 'manchester-united-vs-liverpool-2026-02-04',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Mock Live Match
const mockLive: Match = {
  ...mockUpcoming,
  id: 'test-2',
  externalId: '12345',
  homeTeam: 'Chelsea',
  awayTeam: 'Arsenal',
  homeTeamLogo: '/team-logos/chelsea.png',
  awayTeamLogo: '/team-logos/arsenal.png',
  homeScore: 2,
  awayScore: 1,
  status: 'live',
  matchMinute: "67'",
  kickoffTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  slug: 'chelsea-vs-arsenal-2026-02-03',
};

// Mock Finished Match (Home Win)
const mockFinished: Match = {
  ...mockUpcoming,
  id: 'test-3',
  homeTeam: 'Manchester City',
  awayTeam: 'Tottenham',
  homeTeamLogo: '/team-logos/man-city.png',
  awayTeamLogo: '/team-logos/tottenham.png',
  homeScore: 3,
  awayScore: 0,
  status: 'finished',
  kickoffTime: new Date(Date.now() - 86400000).toISOString(), // Yesterday
  slug: 'manchester-city-vs-tottenham-2026-02-02',
};

// Mock Postponed Match
const mockPostponed: Match = {
  ...mockUpcoming,
  id: 'test-4',
  homeTeam: 'Newcastle',
  awayTeam: 'Everton',
  homeTeamLogo: '/team-logos/newcastle.png',
  awayTeamLogo: '/team-logos/everton.png',
  status: 'postponed',
  slug: 'newcastle-vs-everton-2026-02-04',
};

// Mock Cancelled Match
const mockCancelled: Match = {
  ...mockUpcoming,
  id: 'test-5',
  homeTeam: 'West Ham',
  awayTeam: 'Aston Villa',
  homeTeamLogo: '/team-logos/west-ham.png',
  awayTeamLogo: '/team-logos/aston-villa.png',
  status: 'cancelled',
  slug: 'west-ham-vs-aston-villa-2026-02-04',
};

export default function TestHeroPage() {
  return (
    <div className="container mx-auto py-8 space-y-12">
      <h1 className="text-3xl font-bold">MatchHero Test Harness</h1>
      <p className="text-muted-foreground">
        Visual verification of MatchHero component across all match states.
      </p>

      <section>
        <h2 className="text-xl font-semibold mb-4">Upcoming Match</h2>
        <MatchDataProvider match={mockUpcoming} competition={mockCompetition} analysis={null}>
          <MatchHero />
        </MatchDataProvider>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Live Match</h2>
        <MatchDataProvider match={mockLive} competition={mockCompetition} analysis={null}>
          <MatchHero />
        </MatchDataProvider>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Finished Match (Home Win)</h2>
        <MatchDataProvider match={mockFinished} competition={mockCompetition} analysis={null}>
          <MatchHero />
        </MatchDataProvider>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Postponed Match</h2>
        <MatchDataProvider match={mockPostponed} competition={mockCompetition} analysis={null}>
          <MatchHero />
        </MatchDataProvider>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Cancelled Match</h2>
        <MatchDataProvider match={mockCancelled} competition={mockCompetition} analysis={null}>
          <MatchHero />
        </MatchDataProvider>
      </section>
    </div>
  );
}
