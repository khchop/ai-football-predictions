import { cn } from '@/lib/utils';

interface CompetitionBadgeProps {
  name: string;
  className?: string;
  showIcon?: boolean;
}

export function CompetitionBadge({ name, className, showIcon = false }: CompetitionBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        'bg-primary/10 text-primary',
        className
      )}
    >
      {showIcon && (
        <span className="w-3 h-3 rounded-full bg-primary/20" />
      )}
      {name}
    </span>
  );
}
