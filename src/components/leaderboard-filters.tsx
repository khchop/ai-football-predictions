'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { Calendar, Cpu, Filter, Home, Trophy } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Competition options - matches COMPETITIONS in src/lib/football/competitions.ts
const COMPETITION_OPTIONS = [
  { id: 'all', name: 'All Competitions' },
  { id: 'ucl', name: 'Champions League' },
  { id: 'uel', name: 'Europa League' },
  { id: 'uecl', name: 'Conference League' },
  { id: 'epl', name: 'Premier League' },
  { id: 'laliga', name: 'La Liga' },
  { id: 'bundesliga', name: 'Bundesliga' },
  { id: 'seriea', name: 'Serie A' },
  { id: 'ligue1', name: 'Ligue 1' },
  { id: 'superlig', name: 'Super Lig' },
  { id: 'nations-league', name: 'Nations League' },
];

// Time period options for filtering leaderboard data
const TIME_PERIOD_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'monthly', label: 'This Month' },
  { value: 'weekly', label: 'This Week' },
];

// Season options for filtering by football season
const SEASON_OPTIONS = [
  { value: 'all', label: 'All Seasons' },
  { value: '2024-2025', label: '2024/25' },
  { value: '2023-2024', label: '2023/24' },
  { value: '2022-2023', label: '2022/23' },
  { value: '2021-2022', label: '2021/22' },
];

// Model options for filtering by LLM model
const MODEL_OPTIONS = [
  { value: 'all', label: 'All Models' },
  { value: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', label: 'Llama 3.1 70B' },
  { value: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', label: 'Llama 3.1 8B' },
  { value: 'anthropic/claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { value: 'anthropic/claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
  { value: 'openai/gpt-4o-2024-08-06', label: 'GPT-4o' },
  { value: 'openai/gpt-4o-mini-2024-07-18', label: 'GPT-4o Mini' },
  { value: 'google/gemini-1.5-flash-002', label: 'Gemini 1.5 Flash' },
  { value: 'deepseek/deepseek-chat', label: 'DeepSeek Chat' },
];

// Club options - common club names for filtering (ID lookup happens in API)
const CLUB_OPTIONS = [
  { id: '39', name: 'Liverpool' },
  { id: '40', name: 'Man City' },
  { id: '41', name: 'Arsenal' },
  { id: '42', name: 'Man United' },
  { id: '65', name: 'Manchester City' },
  { id: '64', name: 'Liverpool' },
  { id: '66', name: 'Manchester United' },
  { id: '73', name: 'Tottenham' },
  { id: '78', name: 'Chelsea' },
  { id: '85', name: 'Barcelona' },
  { id: '86', name: 'Real Madrid' },
  { id: '82', name: 'Atletico Madrid' },
  { id: '157', name: 'Bayern Munich' },
  { id: '145', name: 'Dortmund' },
  { id: '102', name: 'Juventus' },
  { id: '115', name: 'AC Milan' },
  { id: '108', name: 'Inter' },
  { id: '79', name: 'Crystal Palace' },
  { id: '62', name: 'Leicester City' },
  { id: '63', name: 'Newcastle' },
];

interface LeaderboardFiltersProps {
  className?: string;
  disabledFilters?: string[];
}

export function LeaderboardFilters({ className, disabledFilters = [] }: LeaderboardFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const currentTimePeriod = searchParams.get('timePeriod') || 'all';
  const currentMinPredictions = searchParams.get('minPredictions') || '0';
  const currentCompetition = searchParams.get('competition') || 'all';
  const currentClub = searchParams.get('club') || 'all';
  const currentSeason = searchParams.get('season') || 'all';
  const currentModel = searchParams.get('model') || 'all';

  const updateParams = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value === 'all' || value === '0') {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    // Reset page when changing time filters to avoid empty results
    if (key === 'timePeriod') {
      params.delete('page');
    }

    // Preserve sort params if they exist
    const sortParam = searchParams.get('sort');
    const orderParam = searchParams.get('order');
    if (sortParam) params.set('sort', sortParam);
    if (orderParam) params.set('order', orderParam);

    const queryString = params.toString();
    router.push(`/leaderboard${queryString ? `?${queryString}` : ''}`, { scroll: false });
  }, [router, searchParams]);

  return (
    <div className={`flex flex-wrap items-center gap-4 ${className}`}>
      {/* Competition Filter */}
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-muted-foreground" />
        <Select
          value={currentCompetition}
          onValueChange={(value: string) => updateParams('competition', value)}
          disabled={disabledFilters.includes('competition')}
        >
          <SelectTrigger className="w-[180px] bg-card/50 border-border/50">
            <SelectValue placeholder="Competition" />
          </SelectTrigger>
          <SelectContent>
            {COMPETITION_OPTIONS.map((comp) => (
              <SelectItem key={comp.id} value={comp.id}>
                {comp.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Club Filter */}
      <div className="flex items-center gap-2">
        <Home className="h-4 w-4 text-muted-foreground" />
        <Select
          value={currentClub}
          onValueChange={(value: string) => updateParams('club', value)}
          disabled={disabledFilters.includes('club')}
        >
          <SelectTrigger className="w-[180px] bg-card/50 border-border/50">
            <SelectValue placeholder="Club" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clubs</SelectItem>
            {CLUB_OPTIONS.map((club) => (
              <SelectItem key={club.id} value={club.id}>
                {club.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Season Filter */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Select
          value={currentSeason}
          onValueChange={(value: string) => updateParams('season', value)}
          disabled={disabledFilters.includes('season')}
        >
          <SelectTrigger className="w-[140px] bg-card/50 border-border/50">
            <SelectValue placeholder="Season" />
          </SelectTrigger>
          <SelectContent>
            {SEASON_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Time Period Filter */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Select
          value={currentTimePeriod}
          onValueChange={(value: string) => updateParams('timePeriod', value)}
        >
          <SelectTrigger className="w-[150px] bg-card/50 border-border/50">
            <SelectValue placeholder="Time period" />
          </SelectTrigger>
          <SelectContent>
            {TIME_PERIOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Minimum Predictions Filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select
          value={currentMinPredictions}
          onValueChange={(value: string) => updateParams('minPredictions', value)}
        >
          <SelectTrigger className="w-[150px] bg-card/50 border-border/50">
            <SelectValue placeholder="Min predictions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">All models</SelectItem>
            <SelectItem value="3">3+ predictions</SelectItem>
            <SelectItem value="5">5+ predictions</SelectItem>
            <SelectItem value="10">10+ predictions</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Model Filter */}
      <div className="flex items-center gap-2">
        <Cpu className="h-4 w-4 text-muted-foreground" />
        <Select
          value={currentModel}
          onValueChange={(value: string) => updateParams('model', value)}
          disabled={disabledFilters.includes('model')}
        >
          <SelectTrigger className="w-[180px] bg-card/50 border-border/50">
            <SelectValue placeholder="Model" />
          </SelectTrigger>
          <SelectContent>
            {MODEL_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
