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

  const handleChange = (value: string) => {
    if (value === 'all') {
      // Remove the timePeriod param for 'all'
      router.push(`/teams/${teamSlug}`, { scroll: false });
    } else {
      router.push(`/teams/${teamSlug}?timePeriod=${value}`, { scroll: false });
    }
  };

  return (
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
  );
}
