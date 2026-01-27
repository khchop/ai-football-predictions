import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getMatchWithAnalysis } from '@/lib/db/queries';
import { buildMatchMetadata } from '@/lib/seo/metadata';
import { buildMatchGraphSchema, sanitizeJsonLd } from '@/lib/seo/schema/graph';
import { mapMatchToSeoData } from '@/lib/seo/types';

export const revalidate = 60;

interface StatsPageProps {
  params: Promise<{ id: string }>;
}

// Generate metadata for SEO
export async function generateMetadata({ params }: StatsPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getMatchWithAnalysis(id);
  
  if (!result) {
    return {
      title: 'Match Stats Not Found',
      description: 'The requested match statistics could not be found.',
    };
  }

  const { match } = result;
  const seoData = mapMatchToSeoData(match);
  
  // Stats-specific title and description
  const title = `${match.homeTeam} vs ${match.awayTeam} - Statistics & Predictions Breakdown`;
  const description = `Detailed stats for ${match.homeTeam} vs ${match.awayTeam}. Model prediction accuracy, score distribution, and performance metrics.`;
  
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `/matches/${id}/stats`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function StatsPage({ params }: StatsPageProps) {
  const { id } = await params;
  const result = await getMatchWithAnalysis(id);

  if (!result) {
    notFound();
  }

  const { match, competition, analysis } = result;
  
  // Build JSON-LD structured data for the match stats
  const seoData = mapMatchToSeoData(match);
  const jsonLd = buildMatchGraphSchema(seoData);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: sanitizeJsonLd(jsonLd),
        }}
      />
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">Match Statistics</h1>
        <p>Statistics page for {match.homeTeam} vs {match.awayTeam}</p>
        {analysis && (
          <div className="bg-card/50 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Analysis Data Available</h2>
            <pre className="text-xs overflow-auto">{JSON.stringify(analysis, null, 2)}</pre>
          </div>
        )}
      </div>
    </>
  );
}