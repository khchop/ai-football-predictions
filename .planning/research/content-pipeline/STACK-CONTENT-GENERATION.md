# Stack Research: Content Generation Pipeline Reliability

**Domain:** AI Football Predictions Platform - Content Generation Pipeline
**Dimension:** Stack improvements for LLM content generation and SEO/GEO optimization
**Researched:** 2026-02-04
**Overall Confidence:** HIGH

---

## Executive Summary

This research focuses on **improving existing stack components** for reliable LLM content generation. The platform already has a solid foundation with Together AI, BullMQ, and isomorphic-dompurify. The issues (missing content, visible HTML tags) stem from configuration gaps and error handling patterns, not technology choices.

**Key findings:**
1. BullMQ configuration is sound but needs job-specific timeout tuning for content jobs
2. Together AI client has good retry logic but lacks structured error classification at job level
3. HTML sanitization with isomorphic-dompurify is correct; issue is LLM output containing raw HTML in prose sections
4. SEO/GEO patterns in prompts are mostly correct but need structured output enforcement

**Root Cause Analysis:**
- "All matches from yesterday have no generated content" = Job failures silently swallowed, not retried correctly
- "HTML tags still visible in some content" = LLM outputs `<p>` tags in prose-only fields, not stripped

---

## Existing Stack (Validated - DO NOT CHANGE)

### Core Content Generation

| Component | Version | Purpose | Status |
|-----------|---------|---------|--------|
| Together AI | API v1 | LLM inference (Llama 4 Maverick) | Working |
| BullMQ | 5.34.3 | Job queue for async content generation | Working |
| isomorphic-dompurify | 2.35.0 | HTML sanitization | Working |
| PostgreSQL | 12+ | Content storage (matchContent, blogPosts) | Working |
| Redis | 6+ | Queue backend, caching | Working |

### Observation: Stack is Appropriate

The technology choices are correct for this use case:
- Together AI provides cost-effective LLM inference with good rate limits
- BullMQ handles job persistence and retry logic well
- isomorphic-dompurify is the standard for HTML sanitization in Node.js

**The issues are in configuration and patterns, not technology selection.**

---

## BullMQ: Reliability Improvements

### Current Configuration Analysis

```typescript
// Current: src/lib/queue/index.ts
defaultJobOptions: {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 30000, // 30s -> 60s -> 120s -> 240s -> 480s
  },
  timeout: 2 * 60 * 1000, // 2 minutes default
}
```

**Issue:** Content generation jobs can take 30-60 seconds for long-form content. Default 2-minute timeout is appropriate, but the content worker has `concurrency: 1` which creates a bottleneck when many matches need content.

### Content Worker Analysis

```typescript
// Current: src/lib/queue/workers/content.worker.ts line 94-101
{
  connection: getQueueConnection(),
  concurrency: 1, // Process one at a time to avoid rate limits
  limiter: {
    max: 30, // Max 30 requests per minute (Together AI limit)
    duration: 60000,
  },
}
```

**Assessment:** This configuration is CORRECT. Together AI has rate limits, and serial processing prevents 429 errors. The bottleneck is intentional.

### Identified Gap: Lock Duration

```typescript
// Current: WORKER_LOCK_DURATIONS (src/lib/queue/index.ts)
default: 30 * 1000, // 30 seconds
```

For content jobs that can take 60 seconds, this can cause premature stall detection. BullMQ will mark the job as stalled and retry it while it's still running.

**Recommendation:** Add content queue to lock duration config:
```typescript
[QUEUE_NAMES.CONTENT]: 2 * 60 * 1000, // 2 minutes - matches timeout
```

### BullMQ Best Practices Applied

Based on [BullMQ Documentation](https://docs.bullmq.io/guide/retrying-failing-jobs):

| Practice | Current State | Recommendation |
|----------|--------------|----------------|
| Graceful shutdown | Implemented in `src/lib/queue/index.ts` | No change |
| Job data limits | No sensitive data in jobs | No change |
| Stalled job recovery | Default 30s lock duration | Increase for content jobs |
| Remove completed jobs | 24h retention | Appropriate |
| Failed job retention | 7 days | Appropriate |

### Job Priority Implementation

The current `scanMatchesMissingContent()` already implements priority via processing order:
1. Pre-match content (upcoming matches) - processed first
2. Betting content (medium priority) - processed second
3. Post-match content (historical) - processed last

This is correct. The scan runs hourly and processes up to 10 items per scan (`MAX_GENERATIONS_PER_SCAN = 10`).

---

## Together AI: Error Handling Improvements

### Current Implementation Analysis

The Together AI client in `src/lib/content/together-client.ts` has good fundamentals:
- Retry with backoff via `fetchWithRetry()` (3 retries, 2s base delay, 30s max)
- Circuit breaker integration via `SERVICE_NAMES.TOGETHER_CONTENT`
- Cost tracking with `calculateCost()`
- JSON parsing with cleanup for common LLM formatting issues

### Retry Configuration

```typescript
// Current: src/lib/utils/retry-config.ts
export const TOGETHER_CONTENT_RETRY: Partial<RetryConfig> = {
  maxRetries: 3,
  baseDelayMs: 2000,      // 2s base delay (longer responses)
  maxDelayMs: 30000,      // 30s max delay
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

export const TOGETHER_CONTENT_TIMEOUT_MS = 60000; // 60s timeout for content generation
```

**Assessment:** This is well-configured. 60s timeout is appropriate for long-form content.

### Identified Gap: Error Classification at Job Level

When a Together AI call fails, the content worker catches the error and re-throws it:
```typescript
// src/lib/queue/workers/content.worker.ts line 78-92
} catch (error) {
  log.error({ err: error }, `Error generating ${type}`);
  Sentry.captureException(error, { ... });
  throw error; // BullMQ handles retry with generic exponential backoff
}
```

**Problem:** All errors get the same exponential backoff. Rate limits need 60s wait; parse errors need quick retry.

**Existing Solution (Not Utilized):**
The codebase already has error classification in `src/lib/utils/retry-config.ts`:
```typescript
export function classifyErrorType(error: unknown): ErrorType {
  // ... classifies RATE_LIMIT, TIMEOUT, SERVER_ERROR, PARSE_ERROR, etc.
}

export function calculateBackoffDelay(
  attempt: number,
  errorType: ErrorType,
  baseDelayMs: number = 1000
): number {
  switch (errorType) {
    case ErrorType.RATE_LIMIT:
      return 60000; // 60s fixed
    case ErrorType.PARSE_ERROR:
      return Math.min(5000 * Math.pow(2, attempt - 1), 20000);
    // ...
  }
}
```

**Recommendation:** Use this classification in the content worker to provide better retry hints to BullMQ, or use BullMQ's custom backoff strategy.

### Rate Limit Header Handling

Based on [Together AI rate limits documentation](https://docs.together.ai/docs/rate-limits), the API returns headers:
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

Current implementation tracks these:
```typescript
// src/lib/utils/api-client.ts
function handleRateLimitHeaders(serviceName, response): void {
  const remaining = response.headers.get('X-RateLimit-Remaining');
  // ... logs warning when remaining <= 10
}
```

**Assessment:** Good implementation. Proactive throttling kicks in when `remaining <= 5`.

---

## HTML Sanitization: Root Cause Analysis

### Current Issue: Visible HTML Tags in Content

The problem is NOT with isomorphic-dompurify. The problem is:

1. **LLM outputs HTML when asked for prose**
   - `generateTextWithTogetherAI()` returns raw text
   - Prompts say "Write flowing prose without headers" but LLM sometimes includes `<p>` tags

2. **Some content types expect HTML, others expect plain text**

### Content Type Format Analysis

| Content Type | Function | Expected Format | Current Output | Issue |
|--------------|----------|-----------------|----------------|-------|
| preMatchContent | `generatePreMatchContent()` | Plain text | Sometimes has `<p>` tags | LLM not following instructions |
| bettingContent | `generateBettingContent()` | Plain text | Sometimes has `<p>` tags | LLM not following instructions |
| postMatchContent | `generatePostMatchContent()` | Plain text | Sometimes has `<p>` tags | LLM not following instructions |
| matchRoundup.narrative | `generatePostMatchRoundup()` | HTML | HTML | Correct (uses generateWithTogetherAI) |
| faqContent | `generateFAQContent()` | Plain text JSON | Plain text JSON | Correct |
| matchPreview sections | `generateMatchPreview()` | Plain text JSON | Plain text JSON | Correct |

### Resolution Strategy

**Option 1: Strip HTML from prose sections (Recommended)**

Apply HTML stripping AFTER LLM generation for prose-only fields:
```typescript
function stripHtmlTags(text: string): string {
  return text
    .replace(/<[^>]*>/g, ' ')      // Remove HTML tags
    .replace(/\s+/g, ' ')          // Normalize whitespace
    .trim();
}

// In generatePreMatchContent:
const result = await generateTextWithTogetherAI(...);
const content = stripHtmlTags(result.content);
```

This is simpler and more reliable than trying to control LLM output.

**Option 2: Reinforce prompt instructions (Also Recommended)**

Add explicit instruction to prompts:
```
IMPORTANT: Output plain text only. Do NOT use HTML tags, markdown, or any formatting. Just prose sentences.
```

**Recommendation:** Use BOTH approaches:
1. Update prompts to be clearer about format (prevention)
2. Strip HTML as a safety net (cleanup)

### isomorphic-dompurify Usage (Correct)

The library is used correctly in rendering components for HTML fields:
```typescript
import DOMPurify from 'isomorphic-dompurify';

// For HTML content (matchRoundup.narrative)
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />
```

This sanitizes HTML for XSS prevention. It does NOT strip HTML tags - that's intentional for HTML content fields.

**Key Insight:** The problem is not sanitization, it's the LLM outputting HTML in prose fields. isomorphic-dompurify is working correctly.

---

## SEO/GEO Content Patterns

### Current Prompt Analysis

The prompts in `src/lib/content/prompts.ts` follow good SEO practices:

1. **Structured output** - JSON with specific fields (title, metaDescription, keywords)
2. **Length constraints** - "150-160 characters exactly" for meta descriptions
3. **Keyword requirements** - Explicit keyword arrays
4. **Conversational style** - Mentioned in guidelines

### GEO (Generative Engine Optimization) Gaps

Based on [LLM SEO best practices research](https://www.trooinbound.com/blog/9-llm-seo-best-practices-how-to-rank-on-llms-2026-guide/):

| GEO Practice | Current State | Gap |
|--------------|---------------|-----|
| Chunked content (75-225 words) | Partial - some sections too long | Need max word count per section |
| FAQ schema | Implemented in `src/lib/content/match-content.ts` | Good |
| Conversational Q&A | FAQ generation uses this | Good |
| Entity mentions | Teams, models mentioned | Good |
| Structured data | JSON-LD schemas in `src/lib/seo/schemas.ts` | Good |

### Prompt Improvements for GEO

**Current prompt structure (match preview):**
```
"introduction": "2-3 paragraph introduction setting the scene (200-250 words)"
```

**Improved prompt structure:**
```
"introduction": "2-3 short paragraphs (150-200 words total). Each paragraph should be a self-contained idea that an AI search engine could extract as a complete answer. Avoid long, complex sentences."
```

**Rationale:** LLMs extract "chunks" of 75-225 words. Making paragraphs self-contained improves GEO visibility.

### Temperature Settings Analysis

| Content Type | Current Temperature | Recommended | Rationale |
|--------------|---------------------|-------------|-----------|
| Match preview | 0.7 | 0.7 | Creative content, appropriate |
| League roundup | 0.7 | 0.5 | Factual content, lower is better |
| Model report | 0.7 | 0.5 | Factual content, lower is better |
| Post-match roundup | 0.4 | 0.4 | Already correct for factual content |
| Pre/betting/post content | 0.7 | 0.5 | Factual summaries, could be lower |
| FAQ generation | 0.7 | 0.5 | Factual Q&A, lower is better |

---

## What NOT to Add

### DO NOT Add: Alternative LLM Providers

**Reason:** Together AI is working well. Adding OpenAI/Anthropic as fallback:
- Increases complexity significantly
- Different models produce inconsistent output styles
- Cost management becomes harder
- The reliability issues are in error handling, not the provider

### DO NOT Add: Content Caching Layer

**Reason:** Content is already stored in PostgreSQL. Adding Redis content caching:
- Adds cache invalidation complexity
- Content doesn't change after generation
- Database reads are fast enough

### DO NOT Add: Markdown Processing

**Reason:** The prompts already specify output format. Adding markdown-to-HTML conversion:
- Adds another transformation step
- LLM already outputs HTML when needed
- Increases chance of formatting errors

### DO NOT Add: Prompt Templates Library (Langchain/LlamaIndex)

**Reason:** Current prompts in `prompts.ts` are:
- Simple and maintainable
- Directly controlled
- Easy to debug

Prompt template libraries add abstraction without benefit for this use case.

### DO NOT Add: Streaming Responses

**Reason:** Content generation is background job processing:
- No user waiting for real-time response
- Full response needed for validation before saving
- Streaming adds complexity without benefit

---

## Implementation Priorities

### Priority 1: Content Validation (Addresses Missing Content)

Add validation before saving to detect:
- Empty or too-short content (LLM truncation)
- Rate limit errors silently swallowed
- Parse errors from malformed JSON

**Files to modify:**
- `src/lib/content/match-content.ts`
- `src/lib/content/generator.ts`

**Example validation:**
```typescript
function validateContent(content: string, minLength: number = 100): boolean {
  if (!content || content.trim().length < minLength) {
    return false;
  }
  // Check for placeholder text that shouldn't appear in final output
  if (content.includes('[INSERT') || content.includes('Data unavailable')) {
    return false;
  }
  return true;
}
```

### Priority 2: HTML Tag Stripping (Addresses Visible Tags)

Add post-processing for prose-only content fields:
- Strip HTML from preMatchContent, bettingContent, postMatchContent
- Keep HTML for matchRoundup.narrative

**Files to modify:**
- `src/lib/content/match-content.ts`

**Implementation:**
```typescript
function stripHtmlTags(text: string): string {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
```

### Priority 3: Lock Duration Fix (Addresses Stalled Jobs)

Add content queue to lock duration config to prevent premature stall detection.

**Files to modify:**
- `src/lib/queue/index.ts`

**Change:**
```typescript
const WORKER_LOCK_DURATIONS = {
  // ... existing
  [QUEUE_NAMES.CONTENT]: 2 * 60 * 1000, // 2 minutes
}
```

### Priority 4: Prompt GEO Optimization

Update prompts for better AI search visibility:
- Enforce chunked content structure
- Add explicit plain text instructions for prose fields
- Lower temperature for factual content

**Files to modify:**
- `src/lib/content/prompts.ts`
- `src/lib/content/match-content.ts`

---

## Configuration Summary

### BullMQ Changes

| Setting | Current | Recommended | File |
|---------|---------|-------------|------|
| Content lock duration | 30s (default) | 120s (2 min) | `src/lib/queue/index.ts` |
| Content worker concurrency | 1 | 1 (keep) | `src/lib/queue/workers/content.worker.ts` |
| Content limiter | 30/min | 30/min (keep) | `src/lib/queue/workers/content.worker.ts` |

### Together AI Changes

| Setting | Current | Recommended | File |
|---------|---------|-------------|------|
| Content timeout | 60s | 60s (keep) | `src/lib/utils/retry-config.ts` |
| Content retries | 3 | 3 (keep) | `src/lib/utils/retry-config.ts` |
| Base delay | 2s | 2s (keep) | `src/lib/utils/retry-config.ts` |

### Content Generation Changes

| Area | Current | Recommended | File |
|------|---------|-------------|------|
| Prose HTML handling | None | Strip HTML tags | `src/lib/content/match-content.ts` |
| Content validation | Minimal | Add length/placeholder checks | `src/lib/content/match-content.ts` |
| Factual content temp | 0.7 | 0.5 | `src/lib/content/match-content.ts` |

---

## Sources

### Official Documentation
- [BullMQ Retrying Failing Jobs](https://docs.bullmq.io/guide/retrying-failing-jobs) - Retry patterns
- [BullMQ Going to Production](https://docs.bullmq.io/guide/going-to-production) - Production best practices
- [Together AI Rate Limits](https://docs.together.ai/docs/rate-limits) - Dynamic rate limiting

### SEO/GEO Best Practices
- [LLM SEO Best Practices 2026 Guide](https://www.trooinbound.com/blog/9-llm-seo-best-practices-how-to-rank-on-llms-2026-guide/) - Content chunking
- [LLM Content Creation Strategy 2026](https://wellows.com/blog/llm-content-creation-strategy/) - Human-AI collaboration
- [Optimize Content for LLM 2026](https://www.promodo.com/blog/how-to-optimize-your-content-for-llm) - Technical optimization

### Security & Sanitization
- [OWASP Top 10 LLM Vulnerabilities 2026](https://www.brightdefense.com/resources/owasp-top-10-llm/) - Output handling
- [Guardrails Web Sanitization](https://github.com/guardrails-ai/web_sanitization) - Output scanning patterns

---

## Confidence Assessment

| Area | Confidence | Reasoning |
|------|------------|-----------|
| BullMQ patterns | HIGH | Official docs + existing codebase analysis |
| Together AI handling | HIGH | API docs + existing implementation review |
| HTML sanitization root cause | HIGH | Code analysis identified LLM output as source |
| SEO/GEO patterns | MEDIUM | Based on 2026 industry research, may evolve |
| Implementation priorities | HIGH | Directly maps to stated issues |

---

*Stack research: 2026-02-04 | Focus: Content generation reliability | Approach: Fix configuration, not technology*
