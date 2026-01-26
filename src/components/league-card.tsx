import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy } from 'lucide-react';

interface LeagueCardProps {
  id: string;
  name: string;
  matchCount?: number;
  category?: string;
}

export function LeagueCard({ id, name, matchCount, category }: LeagueCardProps) {
  return (
    <Link href={`/predictions/${id}`}>
      <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer group">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Trophy className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{name}</h3>
            {matchCount !== undefined && (
              <p className="text-sm text-muted-foreground">
                {matchCount} match{matchCount !== 1 ? 'es' : ''}
              </p>
            )}
          </div>
          {category && (
            <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
              {category}
            </span>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
