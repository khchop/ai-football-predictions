'use client';

import { useState, useEffect } from 'react';
import { RoundupViewer } from './roundup-viewer';

interface RoundupData {
  id: string;
  matchId: string;
  title: string;
  scoreboard: {
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    competition: string;
    venue?: string;
    kickoff?: string;
  };
  events: Array<{
    minute: number;
    type: string;
    description: string;
  }>;
  stats: {
    possession: number;
    shots: number;
    shotsOnTarget: number;
    corners: number;
    xG: number;
    [key: string]: number;
  };
  modelPredictions: string;
  topPerformers: Array<{
    modelName: string;
    prediction: string;
    points: number;
  }>;
  narrative: string;
  keywords: string[];
  generatedAt: Date | string;
}

interface MatchRoundupProps {
  matchId: string;
  isFinished: boolean;
}

/**
 * MatchRoundup component - Client component that fetches and displays roundups
 * Fetches from /api/matches/[id]/roundup API endpoint
 * Only renders for finished matches
 */
export function MatchRoundup({ matchId, isFinished }: MatchRoundupProps) {
  const [roundupData, setRoundupData] = useState<RoundupData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Don't fetch if match isn't finished
    if (!isFinished) {
      return;
    }

    const fetchRoundup = async () => {
      setLoading(true);
      setError(null);
      try {
        // Use relative URL - client-side fetch resolves to current origin
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
        const res = await fetch(`${appUrl}/api/matches/${matchId}/roundup`, {
          next: { revalidate: 300 }, // 5 minutes cache for roundups
        });

        if (!res.ok) {
          // 404 means no roundup exists yet (not an error, just not available)
          if (res.status === 404) {
            setRoundupData(null);
            return;
          }
          throw new Error(`Failed to fetch roundup: ${res.statusText}`);
        }

        const data = await res.json();
        setRoundupData(data);
      } catch (err) {
        console.error('Error fetching roundup:', err);
        setError(err instanceof Error ? err.message : 'Failed to load roundup');
      } finally {
        setLoading(false);
      }
    };

    fetchRoundup();
  }, [matchId, isFinished]);

  // Don't render anything if match isn't finished
  if (!isFinished) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-6">Match Analysis</h2>
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading match analysis...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-6">Match Analysis</h2>
        <div className="text-red-500 text-center py-8">
          Unable to load match analysis
        </div>
      </div>
    );
  }

  // No roundup data yet (might take 30-60s after match finishes)
  if (!roundupData) {
    return (
      <div className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-6">Match Analysis</h2>
        <div className="text-gray-500 text-center py-8">
          Match analysis will appear here after the game concludes.
        </div>
      </div>
    );
  }

  // Render RoundupViewer with data
  return (
    <section className="mt-12 border-t pt-8">
      <h2 className="text-2xl font-bold mb-6">Match Analysis</h2>
      <RoundupViewer
        title={roundupData.title}
        scoreboard={roundupData.scoreboard}
        events={roundupData.events}
        stats={roundupData.stats}
        modelPredictions={roundupData.modelPredictions}
        topPerformers={roundupData.topPerformers}
        narrative={roundupData.narrative}
        keywords={roundupData.keywords}
      />
    </section>
  );
}
