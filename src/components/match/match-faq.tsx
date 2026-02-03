import type { Match, Competition } from '@/lib/db/schema';
import { generateMatchFAQs, MatchFAQSchema } from './MatchFAQSchema';

interface MatchFAQProps {
  match: Match;
  competition: Competition;
}

export function MatchFAQ({ match, competition }: MatchFAQProps) {
  const faqs = generateMatchFAQs(match, competition);

  return (
    <section className="mt-16 pt-8 border-t border-border/50">
      <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>

      {/* Visual FAQ display */}
      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <details key={i} className="group border border-border/50 rounded-lg">
            <summary className="cursor-pointer font-medium text-base md:text-lg py-4 px-4 hover:bg-muted/30 transition-colors list-none flex items-center justify-between">
              <span>{faq.question}</span>
              <svg
                className="w-5 h-5 text-muted-foreground transition-transform group-open:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </summary>
            <div className="px-4 pb-4 pt-2 text-muted-foreground leading-relaxed text-sm md:text-base border-t border-border/30">
              {faq.answer}
            </div>
          </details>
        ))}
      </div>

      {/* JSON-LD schema for search engines */}
      <MatchFAQSchema match={match} competition={competition} />
    </section>
  );
}
