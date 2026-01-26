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

function CompetitionItem({ competition, isActive }: { competition: CompetitionConfig; isActive: boolean }) {
  return (
    <DropdownMenuItem asChild>
      <Link
        href={`/leagues/${competition.id}`}
        className={cn(
          'flex items-center gap-2.5 cursor-pointer px-2 py-2 rounded-md -mx-2',
          isActive && 'bg-primary/10 font-semibold'
        )}
        style={isActive && competition.color ? { color: competition.color } : undefined}
      >
        <span className="flex-1">{competition.name}</span>
      </Link>
    </DropdownMenuItem>
  );
}

export function LeagueSelector() {
  const pathname = usePathname();
  const competitionGroups = groupCompetitionsByCategory(COMPETITIONS);
  const currentLeagueId = pathname.startsWith('/predictions/')
    ? pathname.split('/predictions/')[1]?.split('/')[0]
    : pathname.startsWith('/leagues/')
      ? pathname.split('/leagues/')[1]
      : null;
  const currentLeague = currentLeagueId ? getCompetitionById(currentLeagueId) : null;

  const domesticLeagues = competitionGroups['club-domestic'];
  const domesticMidIndex = Math.ceil(domesticLeagues.length / 2);

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
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground/70">
          European Competitions
        </DropdownMenuLabel>
        {competitionGroups['club-europe'].map((competition) => (
          <CompetitionItem
            key={competition.id}
            competition={competition}
            isActive={pathname === `/leagues/${competition.id}`}
          />
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground/70">
          Domestic Leagues
        </DropdownMenuLabel>
        <div className="grid grid-cols-2 gap-0">
          <div>
            {domesticLeagues.slice(0, domesticMidIndex).map((competition) => (
              <CompetitionItem
                key={competition.id}
                competition={competition}
                isActive={pathname === `/leagues/${competition.id}`}
              />
            ))}
          </div>
          <div>
            {domesticLeagues.slice(domesticMidIndex).map((competition) => (
              <CompetitionItem
                key={competition.id}
                competition={competition}
                isActive={pathname === `/leagues/${competition.id}`}
              />
            ))}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground/70">
          International
        </DropdownMenuLabel>
        {competitionGroups['international'].map((competition) => (
          <CompetitionItem
            key={competition.id}
            competition={competition}
            isActive={pathname === `/leagues/${competition.id}`}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
