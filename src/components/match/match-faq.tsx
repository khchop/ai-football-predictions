'use client';

import type { Match, Competition } from '@/lib/db/schema';
import { generateMatchFAQs } from './MatchFAQSchema';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

// Re-export for page-level schema use
export { generateMatchFAQs } from './MatchFAQSchema';

interface MatchFAQProps {
  match: Match;
  competition: Competition;
}

export function MatchFAQ({ match, competition }: MatchFAQProps) {
  const faqs = generateMatchFAQs(match, competition);

  return (
    <section className="mt-16 pt-8 border-t border-border/50">
      <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>

      <Accordion type="multiple" defaultValue={['item-0']} className="space-y-4">
        {faqs.map((faq, i) => (
          <AccordionItem key={i} value={`item-${i}`}>
            <AccordionTrigger className="text-base md:text-lg text-left">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed text-sm md:text-base">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
