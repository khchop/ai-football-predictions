'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { Calendar, Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface LeaderboardFiltersProps {
  className?: string;
}

export function LeaderboardFilters({ className }: LeaderboardFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const currentDays = searchParams.get('days') || 'all';
  const currentMinPredictions = searchParams.get('minPredictions') || '5';

  const updateParams = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value === 'all') {
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
      {/* Time Period Filter */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Select
          value={currentDays}
          onValueChange={(value: string) => updateParams('days', value)}
        >
          <SelectTrigger className="w-[140px] bg-card/50 border-border/50">
            <SelectValue placeholder="Time period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
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
