import { cn } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';

interface TeamHeroProps {
  teamName: string;
  teamSlug: string;
  logoUrl: string | null;
  leagueName: string;
  leagueId: string;
  totalMatches: number;
  record: { wins: number; draws: number; losses: number };
  winRate: number;
  goalDifference: number;
  description: string | null;
  formGuide: ('W' | 'D' | 'L')[];
}

export function TeamHero({
  teamName,
  teamSlug,
  logoUrl,
  leagueName,
  leagueId,
  totalMatches,
  record,
  winRate,
  goalDifference,
  description,
  formGuide,
}: TeamHeroProps) {
  // Get first paragraph of description for teaser
  const descriptionTeaser = description?.split('\n\n')[0] ?? null;

  // Form guide color helper
  const getFormColors = (r: 'W' | 'D' | 'L') => {
    switch (r) {
      case 'W':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'D':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'L':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
    }
  };

  return (
    <section className="bg-card border-border border rounded-xl p-6 md:p-8">
      <div className="flex items-start gap-5 md:gap-6">
        {/* Left: Logo */}
        <div className="shrink-0">
          <div className="h-20 w-20 md:h-24 md:w-24 rounded-xl bg-muted/50 flex items-center justify-center">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={teamName + ' logo'}
                width={96}
                height={96}
                className="object-contain"
                priority
              />
            ) : (
              <span className="text-3xl font-bold text-muted-foreground">
                {teamName.charAt(0)}
              </span>
            )}
          </div>
        </div>

        {/* Center: Team info */}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold">{teamName}</h1>
          <p className="text-muted-foreground mt-1">
            <Link
              href={`/leagues/${leagueId}`}
              className="hover:text-primary transition-colors hover:underline"
            >
              {leagueName}
            </Link>
            {' — '}
            {totalMatches} matches tracked
          </p>

          {/* Key stats row */}
          <div className="flex items-center gap-4 mt-3 text-sm">
            <span className="font-medium">
              {record.wins}W {record.draws}D {record.losses}L
            </span>
            <span className="text-muted-foreground">{winRate}%</span>
            <span
              className={cn(
                'font-medium',
                goalDifference > 0 && 'text-green-400',
                goalDifference < 0 && 'text-red-400'
              )}
            >
              {goalDifference > 0 ? '+' : ''}
              {goalDifference}
            </span>
          </div>

          {/* Form guide row */}
          {formGuide.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              {formGuide.map((result, index) => (
                <div
                  key={index}
                  className={cn(
                    'h-7 w-7 rounded-md flex items-center justify-center font-semibold text-xs border',
                    getFormColors(result)
                  )}
                >
                  {result}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Description teaser */}
      {descriptionTeaser && (
        <div className="mt-5 pt-5 border-t border-border/50">
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
            {descriptionTeaser}
          </p>
        </div>
      )}
    </section>
  );
}
