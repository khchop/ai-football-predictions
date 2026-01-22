import { format } from 'date-fns';

interface AnswerCapsuleStat {
  label: string;
  value: string | number;
}

interface AnswerCapsuleProps {
  question?: string;
  answer: string;
  stats?: AnswerCapsuleStat[];
  source?: string;
  lastUpdated?: Date;
  className?: string;
}

export function AnswerCapsule({ 
  question, 
  answer, 
  stats, 
  source, 
  lastUpdated,
  className = ''
}: AnswerCapsuleProps) {
  return (
    <div className={`bg-primary/5 border border-primary/20 rounded-xl p-6 mb-8 ${className}`}>
      {question && (
        <h2 className="text-lg font-semibold mb-3">{question}</h2>
      )}
      
      <p className="text-lg leading-relaxed mb-4">{answer}</p>
      
      {stats && stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
          {stats.map((stat, i) => (
            <div key={i} className="text-center p-3 rounded-lg bg-muted/30">
              <p className="text-2xl font-bold gradient-text">{stat.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      )}
      
      <div className="flex flex-wrap justify-between items-center mt-4 pt-4 border-t border-border/50 text-xs text-muted-foreground gap-2">
        {source && <span>Data: {source}</span>}
        {lastUpdated && (
          <span>Updated: {format(lastUpdated, 'MMM d, yyyy HH:mm')}</span>
        )}
      </div>
    </div>
  );
}
