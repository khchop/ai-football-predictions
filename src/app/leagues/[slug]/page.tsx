import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCompetitionById, COMPETITIONS } from '@/lib/football/competitions';
import { LeagueHubContent } from './league-hub-content';
import { Skeleton } from '@/components/ui/skeleton';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return COMPETITIONS.map((competition) => ({
    slug: competition.id,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const competition = getCompetitionById(slug);

  if (!competition) {
    return {
      title: 'League Not Found',
    };
  }

  return {
    title: `${competition.name} | AI Football Predictions`,
    description: `Browse ${competition.name} matches with AI predictions from 35+ models. Track fixtures, results, and analysis.`,
    alternates: {
      canonical: `https://kroam.xyz/leagues/${slug}`,
    },
    openGraph: {
      title: competition.name,
      description: `${competition.name} matches with AI predictions`,
      url: `https://kroam.xyz/leagues/${slug}`,
      type: 'website' as const,
      siteName: 'kroam.xyz',
    },
    twitter: {
      card: 'summary',
      title: competition.name,
      description: `${competition.name} with AI predictions`,
    },
  };
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/50 bg-card/50 p-4">
            <Skeleton className="h-4 w-24 mb-4" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-6 w-12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function LeaguePage({ params }: PageProps) {
  const { slug } = await params;
  const competition = getCompetitionById(slug);

  if (!competition) {
    notFound();
  }

  const categoryLabels: Record<string, string> = {
    'club-europe': 'European Competition',
    'club-domestic': 'Domestic League',
    'international': 'International Tournament',
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <a href="/matches" className="hover:text-foreground transition-colors">
            Matches
          </a>
          <span>/</span>
          <span>{categoryLabels[competition.category] || competition.category}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl gradient-primary flex items-center justify-center">
            <span className="text-2xl font-bold text-white">
              {competition.name.charAt(0)}
            </span>
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">{competition.name}</h1>
            <p className="text-muted-foreground">
              Season {competition.season}-{competition.season + 1}
            </p>
          </div>
        </div>
      </div>

      {/* League Content */}
      <Suspense fallback={<LoadingSkeleton />}>
        <LeagueHubContent competitionId={competition.id} />
      </Suspense>
    </div>
  );
}
