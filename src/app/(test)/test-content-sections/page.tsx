'use client';

import { MatchDataProvider } from '@/components/match/match-data-provider';
import { MatchNarrative } from '@/components/match/match-narrative';
import { SortablePredictionsTable } from '@/components/match/sortable-predictions-table';
import { PredictionsSummary } from '@/components/match/predictions-summary';
import type { Match, Competition, MatchAnalysis } from '@/types';

// Mock data aligned with database schema types

// Base match - finished state
const baseMatch: Match = {
  id: 'test-match-finished',
  externalId: 'ext-123',
  competitionId: 'epl',
  homeTeam: 'Arsenal',
  awayTeam: 'Chelsea',
  homeTeamLogo: null,
  awayTeamLogo: null,
  kickoffTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
  homeScore: 2,
  awayScore: 1,
  status: 'finished',
  matchMinute: null,
  round: 'Matchday 23',
  matchday: 23,
  venue: 'Emirates Stadium',
  isUpset: false,
  quotaHome: 3,
  quotaDraw: 5,
  quotaAway: 4,
  slug: 'arsenal-vs-chelsea-2026-02-03',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Upcoming match variant
const upcomingMatch: Match = {
  ...baseMatch,
  id: 'test-match-upcoming',
  kickoffTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
  homeScore: null,
  awayScore: null,
  status: 'scheduled',
  matchMinute: null,
};

// Live match variant
const liveMatch: Match = {
  ...baseMatch,
  id: 'test-match-live',
  kickoffTime: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 mins ago
  homeScore: 1,
  awayScore: 0,
  status: 'live',
  matchMinute: "45'",
};

const mockCompetition: Competition = {
  id: 'epl',
  name: 'Premier League',
  apiFootballId: 39,
  season: 2025,
  active: true,
  slug: 'premier-league',
  createdAt: new Date().toISOString(),
};

// Create 35 mock predictions (simulating real 35-model setup)
const providers = ['openai', 'anthropic', 'google', 'meta', 'mistral', 'cohere', 'groq', 'together'];
const mockPredictions = Array.from({ length: 35 }, (_, i) => {
  // Simulate varied predictions
  const homeScore = Math.floor(Math.random() * 4);
  const awayScore = Math.floor(Math.random() * 3);
  const isExact = homeScore === 2 && awayScore === 1;
  const isCorrectResult = (homeScore > awayScore); // Home win like actual result

  // Calculate points based on Kicktipp quota system
  let points = 0;
  if (isExact) {
    points = 3 + 1 + 4; // exact bonus + goal diff + tendency (using mock quota)
  } else if (isCorrectResult) {
    const goalDiffMatch = (homeScore - awayScore) === 1;
    points = 3 + (goalDiffMatch ? 1 : 0); // tendency + maybe goal diff
  }

  return {
    id: `pred-${i + 1}`,
    modelId: `model-${i + 1}`,
    modelDisplayName: `AI Model ${String(i + 1).padStart(2, '0')}`,
    provider: providers[i % providers.length],
    predictedHomeScore: homeScore,
    predictedAwayScore: awayScore,
    points,
    isExact,
    isCorrectResult,
  };
});

// Sort for variety - some exact, some correct result, some missed
const sortedPredictions = [
  // 3 exact score predictions (2-1)
  { ...mockPredictions[0], predictedHomeScore: 2, predictedAwayScore: 1, isExact: true, isCorrectResult: true, points: 8, modelDisplayName: 'GPT-4o' },
  { ...mockPredictions[1], predictedHomeScore: 2, predictedAwayScore: 1, isExact: true, isCorrectResult: true, points: 8, modelDisplayName: 'Claude 3.5 Sonnet' },
  { ...mockPredictions[2], predictedHomeScore: 2, predictedAwayScore: 1, isExact: true, isCorrectResult: true, points: 8, modelDisplayName: 'Gemini Pro' },
  // 10 correct result (home win but wrong score)
  ...Array.from({ length: 10 }, (_, i) => ({
    ...mockPredictions[i + 3],
    predictedHomeScore: 3,
    predictedAwayScore: 1,
    isExact: false,
    isCorrectResult: true,
    points: 3,
    modelDisplayName: `Model Winner ${i + 1}`,
  })),
  // 5 correct goal difference
  ...Array.from({ length: 5 }, (_, i) => ({
    ...mockPredictions[i + 13],
    predictedHomeScore: 1,
    predictedAwayScore: 0,
    isExact: false,
    isCorrectResult: true,
    points: 4, // tendency + goal diff bonus
    modelDisplayName: `Model GoalDiff ${i + 1}`,
  })),
  // 17 missed predictions
  ...Array.from({ length: 17 }, (_, i) => ({
    ...mockPredictions[i + 18],
    predictedHomeScore: i % 2 === 0 ? 0 : 1,
    predictedAwayScore: i % 2 === 0 ? 2 : 1,
    isExact: false,
    isCorrectResult: false,
    points: 0,
    modelDisplayName: `Model Miss ${i + 1}`,
  })),
];

// Predictions for upcoming/live (no points)
const predictionsNoPoints = sortedPredictions.map((p) => ({
  ...p,
  points: null,
  isExact: false,
  isCorrectResult: false,
}));

export default function TestContentSections() {
  return (
    <div className="container mx-auto p-8 space-y-16">
      <h1 className="text-3xl font-bold">Content Sections Visual Test</h1>
      <p className="text-muted-foreground">
        Testing MatchNarrative + SortablePredictionsTable across all match states.
        This page will be removed after verification.
      </p>

      {/* Test 1: Finished Match */}
      <section className="border border-border rounded-xl p-6 space-y-6">
        <h2 className="text-2xl font-semibold text-green-400">1. Finished Match State</h2>
        <p className="text-sm text-muted-foreground">
          Should show: &quot;Match Report&quot; heading, actual result header in table,
          color-coded points, result icons (Trophy/Target/X)
        </p>

        <MatchDataProvider
          match={baseMatch}
          competition={mockCompetition}
          analysis={null}
        >
          <div className="space-y-6">
            <MatchNarrative />
            <div>
              <h3 className="text-lg font-medium mb-4">AI Predictions (35 models)</h3>
              <PredictionsSummary predictions={sortedPredictions} />
              <SortablePredictionsTable
                predictions={sortedPredictions}
                homeTeam={baseMatch.homeTeam}
                awayTeam={baseMatch.awayTeam}
                homeScore={baseMatch.homeScore}
                awayScore={baseMatch.awayScore}
                isFinished={true}
              />
            </div>
          </div>
        </MatchDataProvider>
      </section>

      {/* Test 2: Upcoming Match */}
      <section className="border border-border rounded-xl p-6 space-y-6">
        <h2 className="text-2xl font-semibold text-blue-400">2. Upcoming Match State</h2>
        <p className="text-sm text-muted-foreground">
          Should show: &quot;Match Preview&quot; heading, NO actual result header,
          NO points column, NO result icons column, sorted alphabetically
        </p>

        <MatchDataProvider
          match={upcomingMatch}
          competition={mockCompetition}
          analysis={null}
        >
          <div className="space-y-6">
            <MatchNarrative />
            <div>
              <h3 className="text-lg font-medium mb-4">AI Predictions (35 models)</h3>
              <SortablePredictionsTable
                predictions={predictionsNoPoints}
                homeTeam={upcomingMatch.homeTeam}
                awayTeam={upcomingMatch.awayTeam}
                isFinished={false}
              />
            </div>
          </div>
        </MatchDataProvider>
      </section>

      {/* Test 3: Live Match */}
      <section className="border border-border rounded-xl p-6 space-y-6">
        <h2 className="text-2xl font-semibold text-yellow-400">3. Live Match State</h2>
        <p className="text-sm text-muted-foreground">
          Should show: &quot;Match Preview&quot; heading (same as upcoming),
          predictions table without points (match not finished)
        </p>

        <MatchDataProvider
          match={liveMatch}
          competition={mockCompetition}
          analysis={null}
        >
          <div className="space-y-6">
            <MatchNarrative />
            <div>
              <h3 className="text-lg font-medium mb-4">AI Predictions (35 models)</h3>
              <SortablePredictionsTable
                predictions={predictionsNoPoints}
                homeTeam={liveMatch.homeTeam}
                awayTeam={liveMatch.awayTeam}
                isFinished={false}
              />
            </div>
          </div>
        </MatchDataProvider>
      </section>

      {/* Verification Checklist */}
      <section className="border border-dashed border-muted rounded-xl p-6 bg-muted/10">
        <h2 className="text-xl font-semibold mb-4">Verification Checklist</h2>
        <div className="grid md:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="font-medium mb-2">Finished Match</h3>
            <ul className="space-y-1 text-muted-foreground">
              <li>[ ] Heading shows &quot;Match Report&quot;</li>
              <li>[ ] &quot;Actual Result: Arsenal 2 - 1 Chelsea&quot; header</li>
              <li>[ ] Click column headers to sort</li>
              <li>[ ] Points: green (8), yellow (4/3), gray (0)</li>
              <li>[ ] Exact rows have green background</li>
              <li>[ ] Winner rows have subtle yellow</li>
              <li>[ ] Icons: Trophy, Target, X</li>
              <li>[ ] Summary shows counts</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">Upcoming/Live Match</h3>
            <ul className="space-y-1 text-muted-foreground">
              <li>[ ] Heading shows &quot;Match Preview&quot;</li>
              <li>[ ] No &quot;Actual Result&quot; header</li>
              <li>[ ] No Points column</li>
              <li>[ ] No Result icons column</li>
              <li>[ ] Alphabetical sort default</li>
            </ul>
          </div>
          <div className="md:col-span-2">
            <h3 className="font-medium mb-2">Mobile (resize to narrow)</h3>
            <ul className="space-y-1 text-muted-foreground">
              <li>[ ] Table scrolls horizontally</li>
              <li>[ ] All 35 rows visible via scroll</li>
              <li>[ ] No content cut off</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
