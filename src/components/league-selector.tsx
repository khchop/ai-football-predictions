'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { COMPETITIONS, type CompetitionConfig } from '@/lib/football/competitions';

function getCompetitionById(id: string): CompetitionConfig | undefined {
  return COMPETITIONS.find(c => c.id === id);
}

function groupCompetitionsByCategory(competitions: CompetitionConfig[]) {
  const groups: Record<string, CompetitionConfig[]> = {
    'club-europe': [],
    'club-domestic': [],
    'international': [],
  };

  for (const competition of competitions) {
    if (groups[competition.category]) {
      groups[competition.category].push(competition);
    }
  }

  return groups;
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    'club-europe': 'European Competitions',
    'club-domestic': 'Domestic Leagues',
    'international': 'International',
  };
  return labels[category] || category;
}

export function LeagueSelector() {
  const pathname = usePathname();
  const competitionGroups = groupCompetitionsByCategory(COMPETITIONS);
  const currentLeagueId = pathname.startsWith('/leagues/')
    ? pathname.split('/leagues/')[1]
    : null;
  const currentLeague = currentLeagueId ? getCompetitionById(currentLeagueId) : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}
          aria-label="Select league"
        >
          <span className="hidden sm:inline">
            {currentLeague ? currentLeague.name : 'Leagues'}
          </span>
          <span className="sm:hidden">Leagues</span>
          <ChevronDown className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>European Competitions</DropdownMenuLabel>
        {competitionGroups['club-europe'].map((competition) => (
          <DropdownMenuItem key={competition.id} asChild>
            <Link
              href={`/leagues/${competition.id}`}
              className={cn(
                'flex items-center gap-2 cursor-pointer',
                pathname === `/leagues/${competition.id}` && 'font-semibold text-primary'
              )}
            >
              {competition.name}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Domestic Leagues</DropdownMenuLabel>
        {competitionGroups['club-domestic'].map((competition) => (
          <DropdownMenuItem key={competition.id} asChild>
            <Link
              href={`/leagues/${competition.id}`}
              className={cn(
                'flex items-center gap-2 cursor-pointer',
                pathname === `/leagues/${competition.id}` && 'font-semibold text-primary'
              )}
            >
              {competition.name}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>International</DropdownMenuLabel>
        {competitionGroups['international'].map((competition) => (
          <DropdownMenuItem key={competition.id} asChild>
            <Link
              href={`/leagues/${competition.id}`}
              className={cn(
                'flex items-center gap-2 cursor-pointer',
                pathname === `/leagues/${competition.id}` && 'font-semibold text-primary'
              )}
            >
              {competition.name}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
