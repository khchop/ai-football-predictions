interface MatchH1Props {
  homeTeam: string;
  awayTeam: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
}

/**
 * Semantic H1 component for match detail pages.
 *
 * Uses sr-only class to be accessible to screen readers
 * without affecting visual layout.
 *
 * SEO-T05: Every page must have exactly one H1 tag.
 */
export function MatchH1({
  homeTeam,
  awayTeam,
  status,
  homeScore,
  awayScore,
}: MatchH1Props) {
  // Finished matches with scores: show score in H1
  const isFinished = status === 'finished';
  const hasScores = homeScore !== null && awayScore !== null;

  const h1Content =
    isFinished && hasScores
      ? `${homeTeam} ${homeScore}-${awayScore} ${awayTeam} Match Report`
      : `${homeTeam} vs ${awayTeam} AI Predictions`;

  return <h1 className="sr-only">{h1Content}</h1>;
}
