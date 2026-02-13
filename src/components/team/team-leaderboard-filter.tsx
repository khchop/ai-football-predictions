'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const TIME_PERIODS = [
  { value: 'all', label: 'All Time' },
  { value: 'season', label: 'This Season' },
  { value: 'monthly', label: 'Last 30 Days' },
  { value: 'weekly', label: 'Last 7 Days' },
];

interface TeamLeaderboardFilterProps {
  teamSlug: string;
}

export function TeamLeaderboardFilter({ teamSlug }: TeamLeaderboardFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentPeriod = searchParams.get('timePeriod') || 'all';
  const currentShowArchived = searchParams.get('showArchived') || '';

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value === 'all') {
      params.delete('timePeriod');
    } else {
      params.set('timePeriod', value);
    }

    const queryString = params.toString();
    router.push(`/teams/${teamSlug}${queryString ? `?${queryString}` : ''}`, { scroll: false });
  };

  const handleArchiveToggle = () => {
    const params = new URLSearchParams(searchParams.toString());

    if (currentShowArchived === 'true') {
      params.delete('showArchived');
    } else {
      params.set('showArchived', 'true');
    }

    const queryString = params.toString();
    router.push(`/teams/${teamSlug}${queryString ? `?${queryString}` : ''}`, { scroll: false });
  };

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Select value={currentPeriod} onValueChange={handleChange}>
          <SelectTrigger className="w-[180px] bg-card/50 border-border/50">
            <SelectValue placeholder="Time period" />
          </SelectTrigger>
          <SelectContent>
            {TIME_PERIODS.map((period) => (
              <SelectItem key={period.value} value={period.value}>
                {period.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Archive Toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <span className="text-sm text-muted-foreground">Show archived</span>
        <button
          role="switch"
          aria-checked={currentShowArchived === 'true'}
          onClick={handleArchiveToggle}
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
            currentShowArchived === 'true' ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
              currentShowArchived === 'true' ? "translate-x-4" : "translate-x-0.5"
            )}
          />
        </button>
      </label>
    </div>
  );
}
