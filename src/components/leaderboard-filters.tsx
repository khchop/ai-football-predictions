'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { Calendar, Filter, Trophy } from 'lucide-react';
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

// Time range options matching API TimeRange type
const TIME_RANGE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '7d', label: 'Last 7 Days' },
];

interface LeaderboardFiltersProps {
  className?: string;
}

export function LeaderboardFilters({ className }: LeaderboardFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const currentTimeRange = searchParams.get('timeRange') || 'all';
  const currentMinPredictions = searchParams.get('minPredictions') || '0';
  const currentCompetition = searchParams.get('competition') || 'all';

  const updateParams = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value === 'all' || value === '0') {
      params.delete(key);
    } else {
      params.set(key, value);
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

      {/* Time Period Filter */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Select
          value={currentTimeRange}
          onValueChange={(value: string) => updateParams('timeRange', value)}
        >
          <SelectTrigger className="w-[150px] bg-card/50 border-border/50">
            <SelectValue placeholder="Time period" />
          </SelectTrigger>
          <SelectContent>
            {TIME_RANGE_OPTIONS.map((option) => (
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
    </div>
  );
}
