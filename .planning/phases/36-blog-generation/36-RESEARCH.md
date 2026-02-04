# Phase 36: Blog Generation - Research

**Researched:** 2026-02-04
**Domain:** Automated blog post generation with BullMQ job scheduling, error handling, and SEO/GEO content quality
**Confidence:** HIGH

## Summary

Phase 36 addresses blog generation reliability by applying the same error handling, sanitization, and content quality patterns already established in Phases 32-35 for match content. The codebase already has blog generation infrastructure (`generateLeagueRoundup`, `generateModelReport` in `generator.ts`) but lacks reliable triggering mechanisms and consistent error handling patterns.

**Current state:** Blog generation functions exist and work when manually triggered, but:
1. No automated job scheduling for league roundups (should trigger weekly after matches finish)
2. No automated job scheduling for model performance reports (should trigger monthly)
3. Error handling inconsistent with match content patterns (returns false vs throws)
4. HTML sanitization not applied before database save
5. No answer-first content structure in prompts

**Primary recommendation:** Apply the Phase 32-35 patterns (error throwing, HTML sanitization, answer-first prompts) to blog generation, then add BullMQ job schedulers to trigger roundups weekly and reports monthly.

## Standard Stack

The blog generation infrastructure is already in place. **No new libraries needed.**

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| BullMQ | 5.34.3+ | Job scheduling with repeatable jobs | Industry standard for Node.js job queues, supports cron patterns |
| Together AI | Current | LLM content generation | Already integrated for match content |
| html-to-text | 9.0.5 | HTML sanitization | Established in Phase 33 |
| he | 1.2.0 | Entity decoding | Established in Phase 33 |

### Supporting (Existing Patterns)
| Pattern | Location | Purpose | When to Use |
|---------|----------|---------|-------------|
| Error classes | `src/lib/errors/content-errors.ts` | RetryableContentError, FatalContentError | All content generation failures |
| Sanitization | `src/lib/content/sanitization.ts` | sanitizeContent, validateNoHtml | Before any database save |
| Content worker | `src/lib/queue/workers/content.worker.ts` | Process generation jobs | Already handles match content |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BullMQ Job Schedulers | node-cron with manual queue adding | BullMQ Job Schedulers handle Redis persistence, avoid duplicate job creation, and integrate with existing queue infrastructure |
| Custom blog triggers | Serverless cron (Vercel Cron) | BullMQ keeps all job management in one system, better observability via BullMQ UI |

**Installation:**
No new packages needed. All dependencies already installed.

## Architecture Patterns

### Recommended Job Scheduler Structure

BullMQ 5.16.0+ uses "Job Schedulers" (deprecated older "repeatable jobs" API). Job Schedulers act as factories that produce jobs based on cron patterns or intervals.

```typescript
// src/lib/queue/setup.ts (add to existing setup)

// Weekly league roundup scheduler (every Monday at 2 AM)
await contentQueue.upsertJobScheduler(
  'weekly-league-roundups',
  {
    pattern: '0 2 * * 1', // cron: every Monday at 2 AM
  },
  {
    name: 'generate-weekly-roundups',
    data: {
      type: 'scan_league_roundups',
      data: { triggeredBy: 'scheduler' },
    },
    opts: CONTENT_JOB_OPTIONS,
  }
);

// Monthly model performance report (1st of month at 3 AM)
await contentQueue.upsertJobScheduler(
  'monthly-model-report',
  {
    pattern: '0 3 1 * *', // cron: 1st of each month at 3 AM
  },
  {
    name: 'generate-model-report',
    data: {
      type: 'model_report',
      data: {
        period: new Date().toISOString().slice(0, 7), // YYYY-MM
      },
    },
    opts: CONTENT_JOB_OPTIONS,
  }
);
```

**Source:** [BullMQ Job Schedulers Documentation](https://docs.bullmq.io/guide/job-schedulers)

### Pattern 1: Event-Driven Blog Triggers

**What:** Blog generation triggered by domain events (match finishes, week ends, month ends)

**When to use:** For blog posts tied to specific events (league roundups after matches, performance reports at month end)

**Example:**
```typescript
// In scoring.worker.ts after match settlement
if (allMatchesScored) {
  await contentQueue.add('trigger-roundup', {
    type: 'check_roundup_eligibility',
    data: { competitionId, triggeredAt: new Date().toISOString() },
  });
}
```

**Why this pattern:** Ensures roundups generate soon after matches finish, not on arbitrary schedule that might run before matches are scored.

### Pattern 2: Eligibility Check Before Generation

**What:** Separate "check eligibility" jobs from "generate content" jobs to avoid wasted LLM calls

**When to use:** When not all triggers should result in content generation (e.g., only generate roundup if 3+ matches finished)

**Example:**
```typescript
// Eligibility check (fast, no LLM)
async function checkRoundupEligibility(competitionId: string) {
  const roundupData = await getLeagueRoundupData(competitionId);

  if (!roundupData || roundupData.matches.length < 3) {
    return { eligible: false, reason: 'insufficient_matches' };
  }

  // Check if roundup already exists for this round
  const existing = await getRoundupByCompetitionAndRound(
    competitionId,
    roundupData.week
  );

  if (existing) {
    return { eligible: false, reason: 'already_exists' };
  }

  // Eligible - queue actual generation
  await contentQueue.add('generate-league-roundup', {
    type: 'league_roundup',
    data: { competitionId, week: roundupData.week },
  }, CONTENT_JOB_OPTIONS);

  return { eligible: true };
}
```

### Pattern 3: Answer-First Prompt Structure

**What:** Content starts with direct answer to core question, then provides depth

**When to use:** All blog content for GEO optimization (3.4x more AI citations)

**Example:**
```typescript
// BAD: Traditional blog structure
`Write a blog post about league performance this week.
Include an introduction, then...`

// GOOD: Answer-first structure
`Write a league performance analysis with this structure:

1. **Opening Summary (30-60 words):** Start with the direct answer:
   - Which models performed best (name top 3 with avg points)
   - Overall accuracy rate (X% correct tendency)
   - Biggest surprise result

   Example: "Llama 3.3 70B led this week with 4.2 points per match,
   followed by GPT-4 Turbo (3.8) and Claude Opus (3.6). Models achieved
   67% correct tendency overall, with the Arsenal vs Chelsea upset being
   the week's biggest miss."

2. **Detailed Analysis:**...`
```

**Source:** [AI Search Optimization Guide 2026](https://blog.brandsatplayllc.com/blog/seo-for-ai-engines-a-2026-guide-to-ai-search-optimization-geo)

### Anti-Patterns to Avoid

- **Immediate generation on scheduler trigger:** Don't call `generateLeagueRoundup` directly in scheduler job. Queue a job instead to benefit from retry logic and DLQ.
- **Returning false on error:** Breaks BullMQ retry mechanism (established pitfall from Phase 32)
- **Skipping HTML sanitization:** Blog content must use same sanitization as match content (Phase 33)
- **Generic prompts without examples:** LLMs need concrete examples for answer-first structure (Phase 35)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job deduplication | Custom Redis key checking | BullMQ's jobId option | BullMQ prevents duplicate jobs with same jobId, handles race conditions |
| Cron scheduling | node-cron + manual job adding | BullMQ Job Schedulers | Persisted in Redis, survives restarts, integrates with queue monitoring |
| Retry logic | Custom retry counters | BullMQ's built-in attempts/backoff | Already configured correctly in CONTENT_JOB_OPTIONS |
| HTML sanitization | Regular expressions | html-to-text + he libraries | Handles edge cases (nested tags, entities, malformed HTML) |

**Key insight:** Blog generation should reuse all the patterns from match content generation. The only new code is job scheduler configuration and eligibility checks.

## Common Pitfalls

### Pitfall 1: Scheduler Creates Jobs Before Dependencies Ready

**What goes wrong:** Weekly scheduler triggers at 2 AM Monday, but matches from Sunday aren't scored yet. Roundup generates with incomplete data.

**Why it happens:** Time-based scheduling ignores domain state (matches may finish at different times)

**How to avoid:**
- Use event-driven triggers (after match scoring) OR
- Eligibility check verifies all matches are scored before generation

**Warning signs:**
- Roundups with "Data unavailable" for recent matches
- Matches with status="finished" but no predictions.status="scored"

### Pitfall 2: Missing Error Handling Conversion

**What goes wrong:** Blog generation functions still return false on error instead of throwing, so BullMQ never retries

**Why it happens:** Match content functions were fixed in Phase 32, but blog functions weren't updated

**How to avoid:** Apply same error handling pattern to `generateLeagueRoundup` and `generateModelReport`:

```typescript
// BAD (current pattern in some functions)
if (!result) {
  log.error('Generation failed');
  return false;
}

// GOOD (Phase 32 pattern)
if (!result) {
  throw new RetryableContentError(
    'Blog generation failed',
    {
      matchId: 'N/A',
      homeTeam: competition,
      awayTeam: '',
      contentType: 'blog',
      timestamp: new Date().toISOString(),
    }
  );
}
```

**Warning signs:**
- Jobs marked as "completed" but no blog post in database
- No retry attempts visible in BullMQ UI
- Missing entries in dead letter queue

### Pitfall 3: Prompt Doesn't Enforce Answer-First Structure

**What goes wrong:** LLM generates traditional blog structure (long intro, answer buried in middle), gets 3.4x fewer AI citations

**Why it happens:** Generic prompt instructions don't override LLM's default blog writing patterns

**How to avoid:** Include concrete examples in prompt (Phase 35 pattern):

```typescript
const answerFirstExample = `
GOOD EXAMPLE (answer-first):
"Llama 3.3 70B dominated Premier League predictions this week with 4.2
points per match, outperforming GPT-4 Turbo (3.8) and Claude Opus (3.6).
Overall model accuracy reached 67% for correct result tendency, though
the Arsenal vs Chelsea 2-1 upset caught 28 of 35 models off guard.

[detailed analysis follows...]"

BAD EXAMPLE (traditional blog):
"This week saw exciting action in the Premier League with several
unexpected results and strong performances from our AI models.
In this analysis, we'll dive deep into which models performed best
and examine the key factors that influenced accuracy rates this round.

[answer buried in paragraph 4...]"
`;

// Include in prompt
`Write a league performance analysis following the GOOD EXAMPLE structure.
Start with a 30-60 word summary that directly answers: which models won,
what was the accuracy rate, and what was the biggest surprise.

${answerFirstExample}`;
```

**Warning signs:**
- Blog content starts with "This week..." or "In this analysis..."
- Answer to "which models performed best" not visible in first 100 words
- Low AI citation rate (check Analytics later)

### Pitfall 4: HTML Sanitization Not Applied to Blog Content

**What goes wrong:** Blog posts contain `<p>`, `<div>`, `&nbsp;` tags visible in rendered content

**Why it happens:** Match content sanitization (Phase 33) not applied to blog pipeline

**How to avoid:**
```typescript
// In generateLeagueRoundup and generateModelReport
import { sanitizeContent, validateNoHtml } from './sanitization';

const sanitizedContent = sanitizeContent(result.content);
const sanitizedExcerpt = sanitizeContent(result.excerpt);

// Validate before save
validateNoHtml(sanitizedContent);
validateNoHtml(sanitizedExcerpt);

await db.insert(blogPosts).values({
  content: sanitizedContent,
  excerpt: sanitizedExcerpt,
  // ...
});
```

**Warning signs:**
- Blog posts with visible `<p>` or `<div>` tags
- HTML entities like `&nbsp;` in text
- validateNoHtml throws after save (should throw before)

## Code Examples

Verified patterns from established codebase:

### Error Handling Pattern (Phase 32)

```typescript
// Source: src/lib/content/match-content.ts (apply to blog generation)
import {
  RetryableContentError,
  FatalContentError,
  classifyError
} from '@/lib/errors/content-errors';

export async function generateLeagueRoundup(data: RoundupData) {
  try {
    const result = await generateWithTogetherAI<ArticleResponse>(
      systemPrompt,
      userPrompt
    );

    if (!result) {
      throw new RetryableContentError(
        'LLM returned null result',
        {
          matchId: 'N/A',
          homeTeam: data.competition,
          awayTeam: '',
          contentType: 'blog',
          timestamp: new Date().toISOString(),
        }
      );
    }

    // Validate and sanitize (Phase 33 pattern)
    const sanitized = sanitizeContent(result.content);
    validateNoHtml(sanitized);

    // Save to database
    const postId = await saveRoundupToDatabase(sanitized);

    return postId;
  } catch (error) {
    // Classify and re-throw with proper error type
    const errorType = classifyError(error);

    if (errorType === 'fatal') {
      throw new FatalContentError(
        `Fatal error in roundup generation: ${error.message}`,
        {
          matchId: 'N/A',
          reason: 'invalid_data',
          timestamp: new Date().toISOString(),
        }
      );
    }

    throw new RetryableContentError(
      `Roundup generation failed: ${error.message}`,
      {
        matchId: 'N/A',
        homeTeam: data.competition,
        awayTeam: '',
        contentType: 'blog',
        timestamp: new Date().toISOString(),
        originalError: error,
      }
    );
  }
}
```

### Job Scheduler Configuration (BullMQ 5.16+)

```typescript
// Source: https://docs.bullmq.io/guide/job-schedulers
// Location: src/lib/queue/setup.ts

import { getQueue, QUEUE_NAMES } from './index';

export async function setupBlogJobSchedulers() {
  const contentQueue = getQueue(QUEUE_NAMES.CONTENT);

  // Weekly league roundups (every Monday at 2 AM)
  await contentQueue.upsertJobScheduler(
    'weekly-league-roundups',
    {
      pattern: '0 2 * * 1', // Cron: Mon 2 AM
    },
    {
      name: 'scan-league-roundups',
      data: {
        type: 'scan_league_roundups',
        data: { triggeredBy: 'weekly-scheduler' },
      },
      opts: {
        priority: 20, // LOW priority (not time-critical)
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 },
      },
    }
  );

  // Monthly model performance report (1st of month at 3 AM)
  await contentQueue.upsertJobScheduler(
    'monthly-model-report',
    {
      pattern: '0 3 1 * *', // Cron: 1st of month, 3 AM
    },
    {
      name: 'generate-model-report',
      data: {
        type: 'model_report',
        data: {
          period: new Date().toISOString().slice(0, 7), // YYYY-MM
          triggeredBy: 'monthly-scheduler',
        },
      },
      opts: {
        priority: 20, // LOW priority
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 },
      },
    }
  );

  log.info('Blog job schedulers configured');
}
```

### Answer-First Prompt Pattern (Phase 35)

```typescript
// Source: Established pattern from Phase 35 (match content)
// Apply to buildLeagueRoundupPrompt in src/lib/content/prompts.ts

export function buildLeagueRoundupPrompt(data: LeagueRoundupData): string {
  return `LEAGUE: ${data.competition}
WEEK/ROUND: ${data.week}

[... existing data sections ...]

## OUTPUT REQUIREMENTS

### Opening Summary (CRITICAL - Answer-First Structure)
Start with a 30-60 word paragraph that directly answers:
1. Which models performed best this week (name top 3 with avg points/match)
2. Overall accuracy rate (X% correct tendency)
3. Biggest surprise or upset result

GOOD EXAMPLE:
"Llama 3.3 70B led Premier League predictions this week with 4.2 points
per match, followed by GPT-4 Turbo (3.8) and Claude Opus (3.6). Models
achieved 67% correct tendency overall, though the Arsenal vs Chelsea 2-1
upset caught 28 of 35 models off guard."

BAD EXAMPLE (DO NOT USE):
"This week saw exciting Premier League action with several unexpected
results. In this analysis, we'll examine AI model performance across
all matches and dive into the key factors that influenced accuracy..."

### Full Content Structure
After the opening summary, provide:
- ## Top 10 Models (table with avg points/match ranking)
- ## Match-by-Match Audit (each match with accuracy stats)
- ## Biggest Consensus Misses (upsets that fooled most models)
- ## Methodology (how scoring works)

## STRICT RULES
- All text fields must be plain text (NO HTML tags or entities)
- Opening summary MUST be answer-first (30-60 words)
- Use ONLY the data provided (no external facts)
- Mention ONLY teams in ALLOWED_TEAMS list

Return JSON only:
{
  "title": "SEO title (<= 60 chars)",
  "excerpt": "Opening summary from above (30-60 words, answer-first)",
  "content": "Full markdown with opening summary repeated + sections",
  "metaTitle": "SEO meta title (<= 60 chars)",
  "metaDescription": "150-160 chars (include top model names and accuracy %)",
  "keywords": ["league name", "week/round", "AI predictions", "accuracy", "kroam.xyz"]
}`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Repeatable jobs API | Job Schedulers (upsertJobScheduler) | BullMQ 5.16.0 (2024) | Better Redis persistence, no duplicate jobs |
| Traditional blog structure | Answer-first structure | 2026 (GEO emergence) | 3.4x more AI citations |
| Return false on error | Throw RetryableContentError | Phase 32 (2026-02-04) | BullMQ retries work correctly |
| Render-time sanitization | Pre-save sanitization | Phase 33 (2026-02-04) | No HTML artifacts in database |

**Deprecated/outdated:**
- `Queue.add()` with `repeat` option: Use `upsertJobScheduler` instead (BullMQ 5.16+)
- Generic "write a blog post" prompts: Include concrete answer-first examples (LLM training data defaults to traditional blog structure)

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal roundup timing**
   - What we know: Matches finish at different times (some Sunday night, some Monday)
   - What's unclear: Should scheduler run Monday 2 AM (might miss late matches) or Tuesday 2 AM (more complete but less timely)?
   - Recommendation: Use event-driven trigger after last match of round is scored, with scheduler as backup for missed triggers

2. **Minimum match threshold for roundups**
   - What we know: `getLeagueRoundupData` returns null if no matches, but doesn't check count
   - What's unclear: What's the minimum number of matches to make a roundup valuable? 1 match? 3? 5?
   - Recommendation: Implement eligibility check (minimum 3 matches) to avoid low-value roundups

3. **Model report period**
   - What we know: Current system generates "monthly" reports
   - What's unclear: Should reports be calendar month (Jan 1-31) or rolling 30 days?
   - Recommendation: Calendar month (simpler for readers, aligns with existing "period" parameter format YYYY-MM)

## Sources

### Primary (HIGH confidence)
- [BullMQ Job Schedulers Documentation](https://docs.bullmq.io/guide/job-schedulers) - Official docs for repeatable job patterns
- [BullMQ Repeat Strategies](https://docs.bullmq.io/guide/job-schedulers/repeat-strategies) - Cron patterns and intervals
- Existing codebase patterns:
  - `src/lib/errors/content-errors.ts` - Error handling classes
  - `src/lib/content/sanitization.ts` - HTML sanitization
  - `src/lib/content/match-content.ts` - Error throwing pattern
  - `src/lib/queue/workers/content.worker.ts` - Job processing pattern

### Secondary (MEDIUM confidence)
- [AI Search Optimization Guide 2026](https://blog.brandsatplayllc.com/blog/seo-for-ai-engines-a-2026-guide-to-ai-search-optimization-geo) - Answer-first structure importance
- [LLM Content Optimization Best Practices 2026](https://fibr.ai/geo/llm-content-optimization-best-practices-2026) - GEO content structure
- [90-Day SEO Playbook for AI-Driven Search](https://searchengineland.com/a-90-day-seo-playbook-for-ai-driven-search-visibility-466751) - Answer-first performance data (3.4x citations)
- [Trigger Marketing Types and Strategies 2026](https://www.cognism.com/blog/marketing-triggers) - Event-driven automation patterns

### Tertiary (LOW confidence)
- [Better Stack BullMQ Guide](https://betterstack.com/community/guides/scaling-nodejs/bullmq-scheduled-tasks/) - Third-party tutorial (verify with official docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and working
- Architecture: HIGH - Patterns established in Phases 32-35, just need application to blog code
- Pitfalls: HIGH - All pitfalls are documented issues from prior phases
- Answer-first structure: MEDIUM - External research, needs validation with actual AI citation data

**Research date:** 2026-02-04
**Valid until:** 30 days (stable domain - job scheduling patterns change slowly)
