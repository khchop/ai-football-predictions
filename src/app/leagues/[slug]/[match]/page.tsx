import { notFound, permanentRedirect } from 'next/navigation';
import { getMatchBySlug, getMatchWithAnalysis, getPredictionsForMatchWithDetails, getOverallStats } from '@/lib/db/queries';
import { getCompetitionByIdOrAlias } from '@/lib/football/competitions';
import type { Metadata } from 'next';
import { MatchPageSchema } from '@/components/MatchPageSchema';
import { buildMatchMetadata } from '@/lib/seo/metadata';
import { mapMatchToSeoData } from '@/lib/seo/types';
import { generateMatchFAQs, type PredictionSummary } from '@/components/match/MatchFAQSchema';
import { getMatchFAQContent, getMatchContentTimestamp } from '@/lib/content/match-content';
import { Breadcrumbs } from '@/components/navigation/breadcrumbs';
import { buildMatchBreadcrumbs } from '@/lib/navigation/breadcrumb-utils';
import { MatchDataProvider } from '@/components/match/match-data-provider';
import { MatchLayout } from '@/components/match/match-layout';


interface MatchPageProps {
  params: Promise<{
    slug: string;
    match: string;
  }>;
}

export async function generateMetadata({ params }: MatchPageProps): Promise<Metadata> {
  const { slug, match } = await params;

  // Check if slug is an alias and get competition config
  const competitionConfig = getCompetitionByIdOrAlias(slug);

  // Use competition ID for database query if alias was used
  const competitionSlug = competitionConfig?.id || slug;
  const result = await getMatchBySlug(competitionSlug, match);

  if (!result) {
    return {
      title: 'Match Not Found',
      description: 'The requested match could not be found.',
    };
  }

  const { match: matchData, competition } = result;

  // Parallelize independent queries for metadata generation
  const [analysisData, overallStats] = await Promise.all([
    getMatchWithAnalysis(matchData.id).catch(() => null),
    getOverallStats(),
  ]);

  const analysis = analysisData?.analysis;

  // Map to SEO data
  const seoData = mapMatchToSeoData(matchData);

  // Extract predicted scores from analysis if available
  if (analysis?.likelyScores) {
    try {
      const likelyScores = JSON.parse(analysis.likelyScores);
      if (likelyScores[0]) {
        const [homeScore, awayScore] = likelyScores[0].score.split('-').map(Number);
        seoData.predictedHomeScore = homeScore;
        seoData.predictedAwayScore = awayScore;
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Build canonical path using actual route structure (/leagues/{slug}/{match})
  // Use competition ID (short-form slug) after any alias resolution
  const canonicalPath = `/leagues/${competitionSlug}/${match}`;

  // Use centralized metadata builder with self-referential canonical
  return buildMatchMetadata(seoData, overallStats.activeModels, canonicalPath);
}

export default async function MatchPage({ params }: MatchPageProps) {
  const { slug, match } = await params;

  // Check if slug is an alias and get competition config
  const competitionConfig = getCompetitionByIdOrAlias(slug);

  // Redirect to canonical URL if slug is an alias
  if (competitionConfig && slug !== competitionConfig.id) {
    permanentRedirect(`/leagues/${competitionConfig.id}/${match}`);
  }

  // Use competition ID for database query (either canonical or original slug)
  const competitionSlug = competitionConfig?.id || slug;

  // Stage 1: Critical path - match data (needed for conditionals and existence check)
  let result;
  try {
    result = await getMatchBySlug(competitionSlug, match);
  } catch (error) {
    console.error('Match page database error:', error);
    notFound(); // Graceful degradation to 404 instead of 500
  }

  if (!result) {
    notFound();
  }

  const { match: matchData, competition } = result;

  // Stage 2: Parallel fetch remaining data needed for new layout
  const [
    analysisData,
    predictions,
    aiFaqs,
    contentTimestamp,
    overallStats
  ] = await Promise.all([
    getMatchWithAnalysis(matchData.id).catch(err => {
      console.error('Failed to fetch analysis:', err);
      return null;
    }),
    getPredictionsForMatchWithDetails(matchData.id).catch(err => {
      console.error('Failed to fetch predictions:', err);
      return [] as Awaited<ReturnType<typeof getPredictionsForMatchWithDetails>>;
    }),
    getMatchFAQContent(matchData.id).catch(err => {
      console.error('Failed to fetch FAQ content:', err);
      return null;
    }),
    getMatchContentTimestamp(matchData.id).catch(err => {
      console.error('Failed to fetch content timestamp:', err);
      return null;
    }),
    getOverallStats().catch(err => {
      console.error('Failed to fetch overall stats:', err);
      return { activeModels: 35, totalMatches: 0, finishedMatches: 0, totalPredictions: 0 };
    })
  ]);

  const analysis = analysisData?.analysis ?? null;

  // Build breadcrumbs
  const matchTitle = `${matchData.homeTeam} vs ${matchData.awayTeam}`;
  const breadcrumbs = buildMatchBreadcrumbs(
    competition.name,
    competitionSlug,
    matchTitle,
    matchData.slug || ''
  );

  // Format predictions for SortablePredictionsTable interface
  const formattedPredictions = predictions.map(p => ({
    id: p.predictionId,
    modelId: p.modelId,
    modelDisplayName: p.modelDisplayName,
    provider: p.provider,
    predictedHomeScore: p.predictedHome,
    predictedAwayScore: p.predictedAway,
    points: p.totalPoints,
    isExact: p.exactScoreBonus !== null && p.exactScoreBonus > 0,
    isCorrectResult: p.tendencyPoints !== null && p.tendencyPoints > 0,
  }));

  // Build prediction summary for FAQ enrichment
  const predictionSummary: PredictionSummary | undefined = predictions.length > 0 ? (() => {
    const homeWinCount = predictions.filter(p => p.predictedHome > p.predictedAway).length;
    const drawCount = predictions.filter(p => p.predictedHome === p.predictedAway).length;
    const awayWinCount = predictions.filter(p => p.predictedHome < p.predictedAway).length;

    // Find most predicted scoreline
    const scorelineCounts = new Map<string, number>();
    for (const p of predictions) {
      const key = `${p.predictedHome}-${p.predictedAway}`;
      scorelineCounts.set(key, (scorelineCounts.get(key) || 0) + 1);
    }
    const [topScoreline, topScorelineCount] = [...scorelineCounts.entries()]
      .sort((a, b) => b[1] - a[1])[0] || ['', 0];

    // Finished match stats
    const isFinished = matchData.status === 'finished';
    const correctResultCount = isFinished
      ? predictions.filter(p => p.tendencyPoints !== null && p.tendencyPoints > 0).length
      : undefined;
    const exactScoreCount = isFinished
      ? predictions.filter(p => p.exactScoreBonus !== null && p.exactScoreBonus > 0).length
      : undefined;
    const topScorerNames = isFinished
      ? predictions
          .filter(p => p.totalPoints !== null && p.totalPoints > 0)
          .sort((a, b) => (b.totalPoints ?? 0) - (a.totalPoints ?? 0))
          .slice(0, 3)
          .map(p => p.modelDisplayName)
      : undefined;

    return {
      totalModels: predictions.length,
      modelNames: predictions.map(p => p.modelDisplayName).slice(0, 5),
      homeWinCount,
      drawCount,
      awayWinCount,
      topScoreline: topScoreline || undefined,
      topScorelineCount: topScorelineCount || undefined,
      correctResultCount,
      exactScoreCount,
      topScorerNames: topScorerNames?.length ? topScorerNames : undefined,
    };
  })() : undefined;

  // Generate FAQs: use AI-generated if available, fall back to template-based with enrichment
  const faqs = aiFaqs && aiFaqs.length > 0
    ? aiFaqs
    : generateMatchFAQs(matchData, competition, { predictions: predictionSummary, analysis });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <MatchPageSchema
        match={matchData}
        competition={{ name: competition.name, slug: competitionSlug }}
        url={`https://kroam.xyz/leagues/${competitionSlug}/${matchData.slug}`}
        faqs={faqs}
        contentGeneratedAt={contentTimestamp || undefined}
        activeModels={overallStats.activeModels}
      />
      <Breadcrumbs items={breadcrumbs} />

      <h1 className="text-2xl md:text-3xl font-bold text-center">
        {matchData.homeTeam} vs {matchData.awayTeam} Prediction
      </h1>

      <MatchDataProvider
        match={matchData}
        competition={competition}
        analysis={analysis}
      >
        <MatchLayout
          predictions={formattedPredictions}
          faqs={aiFaqs}
          predictionSummary={predictionSummary}
        />
      </MatchDataProvider>
    </div>
  );
}
