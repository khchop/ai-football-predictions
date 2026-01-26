import { cn } from '@/lib/utils';

interface CompetitionBadgeProps {
  name: string;
  className?: string;
}

export function CompetitionBadge({ name, className }: CompetitionBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        'bg-primary/10 text-primary',
        className
      )}
    >
      {name}
    </span>
  );
}
