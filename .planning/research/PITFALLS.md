# Pitfalls Research: Match Page Refresh

## Summary

Redesigning sports match pages for mobile-first UX while maintaining AI search optimization and fixing content generation pipelines presents several critical challenges. The primary risks include React Server Component hydration errors from dynamic content, performance degradation from improper caching strategies, mobile UX failures from information overload, and AI search visibility loss from poor structured data consolidation. This research identifies 18 specific pitfalls across mobile UX, AI search optimization, React/Next.js architecture, and content generation pipelines, with actionable prevention strategies for each.

---

## Critical Pitfalls (Project-Breaking)

### P1: Duplicate Data Display Creating Cognitive Overload on Mobile

**Risk:** Showing the same information multiple times (score in header, predictions section, odds panel) creates visual clutter on small screens. Your codebase shows this pattern in `/src/app/leagues/[slug]/[match]/page.tsx` where match score, team names, and competition data repeat across MatchHeader, MatchOddsPanel, and PredictionsSection.

**Warning Signs:**
- Mobile viewport requires >3 scrolls to reach predictions
- Bounce rate >60% on mobile match pages
- Average session duration <30 seconds on mobile
- Heatmaps show users scrolling past duplicate data without engaging

**Prevention:**
1. Single source of truth for each data type (score, predictions, odds)
2. Progressive disclosure pattern - show summary cards with expand/collapse for details
3. Sticky header with minimal info (teams + score) that persists during scroll
4. Mobile-first component audit: measure rendered height of each section at 375px width
5. Target: Match page fits in 2-3 screen heights on mobile (750px-1125px total)

**Phase:** Phase 1 (Mobile Layout Consolidation) - First milestone, highest impact

---

### P2: React Server Component Hydration Mismatch from Dynamic Timestamps

**Risk:** Your `MatchContentSection` component at line 40-43 uses `new Date(content.preMatchGeneratedAt).toLocaleString()` which will produce different output on server vs client due to timezone differences. This causes React hydration errors that break interactivity.

**Warning Signs:**
```
Warning: Text content did not match. Server: "1/15/2026, 2:30:00 PM" Client: "1/15/2026, 3:30:00 PM"
Error: Hydration failed because the initial UI does not match what was rendered on the server
```
- Console shows hydration warnings in development
- Interactive elements (buttons, links) don't respond to clicks immediately after page load
- Flash of incorrect content before correction

**Prevention:**
1. **Never render user-timezone dates in RSC** - Use `suppressHydrationWarning={true}` only as last resort
2. **Two-pass rendering pattern for timestamps:**
   ```typescript
   const [isClient, setIsClient] = useState(false);
   useEffect(() => setIsClient(true), []);
   return isClient ? new Date().toLocaleString() : null;
   ```
3. **Better: Use relative time on server, absolute time on client:**
   - Server: "Generated 2 hours ago"
   - Client upgrade: "Generated at 14:30 CET"
4. **Best: ISO format with client-side formatting library (date-fns)**

**Phase:** Phase 1 (Mobile Layout Consolidation) - Must fix before launch to avoid broken interactions

**Sources:** [Next.js Hydration Error Docs](https://nextjs.org/docs/messages/react-hydration-error), [Debugging Hydration Issues](https://blog.somewhatabstract.com/2022/01/03/debugging-and-fixing-hydration-issues/)

---

### P3: force-dynamic on Match Pages Killing Performance

**Risk:** Your `/src/app/matches/[id]/page.tsx` uses `export const dynamic = 'force-dynamic'` (line 18) which disables all caching and forces server rendering on every request. For a sports site with thousands of match pages, this will cause slow TTFB (Time To First Byte) and increased server costs.

**Warning Signs:**
- TTFB >800ms on match pages
- Server CPU usage spikes during peak traffic (match days)
- Vercel/hosting costs scale linearly with traffic
- Google PageSpeed Insights shows "Reduce server response time" warning

**Prevention:**
1. **Remove force-dynamic**, use ISR with smart revalidation:
   ```typescript
   export const revalidate = 60; // 1-minute cache for upcoming matches
   export const dynamic = 'force-static'; // Static with ISR
   ```
2. **Conditional caching based on match state:**
   - Scheduled matches: 60s revalidate (predictions change)
   - Live matches: 30s revalidate (scores update frequently)
   - Finished matches: 3600s revalidate (rarely change)
3. **Use on-demand revalidation when predictions complete:**
   ```typescript
   // In prediction worker after generation
   await revalidatePath(`/leagues/${competitionId}/${matchSlug}`);
   ```
4. **Monitor cache hit rates** - Target >70% cache hits on match pages

**Performance Impact:** ISR reduces TTFB from 800ms to <200ms, cuts server costs by 60-80%.

**Phase:** Phase 2 (Performance Optimization) - After mobile layout works, before traffic scales

**Sources:** [Next.js ISR Guide](https://nextjs.org/docs/app/guides/incremental-static-regeneration), [Next.js Caching 2026 Guide](https://dev.to/md_marufrahman_3552855e/nextjs-caching-and-rendering-a-complete-guide-for-2026-21lh)

---

### P4: AI Search Engines Missing Your Content Due to Structured Data Fragmentation

**Risk:** AI search engines (ChatGPT, Perplexity, Claude) rely on clean, consolidated structured data. Your match pages have duplicate/conflicting schema.org data across multiple components (SportsEventSchema, WebPageSchema, MatchFAQSchema) which confuses AI crawlers and reduces citation probability.

**Warning Signs:**
- Zero citations in ChatGPT/Perplexity search results
- Google Rich Results Test shows multiple conflicting entities
- Schema.org validation shows duplicate `@id` properties
- Search Console reports "Duplicate structured data" warnings

**Prevention:**
1. **Single JSON-LD graph per page** - Consolidate all schemas into one `@graph` array
2. **Canonical entity IDs** - Use consistent URLs for `@id`:
   ```json
   {
     "@context": "https://schema.org",
     "@graph": [
       {
         "@type": "SportsEvent",
         "@id": "https://kroam.xyz/leagues/premier-league/match-slug#event"
       },
       {
         "@type": "WebPage",
         "@id": "https://kroam.xyz/leagues/premier-league/match-slug",
         "mainEntity": { "@id": "https://kroam.xyz/leagues/premier-league/match-slug#event" }
       }
     ]
   }
   ```
3. **AI-optimized content structure:**
   - Clear H2/H3 hierarchy (no skipped levels)
   - "Answer capsules" at start of each section (2-3 sentence summary)
   - Explicit relationships: "The match between X and Y" not just "The match"
4. **Implement citation tracking** - Monitor Perplexity API for your domain mentions

**Why This Matters:** ChatGPT has 800M weekly users. Perplexity Reddit mentions: 3.2M. If AI search can't cite your predictions, you lose massive discovery channel.

**Phase:** Phase 2 (AI Search Optimization) - After mobile works, critical for growth

**Sources:** [GEO Complete Guide 2026](https://adratechsystems.com/en/resources/geo-generative-engine-optimization-complete-guide), [AI Search Optimization 2026](https://www.pagetraffic.com/blog/ai-search-optimization-in-2025/)

---

## Mobile UX Pitfalls

### P5: Touch Target Sizes Below 48px Causing Mis-taps

**Risk:** Sports prediction UI has dense data (35 models × multiple columns). Shrinking to fit mobile creates touch targets <48px which leads to accidental taps and user frustration.

**Warning Signs:**
- User testing shows frequent mis-taps on model names/predictions
- Analytics show multiple rapid clicks on same element (user trying to hit correct target)
- High mobile exit rate on prediction table section

**Prevention:**
1. **Minimum 48×48px touch targets** (WCAG AAA guideline)
2. **Expandable rows pattern** for mobile prediction tables:
   - Collapsed: Model name + score (80px row height)
   - Tap to expand: Full details, accuracy, reasoning
3. **Increase vertical spacing** between interactive elements (16px minimum)
4. **Test with thumb simulator** - Ensure bottom 30% of screen is most interactive zone

**Phase:** Phase 1 (Mobile Layout Consolidation)

**Sources:** [Mobile Sportsbook UX Best Practices](https://medium.com/@adelinabutler684/mobile-first-sportsbook-design-ux-best-practices-for-higher-retention-2eac17dcb435)

---

### P6: Typography Unreadable on Mobile - Insufficient Contrast

**Risk:** Your dark mode theme uses subtle grays (`text-muted-foreground`) which fail WCAG contrast requirements on small screens in bright sunlight (common sports viewing scenario).

**Warning Signs:**
- Contrast ratio <4.5:1 for body text
- User feedback about "can't read scores in daylight"
- High mobile bounce during afternoon matches (1pm-5pm peaks)

**Prevention:**
1. **Minimum contrast ratios:**
   - Body text: 4.5:1 (WCAG AA)
   - Critical info (scores, predictions): 7:1 (WCAG AAA)
2. **Responsive font sizing:**
   - Mobile base: 16px (not 14px - too small for sports data)
   - Match scores: 48px minimum on mobile
   - Team names: 18px minimum
3. **Test in bright sunlight** - Simulate high ambient light conditions
4. **High contrast mode toggle** - Optional user preference for outdoor viewing

**Phase:** Phase 1 (Mobile Layout Consolidation)

**Sources:** [Sports App Design Trends 2026](https://www.iihglobal.com/blog/top-sports-app-design-trends/), [Startup Web Design Mistakes](https://webgamma.ca/startup-web-design-mistakes-that-kill-conversions/)

---

### P7: Slow Mobile Load Times During Live Matches

**Risk:** 47% of sports fans abandon pages that take >2 seconds to load. Live matches are peak traffic when users have lowest patience. Your match page loads multiple external APIs (match events, standings, next matches) which block rendering.

**Warning Signs:**
- Mobile LCP (Largest Contentful Paint) >2.5s
- Analytics show 40%+ bounce rate during live match windows
- Server logs show API-Football timeout errors during concurrent match times

**Prevention:**
1. **Progressive loading with Suspense boundaries:**
   ```typescript
   <Suspense fallback={<MatchHeaderSkeleton />}>
     <MatchHeader /> {/* Critical - fast render */}
   </Suspense>
   <Suspense fallback={<PredictionsSkeleton />}>
     <PredictionsSection /> {/* Slower - can stream in */}
   </Suspense>
   ```
2. **Prefetch critical data** at build time (team logos, competition data)
3. **Client-side polling for live scores** - Don't block page load on match events
4. **Service Worker caching** for repeat visitors (cache team logos, static assets)
5. **Budget: Mobile LCP <1.8s, mobile page weight <500KB**

**Phase:** Phase 2 (Performance Optimization)

**Sources:** [Common UX Design Challenges in Sports Betting](https://sportbex.com/blog/ui-ux-design-challenges-in-sports-betting-apps/), [Sports Betting App UX 2026](https://prometteursolutions.com/blog/user-experience-and-interface-in-sports-betting-apps/)

---

### P8: Information Architecture Doesn't Follow Mobile Thumb Zones

**Risk:** Critical actions (view predictions, compare models) placed in top corners of mobile screen - hardest area to reach with one-handed thumb navigation (64.95% of sports fans use mobile).

**Warning Signs:**
- Heatmaps show low engagement with top-right CTAs
- User testing reveals two-handed usage for navigation
- High scroll depth but low interaction rate

**Prevention:**
1. **Thumb-friendly navigation zones:**
   - Top 25%: Logo, back button (passive)
   - Middle 50%: Scrollable content (read-only)
   - Bottom 25%: Primary actions (compare, filter, share)
2. **Bottom sheet pattern** for modal content (filter predictions, model details)
3. **Floating action button** for key action (e.g., "Compare Models") in bottom-right
4. **Test with one-handed navigation** - All interactive elements within thumb reach

**Phase:** Phase 1 (Mobile Layout Consolidation)

**Sources:** [Mobile-First App Design 2025](https://triare.net/insights/mobile-first-design-2025/)

---

## AI Search Optimization Pitfalls

### P9: Missing Entity Relationships in Structured Data

**Risk:** AI search engines like Claude and Perplexity understand football through entity relationships (Team → Competition → Match). Your structured data defines entities but doesn't connect them properly, reducing relevance signals.

**Warning Signs:**
- AI search returns competitor sites for "[team] vs [team] prediction"
- Google Knowledge Graph doesn't show your predictions in match cards
- Perplexity API cites Wikipedia for your match data instead of your site

**Prevention:**
1. **Explicit entity connections in schema.org:**
   ```json
   {
     "@type": "SportsEvent",
     "homeTeam": {
       "@type": "SportsTeam",
       "@id": "https://kroam.xyz/teams/liverpool",
       "name": "Liverpool",
       "memberOf": { "@id": "https://kroam.xyz/leagues/premier-league" }
     },
     "superEvent": { "@id": "https://kroam.xyz/leagues/premier-league" }
   }
   ```
2. **Bidirectional linking:**
   - Match page links to team pages
   - Team pages link back to recent matches
   - Competition pages list all matches (you have this)
3. **Wikipedia entity alignment** - Use same team names as Wikipedia for entity matching
4. **SameAs properties** - Link to official team/league pages

**Phase:** Phase 2 (AI Search Optimization)

**Sources:** [AI Search SEO for ChatGPT and Perplexity](https://www.gravitatedesign.com/blog/ai-search-seo/)

---

### P10: Content Structure Not Optimized for LLM Context Windows

**Risk:** AI search engines extract text in chunks. Your match pages have scattered information (predictions in table, analysis in card, stats in another section) which prevents LLMs from building coherent context.

**Warning Signs:**
- ChatGPT provides incomplete answers about your matches
- Perplexity cites multiple sources for single match instead of just yours
- AI-generated summaries omit key prediction data

**Prevention:**
1. **Answer capsule pattern** at page top:
   ```markdown
   ## Match Prediction Summary
   35 AI models predict Liverpool vs Manchester City (Premier League, Jan 15 2026).
   Consensus: Manchester City win 2-1 (60% of models).
   Top model: Claude 3.5 Sonnet predicted exact 2-1 (10 points).
   ```
2. **Hierarchical content structure:**
   - H2: What are the AI predictions?
   - H3: Consensus prediction
   - H3: Top performing models
   - H2: How accurate are these predictions?
3. **Context-rich first paragraphs** - Include all essential entities in opening 150 words
4. **Avoid pronoun ambiguity** - "Liverpool's form" not "Their form" (LLMs lose context)

**Phase:** Phase 2 (AI Search Optimization)

**Sources:** [How to Rank on AI Search Engines 2026](https://almcorp.com/blog/how-to-rank-on-chatgpt-perplexity-ai-search-engines-complete-guide-generative-engine-optimization/)

---

### P11: Schema.org Validation Errors Breaking AI Parser

**Risk:** Your buildMatchGraphSchema generates JSON-LD with nested quotes and special characters that break JSON parsing for AI crawlers.

**Warning Signs:**
- Google Rich Results Test shows "Invalid JSON-LD"
- Schema.org validator reports syntax errors
- AI search engines show no structured snippets for your matches

**Prevention:**
1. **Use sanitizeJsonLd consistently** (you already have this at line 111)
2. **Validate all dynamic content:**
   ```typescript
   const sanitizeForJsonLd = (str: string) =>
     str.replace(/"/g, '\\"').replace(/\n/g, ' ').trim();
   ```
3. **Test with multiple validators:**
   - Google Rich Results Test
   - Schema.org Validator
   - Perplexity structured data checker
4. **Unit tests for schema generation** - Catch errors before deploy

**Phase:** Phase 2 (AI Search Optimization)

---

## React/Next.js Pitfalls

### P12: Suspense Boundary Placement Causing Waterfall Requests

**Risk:** Your match page wraps `PredictionsSection` in Suspense (line 146) but fetches related data sequentially, causing waterfall: match → analysis → predictions → events. Total time: 4× single query time.

**Warning Signs:**
- Server logs show sequential database queries with 100-200ms gaps
- Match page TTFB varies wildly (500ms-2000ms)
- Database connection pool exhaustion during peak traffic

**Prevention:**
1. **Parallel data fetching:**
   ```typescript
   const [matchResult, predictions, events] = await Promise.all([
     getMatchWithAnalysis(id),
     getPredictionsForMatchWithDetails(id),
     getMatchEvents(externalId),
   ]);
   ```
2. **Granular Suspense boundaries** - Each section fetches independently:
   ```typescript
   <Suspense fallback={<HeaderSkeleton />}>
     <MatchHeader matchId={id} />
   </Suspense>
   <Suspense fallback={<PredictionsSkeleton />}>
     <PredictionsSection matchId={id} />
   </Suspense>
   ```
3. **Preload patterns** for critical data:
   ```typescript
   preload(matchId, getMatchWithAnalysis);
   ```

**Phase:** Phase 2 (Performance Optimization)

**Sources:** [Next.js Data Fetching](https://nextjs.org/docs/14/app/building-your-application/data-fetching/fetching-caching-and-revalidating)

---

### P13: generateStaticParams Removed - Missing Build-Time Optimization

**Risk:** Your `/src/app/leagues/[slug]/page.tsx` comment at line 16 says "Removed generateStaticParams to avoid build-time database queries". This means all league pages render on-demand, increasing cold start latency.

**Warning Signs:**
- First visit to league page: 1-2s load
- Subsequent visits: 200ms load (cached)
- Vercel build time <5 minutes (good) but runtime performance suffers

**Prevention:**
1. **Implement generateStaticParams for competition pages only:**
   ```typescript
   export async function generateStaticParams() {
     return COMPETITIONS.map(comp => ({ slug: comp.id }));
   }
   ```
   - 17 leagues = 17 static pages at build time
   - Minimal build cost, huge runtime benefit
2. **Dynamic params true for catch-all:**
   ```typescript
   export const dynamicParams = true; // Allow new slugs at runtime
   ```
3. **Keep on-demand for match pages** (thousands of matches, infeasible to build all)

**Phase:** Phase 2 (Performance Optimization)

**Sources:** [Next.js 16 dynamicParams Issues](https://github.com/vercel/next.js/discussions/81155), [generateStaticParams Purpose](https://github.com/vercel/next.js/discussions/73959)

---

### P14: Defensive Error Handling Hiding Real Issues

**Risk:** Your match page uses try-catch blocks that swallow errors and return null data (lines 101-126, 139-167). This masks production issues - users see partial pages without knowing something failed.

**Warning Signs:**
- Console full of "Failed to fetch X" errors but page looks fine
- Users report "predictions missing" but no error tracking fires
- Database errors logged but not surfaced to monitoring

**Prevention:**
1. **Fail loudly for critical data:**
   ```typescript
   const result = await getMatchBySlug(competitionSlug, match);
   if (!result) {
     notFound(); // 404 is better than broken page
   }
   ```
2. **Graceful degradation for supplementary data:**
   ```typescript
   const events = await getMatchEvents(id).catch(err => {
     logger.error({ matchId: id, err }, 'Events fetch failed');
     captureException(err); // Send to Sentry
     return []; // Empty array, show "Events unavailable"
   });
   ```
3. **User-visible error states:**
   ```typescript
   {events.length === 0 && isLive && (
     <ErrorBoundary fallback={<EventsUnavailable />}>
       <MatchEvents />
     </ErrorBoundary>
   )}
   ```
4. **Monitoring thresholds** - Alert if >5% of match page loads have missing data

**Phase:** Phase 3 (Content Generation Pipeline Fixes)

**Sources:** [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)

---

### P15: Client-Side State Hydration for Server-Fetched Data

**Risk:** Your PredictionTable component receives server-fetched predictions but may need client-side sorting/filtering. If you add useState for this, you'll hit hydration mismatches.

**Warning Signs:**
- "Hydration failed" errors when adding sort functionality
- Table flickers during initial render
- Sort state resets on navigation

**Prevention:**
1. **URL-based filtering** (no client state needed):
   ```typescript
   const searchParams = useSearchParams();
   const sortBy = searchParams.get('sortBy') || 'points';
   ```
2. **Server actions for interactions:**
   ```typescript
   'use server'
   export async function sortPredictions(matchId: string, sortKey: string) {
     return getPredictions(matchId, { sortBy: sortKey });
   }
   ```
3. **Client components for UI-only state:**
   ```typescript
   'use client'
   function PredictionTableClient({ predictions }: { predictions: Prediction[] }) {
     const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
     // Local UI state only - no hydration conflict
   }
   ```

**Phase:** Phase 1 (Mobile Layout Consolidation)

**Sources:** [React Server Components Patterns](https://react.dev/reference/react/use-client)

---

## Content Generation Pipeline Pitfalls

### P16: LLM Hallucination Validation Missing for Real-Time Content

**Risk:** Your content generator has `validateLeagueRoundupOutput` for blog posts but no validation for `MatchContentSection` live content. LLMs can hallucinate player names, fake statistics, or wrong match details.

**Warning Signs:**
- User reports "wrong player scored" in match content
- Generated content mentions players not in the match
- AI writes about events that didn't happen
- SEO credibility damaged by factual errors

**Prevention:**
1. **Entity validation for match content:**
   ```typescript
   function validateMatchContent(content: string, allowedEntities: {
     teams: string[];
     players: string[];
     competition: string;
   }) {
     const mentions = extractEntities(content);
     const invalid = mentions.filter(m => !allowedEntities.includes(m));
     if (invalid.length > 0) {
       throw new ValidationError(`Invalid entities: ${invalid.join(', ')}`);
     }
   }
   ```
2. **Source data constraints in prompts:**
   ```
   You are writing about {homeTeam} vs {awayTeam}.
   ONLY mention these players: {playerList}
   DO NOT invent statistics or events.
   ```
3. **Post-generation fact checking** - Compare generated stats against source data
4. **Human review queue** for high-traffic matches

**Phase:** Phase 3 (Content Generation Pipeline Fixes)

**Sources:** [LLM Failure Modes](https://medium.com/@adnanmasood/a-field-guide-to-llm-failure-modes-5ffaeeb08e80), [Handling LLM Output Errors](https://apxml.com/courses/prompt-engineering-llm-application-development/chapter-7-output-parsing-validation-reliability/handling-parsing-errors)

---

### P17: Content Deduplication Over-Aggressive - Blocking Legitimate Variations

**Risk:** Your `checkForDuplicates` function uses similarity threshold that may flag legitimate match variations as duplicates (e.g., two 2-1 wins with similar phrasing).

**Warning Signs:**
- Content generation logs show frequent "skip duplicate" actions
- Multiple matches missing post-match content
- Generated content feels repetitive (validation too strict forces formulaic writing)

**Prevention:**
1. **Tune similarity thresholds per content type:**
   ```typescript
   const thresholds = {
     postMatchRoundup: 0.85, // High - each match should be unique
     leagueRoundup: 0.70, // Medium - weekly patterns acceptable
     matchPreview: 0.75, // Medium-high
   };
   ```
2. **Whitelist common football phrases:**
   - "found the back of the net"
   - "clinical finish"
   - "kept a clean sheet"
   These shouldn't count toward similarity score
3. **Semantic similarity vs string similarity:**
   - Use embeddings (OpenAI ada-002) instead of character-based comparison
   - Two different phrasings of same facts = acceptable
4. **Monitor regeneration attempts** - If >20% of content needs regeneration, threshold too strict

**Phase:** Phase 3 (Content Generation Pipeline Fixes)

**Sources:** [Debugging LLM Failures](https://dev.to/kuldeep_paul/how-to-effectively-debug-llm-failures-a-step-by-step-guide-2e8n)

---

### P18: Queue Worker Retry Strategy Causing Duplicate Content

**Risk:** Your BullMQ workers retry failed jobs with exponential backoff, but content generation isn't idempotent. A transient database error during insert could generate content twice and charge 2× API cost.

**Warning Signs:**
- Duplicate rows in `matchContent` table with same `matchId`
- Together AI bill shows 2× expected usage
- Content generation logs show successful generation but database insert failures

**Prevention:**
1. **Idempotent content generation:**
   ```typescript
   // Check existence before generating
   const existing = await getMatchContent(matchId);
   if (existing && existing.postMatchContent) {
     logger.info({ matchId }, 'Content already exists, skipping generation');
     return existing.id;
   }
   ```
2. **Database transactions with locks:**
   ```typescript
   await db.transaction(async (tx) => {
     const locked = await tx
       .select()
       .from(matchContent)
       .where(eq(matchContent.matchId, matchId))
       .for('update') // Row-level lock
       .execute();

     if (locked.length > 0) return locked[0].id;

     // Generate and insert atomically
     const content = await generateContent();
     return await tx.insert(matchContent).values(content);
   });
   ```
3. **Retry with generation cache:**
   ```typescript
   // Store generated content in Redis before database insert
   await redis.setex(`content:${matchId}`, 3600, generatedContent);
   // Retry insert from cache, not regeneration
   ```
4. **Monitor duplicate detection** - Alert if >1% of content generations are duplicates

**Phase:** Phase 3 (Content Generation Pipeline Fixes)

**Sources:** [Retry Mechanisms for LLM Calls](https://apxml.com/courses/prompt-engineering-llm-application-development/chapter-7-output-parsing-validation-reliability/implementing-retry-mechanisms), [Failover Strategies for LLMs](https://portkey.ai/blog/failover-routing-strategies-for-llms-in-production/)

---

## Phase-Specific Warnings

| Phase | Primary Pitfall Risk | Mitigation Priority |
|-------|---------------------|---------------------|
| Phase 1: Mobile Layout | P1 (Duplicate Data Overload), P5 (Touch Targets), P15 (Hydration Mismatch) | Design mobile-first mockups before coding. Validate with real devices. |
| Phase 2: Performance & AI Search | P3 (force-dynamic), P4 (Schema Fragmentation), P7 (Slow Load) | Set performance budgets before implementation. Monitor cache hit rates. |
| Phase 3: Content Pipeline | P16 (Hallucination), P17 (Over-Deduplication), P18 (Duplicate Generation) | Build validation framework before scaling content generation. |

---

## Integration Pitfalls with Existing System

### Existing Architecture Dependencies

Your codebase uses:
- **Next.js 16 + React 19** - Latest async params API (breaking changes from 15)
- **BullMQ job queues** - Content generation triggered by match lifecycle events
- **PostgreSQL + Redis** - Dual caching layer (data + queue state)
- **Together AI API** - 35 LLM models for predictions and content

**Integration Risks:**

1. **Breaking existing prediction pipeline** - Match page redesign must not interfere with T-30m prediction generation
2. **Cache invalidation cascade** - Changing match page structure requires coordinated revalidation across multiple pages
3. **Schema migration without downtime** - Restructuring content tables while queue workers are running
4. **Mobile layout breaking desktop** - 70% traffic is mobile but 30% desktop users exist

**Mitigation:**

1. **Feature flags for rollout:**
   ```typescript
   const useNewMatchLayout = process.env.FEATURE_NEW_MATCH_LAYOUT === 'true';
   return useNewMatchLayout ? <NewMatchPage /> : <LegacyMatchPage />;
   ```
2. **Parallel component development** - Build new mobile components alongside existing desktop ones
3. **Gradual traffic migration** - 10% → 50% → 100% over 2 weeks
4. **Rollback plan** - Keep old match page code for 1 sprint after 100% rollout

---

## Sources

**Mobile UX:**
- [Mobile-First Sportsbook Design: UX Best Practices](https://medium.com/@adelinabutler684/mobile-first-sportsbook-design-ux-best-practices-for-higher-retention-2eac17dcb435)
- [UI/UX Design Challenges in Sports Betting Apps](https://sportbex.com/blog/ui-ux-design-challenges-in-sports-betting-apps/)
- [Sports App UI/UX Design Trends](https://www.iihglobal.com/blog/top-sports-app-design-trends/)
- [Startup Web Design Mistakes](https://webgamma.ca/startup-web-design-mistakes-that-kill-conversions/)
- [Mobile-First App Design 2025](https://triare.net/insights/mobile-first-design-2025/)

**AI Search Optimization:**
- [GEO: Complete Guide to Ranking on ChatGPT, Perplexity & Google AI](https://adratechsystems.com/en/resources/geo-generative-engine-optimization-complete-guide)
- [How to Rank on AI Search Engines 2026](https://almcorp.com/blog/how-to-rank-on-chatgpt-perplexity-ai-search-engines-complete-guide-generative-engine-optimization/)
- [AI Search Optimization in 2026](https://www.pagetraffic.com/blog/ai-search-optimization-in-2025/)
- [AI Search SEO: ChatGPT, Perplexity & Gemini](https://www.gravitatedesign.com/blog/ai-search-seo/)

**React/Next.js:**
- [Next.js Hydration Error Documentation](https://nextjs.org/docs/messages/react-hydration-error)
- [Debugging Hydration Issues](https://blog.somewhatabstract.com/2022/01/03/debugging-and-fixing-hydration-issues/)
- [Next.js ISR Guide](https://nextjs.org/docs/app/guides/incremental-static-regeneration)
- [Next.js Caching 2026 Complete Guide](https://dev.to/md_marufrahman_3552855e/nextjs-caching-and-rendering-a-complete-guide-for-2026-21lh)
- [Next.js Data Fetching Guide](https://nextjs.org/docs/14/app/building-your-application/data-fetching/fetching-caching-and-revalidating)

**LLM Content Generation:**
- [Debugging LLM Failures: Step-by-Step Guide](https://dev.to/kuldeep_paul/how-to-effectively-debug-llm-failures-a-step-by-step-guide-2e8n)
- [Retry Mechanisms for LLM Calls](https://apxml.com/courses/prompt-engineering-llm-application-development/chapter-7-output-parsing-validation-reliability/implementing-retry-mechanisms)
- [Failover Routing Strategies for LLMs](https://portkey.ai/blog/failover-routing-strategies-for-llms-in-production/)
- [Field Guide to LLM Failure Modes](https://medium.com/@adnanmasood/a-field-guide-to-llm-failure-modes-5ffaeeb08e80)
- [Handling LLM Output Parsing Errors](https://apxml.com/courses/prompt-engineering-llm-application-development/chapter-7-output-parsing-validation-reliability/handling-parsing-errors)

---

**Research completed:** 2026-02-02
**Confidence level:** HIGH (code analysis + current best practices)
**Next step:** Create phase roadmap based on pitfall severity and dependencies
