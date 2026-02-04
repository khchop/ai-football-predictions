import { notFound, permanentRedirect } from 'next/navigation';
import { getMatchBySlug, getMatchWithAnalysis, getPredictionsForMatchWithDetails } from '@/lib/db/queries';
import { getCompetitionByIdOrAlias } from '@/lib/football/competitions';
import type { Metadata } from 'next';
import { MatchPageSchema } from '@/components/MatchPageSchema';
import { buildMatchMetadata } from '@/lib/seo/metadata';
import { mapMatchToSeoData } from '@/lib/seo/types';
import { generateMatchFAQs } from '@/components/match/MatchFAQSchema';
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

  // Get analysis for predicted scores (with graceful degradation)
  const analysisData = await getMatchWithAnalysis(matchData.id).catch(() => null);
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

  // Use centralized metadata builder
  return buildMatchMetadata(seoData);
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
    contentTimestamp
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

  // Generate FAQs: use AI-generated if available, fall back to template-based
  const faqs = aiFaqs && aiFaqs.length > 0 ? aiFaqs : generateMatchFAQs(matchData, competition);

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

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <MatchPageSchema
        match={matchData}
        competition={{ name: competition.name, slug: competitionSlug }}
        url={`https://kroam.xyz/leagues/${competitionSlug}/${matchData.slug}`}
        faqs={faqs}
        contentGeneratedAt={contentTimestamp || undefined}
      />
      <Breadcrumbs items={breadcrumbs} />

      <MatchDataProvider
        match={matchData}
        competition={competition}
        analysis={analysis}
      >
        <MatchLayout
          predictions={formattedPredictions}
          faqs={aiFaqs}
        />
      </MatchDataProvider>
    </div>
  );
}
