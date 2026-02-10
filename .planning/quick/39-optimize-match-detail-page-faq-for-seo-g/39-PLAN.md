---
phase: quick-39
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/match/MatchFAQSchema.tsx
  - src/app/leagues/[slug]/[match]/page.tsx
  - src/components/match/match-layout.tsx
  - src/components/match/match-faq.tsx
autonomous: true

must_haves:
  truths:
    - "Template FAQ answers contain real prediction counts, model names, and percentages instead of generic placeholders"
    - "Finished match FAQs include actual accuracy stats (correct predictions count, exact score hits)"
    - "Upcoming match FAQs include real odds, H2H stats, and team form data when available"
    - "FAQ answers are self-contained and never say 'see above' or 'check the table'"
    - "Both call sites (page.tsx server-side, match-faq.tsx client-side) pass enriched data"
  artifacts:
    - path: "src/components/match/MatchFAQSchema.tsx"
      provides: "Enhanced generateMatchFAQs with optional prediction/analysis data"
      contains: "PredictionSummary"
    - path: "src/app/leagues/[slug]/[match]/page.tsx"
      provides: "Server-side call passing prediction summary and analysis to generateMatchFAQs"
      contains: "generateMatchFAQs"
    - path: "src/components/match/match-faq.tsx"
      provides: "Client-side fallback passing predictions prop to generateMatchFAQs"
      contains: "generateMatchFAQs"
  key_links:
    - from: "src/app/leagues/[slug]/[match]/page.tsx"
      to: "src/components/match/MatchFAQSchema.tsx"
      via: "generateMatchFAQs call with prediction summary + analysis"
      pattern: "generateMatchFAQs\\(matchData.*predictions"
    - from: "src/components/match/match-layout.tsx"
      to: "src/components/match/match-faq.tsx"
      via: "predictions prop threaded through to MatchFAQ"
      pattern: "predictions.*MatchFAQ"
---

<objective>
Replace generic/static template FAQ answers with fully dynamic, data-rich answers that use actual prediction statistics, odds, H2H records, and team form data. This makes the fallback FAQs (used when AI-generated FAQs aren't available) produce SEO/GEO-quality content with real numbers instead of placeholders like "check the table above" or "GPT-4, Claude, and Gemini."

Purpose: Improve SEO/GEO quality for match detail pages -- FAQ answers that contain actual data rank better in featured snippets and are more useful for AI search engine consumption.

Output: Updated MatchFAQSchema.tsx with enriched FAQ generation, updated call sites in page.tsx and match-faq.tsx to pass available data.
</objective>

<execution_context>
@/Users/pieterbos/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pieterbos/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@src/components/match/MatchFAQSchema.tsx
@src/components/match/match-faq.tsx
@src/components/match/match-layout.tsx
@src/app/leagues/[slug]/[match]/page.tsx
@src/components/MatchPageSchema.tsx
@src/components/match/match-data-provider.tsx
@src/lib/db/schema.ts (lines 162-252 for MatchAnalysis type)
@src/lib/db/queries.ts (lines 1900-1924 for getPredictionsForMatchWithDetails return type)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Enhance generateMatchFAQs with rich data parameters and dynamic answer generation</name>
  <files>src/components/match/MatchFAQSchema.tsx</files>
  <action>
Expand `generateMatchFAQs()` to accept optional enrichment data while maintaining backward compatibility (existing signature still works with just match + competition).

1. Define a `PredictionSummary` interface in the same file:
```typescript
export interface PredictionSummary {
  totalModels: number;
  modelNames: string[];           // e.g. ["Gemini 2.5 Pro", "GPT-4.1", ...]
  homeWinCount: number;
  drawCount: number;
  awayWinCount: number;
  topScoreline?: string;          // e.g. "2-1" (most predicted)
  topScorelineCount?: number;     // how many models predicted it
  // Finished match only:
  correctResultCount?: number;    // models that got the right outcome
  exactScoreCount?: number;       // models that nailed exact score
  topScorerNames?: string[];      // top 3 model names by points
}
```

2. Add an optional third parameter `options?: { predictions?: PredictionSummary; analysis?: MatchAnalysis | null }` to `generateMatchFAQs`. Import `MatchAnalysis` from `@/lib/db/schema`.

3. Rewrite `generateUpcomingOrLiveFAQs` to use the enrichment data when available:

**FAQ 1 (Kickoff/Timing):** Keep as-is -- already dynamic with date/time/venue.

**FAQ 2 (Predictions summary):** When `predictions` data available:
- Question: `What do AI models predict for {home} vs {away}?`
- Answer with real data: "{totalModels} AI models analyzed this match. {homeWinCount} predict a {home} win, {drawCount} predict a draw, and {awayWinCount} predict an {away} win. The most predicted scoreline is {topScoreline} (predicted by {topScorelineCount} models). Models include {first 3-4 model names joined}."
- Without data: Keep a reasonable generic but remove "check the table above" -- say "Multiple AI models have analyzed this match with individual score predictions available on this page."

**FAQ 3 (Odds/Favorites - REPLACE "how to watch"):** When `analysis` data available:
- Question: `Who is favored to win {home} vs {away}?`
- Answer: "Based on betting odds, {favoriteTeamName || team with lowest odds} is favored with odds of {oddsHome}/{oddsDraw}/{oddsAway} (home/draw/away). {If advice exists: Expert tip: {advice}.} {If h2hTotal: In {h2hTotal} head-to-head meetings, {home} has won {h2hHomeWins}, drawn {h2hDraws}, with {awayWins} {away} wins.}"
- Without data: "Odds and head-to-head data are being compiled for this match. Check back closer to kickoff for detailed analysis."

**FAQ 4 (Team Form - REPLACE venue):** When `analysis` data available:
- Question: `How are {home} and {away} performing this season?`
- Answer: "{home}'s recent form is {homeTeamForm} with {homeGoalsScored} goals scored and {homeGoalsConceded} conceded in their last 5 matches. {away}'s form is {awayTeamForm} with {awayGoalsScored} scored and {awayGoalsConceded} conceded."
- Without data: Keep venue question as fallback.

**FAQ 5 (AI methodology):** Make dynamic with model count:
- Answer: "{totalModels || 'Over 35'} AI models independently analyze historical data, team form, head-to-head records, and statistical patterns for each match. Each model produces its own score prediction, creating a diverse consensus view. Model accuracy is tracked and ranked on the leaderboard."

4. Rewrite `generateFinishedMatchFAQs` similarly:

**FAQ 1 (Final score):** Keep as-is -- already has real scores.

**FAQ 2 (Prediction accuracy):** When `predictions` data available:
- Question: `How accurate were AI predictions for {home} vs {away}?`
- Answer: "Of {totalModels} AI models, {correctResultCount} correctly predicted the match outcome and {exactScoreCount} predicted the exact score of {homeScore}-{awayScore}. {If topScorerNames: Top performers were {topScorerNames joined}.} {If topScoreline and it matches actual: The most popular prediction of {topScoreline} was correct.}"
- Without data: "Multiple AI models predicted this match. Model accuracy for each prediction is shown with point scores on this page."

**FAQ 3 (Match analysis - REPLACE goalscorers since there's no events section):** When `analysis` data available:
- Question: `What were the odds for {home} vs {away}?`
- Answer: "Pre-match betting odds were {oddsHome} (home), {oddsDraw} (draw), {oddsAway} (away). {If advice: The expert tip was: {advice}.} The match ended {homeScore}-{awayScore}."
- Without data: "Pre-match odds and analysis details are available for this {competition} fixture."

**FAQ 4 (Competition context):** Keep as-is -- already has competition name and round.

**FAQ 5 (AI methodology):** Same dynamic version as upcoming.

IMPORTANT: All answers must be SELF-CONTAINED. Never use phrases like "see above", "check the table", "view the section above", "view the leaderboard". Instead, put the actual data IN the answer. If data isn't available, give a neutral statement -- don't redirect users to a UI element.

IMPORTANT: Null-safety -- every field from `analysis` and `predictions` may be null/undefined. Always guard with optional chaining and provide fallback text.
  </action>
  <verify>
Run `npx tsc --noEmit` to confirm type-safety. The file should export `FAQItem`, `PredictionSummary`, and `generateMatchFAQs`. Verify the function signature accepts the optional third parameter and the existing 2-parameter signature still works.
  </verify>
  <done>
generateMatchFAQs produces dynamic answers with real data when enrichment parameters are provided, and reasonable generic answers (without "see above" redirects) when called with just match + competition.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire enriched data to both FAQ call sites (page.tsx server + match-faq.tsx client)</name>
  <files>
    src/app/leagues/[slug]/[match]/page.tsx
    src/components/match/match-layout.tsx
    src/components/match/match-faq.tsx
  </files>
  <action>
**A. Update page.tsx (server-side call site, line 146):**

1. After the `formattedPredictions` mapping (line ~149-159), build a `PredictionSummary` object from the raw `predictions` array:

```typescript
import type { PredictionSummary } from '@/components/match/MatchFAQSchema';

// Build prediction summary for FAQ enrichment
const predictionSummary: PredictionSummary | undefined = predictions.length > 0 ? (() => {
  const homeWinCount = predictions.filter(p => p.predictedHome > p.predictedAway).length;
  const drawCount = predictions.filter(p => p.predictedHome === p.predictedAway).length;
  const awayWinCount = predictions.filter(p => p.predictedHome < p.predictedAway).length;

  // Find most predicted scoreline
  const scorelineCounts = new Map<string, number>();
  for (const p of predictions) {
    const key = `${p.predictedHome}-${p.predictedAway}`;
    scorelineCounts.set(key, (scorelineCounts.get(key) || 0) + 1);
  }
  const [topScoreline, topScorelineCount] = [...scorelineCounts.entries()]
    .sort((a, b) => b[1] - a[1])[0] || ['', 0];

  // Finished match stats
  const isFinished = matchData.status === 'finished';
  const correctResultCount = isFinished
    ? predictions.filter(p => p.tendencyPoints !== null && p.tendencyPoints > 0).length
    : undefined;
  const exactScoreCount = isFinished
    ? predictions.filter(p => p.exactScoreBonus !== null && p.exactScoreBonus > 0).length
    : undefined;
  const topScorerNames = isFinished
    ? predictions
        .filter(p => p.totalPoints !== null && p.totalPoints > 0)
        .sort((a, b) => (b.totalPoints ?? 0) - (a.totalPoints ?? 0))
        .slice(0, 3)
        .map(p => p.modelDisplayName)
    : undefined;

  return {
    totalModels: predictions.length,
    modelNames: predictions.map(p => p.modelDisplayName).slice(0, 5),
    homeWinCount,
    drawCount,
    awayWinCount,
    topScoreline: topScoreline || undefined,
    topScorelineCount: topScorelineCount || undefined,
    correctResultCount,
    exactScoreCount,
    topScorerNames: topScorerNames?.length ? topScorerNames : undefined,
  };
})() : undefined;
```

2. Update the fallback FAQ generation on line 146:
```typescript
const faqs = aiFaqs && aiFaqs.length > 0
  ? aiFaqs
  : generateMatchFAQs(matchData, competition, { predictions: predictionSummary, analysis });
```

3. Also pass `predictionSummary` to MatchLayout so the client-side fallback in match-faq.tsx can use it:
```tsx
<MatchLayout
  predictions={formattedPredictions}
  faqs={aiFaqs}
  predictionSummary={predictionSummary}
/>
```

**B. Update match-layout.tsx:**

1. Add `predictionSummary` to the `MatchLayoutProps` interface (import `PredictionSummary` from `./MatchFAQSchema`).
2. Thread it through to `<MatchFAQ>`:
```tsx
<MatchFAQ match={match} competition={competition} aiFaqs={faqs} predictionSummary={predictionSummary} />
```

**C. Update match-faq.tsx (client-side call site, line 25):**

1. Add `predictionSummary` to `MatchFAQProps` (import `PredictionSummary`).
2. Access `analysis` from the `useMatch()` context hook.
3. Update the fallback call:
```typescript
import { useMatch } from './use-match';

export function MatchFAQ({ match, competition, aiFaqs, predictionSummary }: MatchFAQProps) {
  const { analysis } = useMatch();
  const faqs = aiFaqs && aiFaqs.length > 0
    ? aiFaqs
    : generateMatchFAQs(match, competition, { predictions: predictionSummary, analysis });
  // ... rest unchanged
}
```

Note: `useMatch()` is already imported in the client component context (MatchFAQ renders inside MatchDataProvider). The analysis data is available via context.

IMPORTANT: The `PredictionSummary` is a plain serializable object (no classes, no functions), so it safely serializes across the server-client boundary as a prop.
  </action>
  <verify>
Run `npx tsc --noEmit` to confirm all types align. Run `npm run build` (or `npx next build --webpack` if turbopack has issues) to verify the full build succeeds. Verify in page.tsx that predictions data flows into generateMatchFAQs, and in match-faq.tsx that analysis from context is used.
  </verify>
  <done>
Both call sites pass enriched data to generateMatchFAQs. Server-side (page.tsx) passes prediction summary + analysis. Client-side (match-faq.tsx) passes prediction summary from props + analysis from context. The FAQ JSON-LD schema in MatchPageSchema.tsx automatically gets the enriched content since it receives the `faqs` array from page.tsx.
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no type errors
2. `npm run build` (or `npx next build --webpack`) succeeds
3. Manual spot-check: In MatchFAQSchema.tsx, confirm no FAQ answer contains "check the table above", "see above", "view the section above", or hardcoded "GPT-4, Claude, and Gemini"
4. Confirm `generateMatchFAQs(match, competition)` still works without the optional third parameter (backward compat)
5. Confirm `generateMatchFAQs(match, competition, { predictions, analysis })` produces data-rich answers
</verification>

<success_criteria>
- Template FAQ answers contain actual prediction counts, model names, odds, and H2H data when available
- No FAQ answer redirects users to "see above" or references non-existent UI sections
- The "how to watch" generic FAQ is replaced with a "who is favored" FAQ using real odds/H2H data
- The "goalscorers" FAQ (referencing non-existent match events section) is replaced with pre-match odds FAQ
- Both server-side and client-side fallback paths produce enriched FAQs
- JSON-LD FAQPage schema automatically inherits the enriched content
- Build passes, no type errors
</success_criteria>

<output>
After completion, create `.planning/quick/39-optimize-match-detail-page-faq-for-seo-g/39-SUMMARY.md`
</output>
