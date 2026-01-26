'use client';

import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { COMPETITIONS } from '@/lib/football/competitions';
import { Card, CardContent } from '@/components/ui/card';

export function QuickLeagueLinks() {
  const categoryLabels: Record<string, string> = {
    'club-europe': 'European',
    'club-domestic': 'Domestic',
    'international': 'International',
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">Quick Access</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {COMPETITIONS.map((competition) => (
          <Link key={competition.id} href={`/predictions/${competition.id}`}>
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer group">
              <CardContent className="p-3 flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors flex-shrink-0">
                  <Trophy className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium truncate">{competition.name}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
