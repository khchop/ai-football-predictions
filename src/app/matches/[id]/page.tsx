import { notFound, permanentRedirect } from 'next/navigation';
import { getMatchWithAnalysis } from '@/lib/db/queries';
import type { Metadata } from 'next';

interface MatchPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: MatchPageProps): Promise<Metadata> {
  return {
    title: 'Redirecting...',
    robots: { index: false },
  };
}

export default async function MatchPage({ params }: MatchPageProps) {
  const { id } = await params;
  const result = await getMatchWithAnalysis(id);

  if (!result) {
    notFound();
  }

  const { match, competition } = result;

  // Redirect to canonical URL
  if (match.slug && competition.id) {
    permanentRedirect(`/leagues/${competition.id}/${match.slug}`);
  }

  // Fallback - shouldn't happen for valid matches
  notFound();
}
