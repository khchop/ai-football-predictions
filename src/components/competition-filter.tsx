'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { COMPETITIONS } from '@/lib/football/competitions';

export function CompetitionFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentCompetition = searchParams.get('competition') || 'all';
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleValueChange = useCallback((value: string) => {
    // Clear any pending navigation
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce the navigation (300ms delay)
    timeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === 'all') {
        params.delete('competition');
      } else {
        params.set('competition', value);
      }
      router.push(`/matches?${params.toString()}`);
      timeoutRef.current = null;
    }, 300);
  }, [router, searchParams]);

  return (
    <div className="flex items-center gap-2">
      <Select value={currentCompetition} onValueChange={handleValueChange}>
        <SelectTrigger className="w-[200px]" aria-label="Filter by competition">
          <SelectValue placeholder="All Competitions" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Competitions</SelectItem>
          <SelectItem value="club-europe" disabled className="text-muted-foreground">
            — European —
          </SelectItem>
          {COMPETITIONS.filter(c => c.category === 'club-europe').map((comp) => (
            <SelectItem key={comp.id} value={comp.id}>
              {comp.name}
            </SelectItem>
          ))}
          <SelectItem value="club-domestic" disabled className="text-muted-foreground">
            — Domestic —
          </SelectItem>
          {COMPETITIONS.filter(c => c.category === 'club-domestic').map((comp) => (
            <SelectItem key={comp.id} value={comp.id}>
              {comp.name}
            </SelectItem>
          ))}
          <SelectItem value="international" disabled className="text-muted-foreground">
            — International —
          </SelectItem>
          {COMPETITIONS.filter(c => c.category === 'international').map((comp) => (
            <SelectItem key={comp.id} value={comp.id}>
              {comp.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
