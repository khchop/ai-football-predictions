# Phase 4: Content Pipeline Research Document

This document provides comprehensive research for implementing the Content Pipeline phase of the BettingSoccer project. It covers LLM prompt engineering, BullMQ job patterns, Next.js rendering strategies, and content deduplication approaches.

## Table of Contents

1. [LLM Prompt Engineering for Structured, Factual Match Narratives](#1-llm-prompt-engineering-for-structured-factual-match-narratives)
2. [BullMQ Job Patterns for Scheduled/Triggered Content Generation](#2-bullmq-job-patterns-for-scheduledtriggered-content-generation)
3. [HTML Rendering Patterns in Next.js for Match Content](#3-html-rendering-patterns-in-nextjs-for-match-content)
4. [Content Deduplication/Similarity Detection Approaches](#4-content-deduplicationsimilarity-detection-approaches)
5. [Implementation Recommendations](#5-implementation-recommendations)
6. [References](#6-references)

---

## 1. LLM Prompt Engineering for Structured, Factual Match Narratives

### 1.1 Temperature Settings for Factual vs Creative Content

Temperature is a critical parameter that controls the randomness of LLM outputs. For match narratives in BettingSoccer, different temperature settings are recommended based on content type:

| Content Type | Temperature Range | Use Case |
|--------------|-------------------|----------|
| Factual Match Previews | 0.3 - 0.5 | Data-driven analysis with minimal hallucination risk |
| Statistical Roundups | 0.2 - 0.4 | Pure data presentation, highest accuracy |
| Betting Insights | 0.3 - 0.5 | Analytical content with some interpretive flexibility |
| Creative Narratives | 0.7 - 0.9 | Engaging storytelling, match recaps with flair |

**Key Insight**: For structured, factual content, lower temperatures (0.3-0.5) significantly reduce hallucinations while maintaining readability. The existing codebase uses Gemini 3 Flash Preview, which performs well at these settings.

```typescript
// src/lib/llm/config.ts (proposed)
export const LLM_CONFIG = {
  temperature: {
    factual: 0.3,
    analytical: 0.4,
    creative: 0.7,
  },
  maxTokens: {
    matchPreview: 2048,
    leagueRoundup: 4096,
    modelReport: 4096,
  },
} as const;
```

### 1.2 System Prompts for Match Analysis

The existing codebase at `src/lib/llm/prompt.ts` contains well-structured system prompts for prediction tasks. For match narratives, extend this pattern with content-specific system prompts:

```typescript
// src/lib/content/system-prompts.ts

export const MATCH_NARRATIVE_SYSTEM_PROMPT = `You are an expert football analyst and sports journalist specializing in data-driven match analysis.

RESPONSIBILITIES:
- Generate accurate, fact-based match narratives
- Reference provided statistics and data exclusively
- Maintain objectivity while providing insights
- Follow SEO best practices for sports content

OUTPUT REQUIREMENTS:
- Always respond with valid JSON matching the specified schema
- Use proper football terminology and competition names
- Include specific statistics and percentages when available
- Avoid speculation about unconfirmed information
- Structure content with clear headings and transitions

CRITICAL CONSTRAINTS:
- Do not invent player names, scores, or statistics
- Do not reference information not provided in the data
- If data is missing, state "Data unavailable" explicitly
- Maintain consistent tone: professional, analytical, engaging`;
```

**Existing Pattern Reference**: The codebase already demonstrates effective system prompt design in `src/lib/llm/prompt.ts:8-46` with the `SYSTEM_PROMPT` for score predictions. This pattern should be replicated for content generation with enhanced structure for narrative output.

### 1.3 JSON Mode for Structured Output

Together AI supports JSON mode through the `response_format` parameter, ensuring structured output that matches defined schemas:

```typescript
// src/lib/llm/client.ts
import OpenAI from 'openai';

const togetherClient = new OpenAI({
  apiKey: process.env.TOGETHER_API_KEY,
  baseUrl: 'https://api.together.xyz/v1',
});

export async function generateMatchContent(
  prompt: string,
  schema: object
): Promise<ContentResponse> {
  const response = await togetherClient.chat.completions.create({
    model: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
    messages: [
      { role: 'system', content: MATCH_NARRATIVE_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.4,
    response_format: {
      type: 'json_object',
      schema: schema,
    },
    max_tokens: 4096,
  });

  return JSON.parse(response.choices[0].message.content);
}
```

**Pydantic Integration**: For robust schema validation, use Pydantic-style schemas with Together AI:

```typescript
import { BaseModel } from './types';

class MatchPreviewResponse extends BaseModel {
  introduction: string;
  teamFormAnalysis: string;
  headToHead: string;
  keyPlayers: string;
  tacticalAnalysis: string;
  prediction: string;
  bettingInsights: string;
  metaDescription: string;
  keywords: string[];
}

// Usage with schema validation
const response = await togetherClient.chat.completions.create({
  model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
  messages: [...],
  response_format: {
    type: 'json_schema',
    schema: MatchPreviewResponse.schema(),
  },
});
```

### 1.4 Together AI Specific Parameters

Together AI offers several parameters optimized for structured content generation:

| Parameter | Recommended Value | Purpose |
|-----------|-------------------|---------|
| `temperature` | 0.3 - 0.5 | Factual content, low variance |
| `max_tokens` | 2048 - 4096 | Match preview to report lengths |
| `top_p` | 0.9 | Nucleus sampling, works with temperature |
| `repetition_penalty` | 1.0 - 1.1 | Reduce repetitive phrases |
| `stop` | ['```', '###'] | Prevent output contamination |

```typescript
// src/lib/llm/together-client.ts
export interface TogetherAIConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  repetitionPenalty?: number;
  stopSequences?: string[];
}

export const TOGETHER_MODELS = {
  preview: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
  roundup: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
  report: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
} as const;

export async function callTogetherAI(
  messages: Array<{ role: string; content: string }>,
  config: TogetherAIConfig
) {
  const client = getTogetherClient();
  
  return client.chat.completions.create({
    model: config.model,
    messages,
    temperature: config.temperature ?? 0.4,
    max_tokens: config.maxTokens ?? 2048,
    top_p: config.topP ?? 0.9,
    repetition_penalty: config.repetitionPenalty ?? 1.0,
    stop: config.stopSequences,
    response_format: {
      type: 'json_object',
    },
  });
}
```

### 1.5 Reference: Existing Prompt Patterns

The existing codebase in `src/lib/content/prompts.ts` demonstrates effective prompt engineering patterns:

**Match Preview Prompt** (`src/lib/content/prompts.ts:52-114`):
- Structured data input with clear formatting
- JSON output specification with field descriptions
- Writing guidelines section for consistency
- Length constraints for each section

**League Roundup Prompt** (`src/lib/content/prompts.ts:177-278`):
- Facts-only rules with explicit constraints
- Data tables for statistical presentation
- Structured output with SEO metadata fields

**Model Report Prompt** (`src/lib/content/prompts.ts:300-359`):
- Performance data integration
- Executive summary structure
- Markdown output with tables

---

## 2. BullMQ Job Patterns for Scheduled/Triggered Content Generation

### 2.1 Delayed Jobs for Post-Match Triggers

BullMQ supports delayed jobs using the `delay` option, which is ideal for triggering content generation after match completion. The settlement worker can queue content jobs with appropriate delays:

```typescript
// src/lib/queue/workers/settlement.worker.ts
import { getSettlementQueue, getContentQueue, QUEUE_NAMES } from '../index';

export async function schedulePostMatchContent(matchId: string, delayMs: number = 60000) {
  // Wait 60 seconds after settlement before generating post-match content
  // Allows for any final data updates
  await getContentQueue().add(
    'generate-post-match-content',
    {
      type: 'post_match_content',
      data: { matchId },
    },
    {
      delay: delayMs, // 60 second delay
      jobId: `post-match-${matchId}`,
      removeOnComplete: { age: 86400 }, // 24 hours
      removeOnFail: { age: 604800 }, // 7 days
    }
  );
}

// Usage in settlement worker after match scoring
async function settleMatch(job: Job<SettleMatchPayload>) {
  const { matchId } = job.data;
  
  // Perform settlement logic
  await calculateAndStoreResults(matchId);
  
  // Schedule post-match content generation
  await schedulePostMatchContent(matchId, 60000); // 1 minute delay
}
```

### 2.2 Event-Driven Triggers from Settlement Worker

The settlement worker can emit events or directly queue content jobs when matches are scored:

```typescript
// src/lib/queue/workers/settlement.worker.ts
import { Worker, Job } from 'bullmq';
import { getSettlementQueue, getContentQueue, QUEUE_NAMES } from '../index';
import { loggers } from '@/lib/logger/modules';

export function createSettlementWorker() {
  return new Worker<SettleMatchPayload>(
    QUEUE_NAMES.SETTLEMENT,
    async (job: Job<SettleMatchPayload>) => {
      const { matchId } = job.data;
      const log = loggers.settlement.child({ jobId: job.id, matchId });
      
      try {
        log.info('Starting match settlement');
        
        // Perform settlement
        const result = await settleMatch(matchId);
        
        // Event-driven content generation triggers
        await triggerContentGeneration(matchId, result);
        
        log.info({ hasPostMatchContent: !!result.finalScore }, 'Settlement complete');
        return result;
      } catch (error) {
        log.error({ err: error }, 'Settlement failed');
        throw error;
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: 2,
      limiter: {
        max: 20,
        duration: 60000, // 20 settlements per minute max
      },
    }
  );
}

async function triggerContentGeneration(matchId: string, result: SettlementResult) {
  const contentQueue = getContentQueue();
  
  // Always queue post-match content for finished matches
  if (result.finalScore) {
    await contentQueue.add(
      'generate-post-match-narrative',
      {
        type: 'post_match_narrative',
        data: {
          matchId,
          finalScore: result.finalScore,
          performance: result.aiModelPerformance,
        },
      },
      {
        delay: 30000, // 30 second delay for data stabilization
        jobId: `post-match-narrative-${matchId}`,
        priority: 10, // Higher priority than scheduled content
      }
    );
  }
  
  // Queue league roundup update if this was the last match of the round
  if (result.completedRound) {
    await contentQueue.add(
      'update-league-roundup',
      {
        type: 'league_roundup_update',
        data: {
          competitionId: result.competitionId,
          round: result.round,
        },
      },
      {
        jobId: `roundup-${result.competitionId}-${result.round}`,
      }
    );
  }
}
```

### 2.3 Queue Configuration Patterns

The existing codebase at `src/lib/queue/index.ts` defines comprehensive queue configurations. For content generation, extend this with content-specific settings:

```typescript
// src/lib/queue/content-config.ts
import { QUEUE_NAMES, getQueueTimeout, getWorkerLockDuration } from './index';

export const CONTENT_QUEUE_CONFIG = {
  [QUEUE_NAMES.CONTENT]: {
    // Content generation is CPU-bound and API-limited
    timeout: getQueueTimeout(QUEUE_NAMES.CONTENT),
    lockDuration: getWorkerLockDuration(QUEUE_NAMES.CONTENT),
    // Rate limiting for LLM API calls
    limiter: {
      max: 30, // 30 requests per minute (Together AI limit)
      duration: 60000,
    },
    // Retry strategy for transient failures
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10000, // 10s, 20s, 40s
    },
  },
};

// Content job types
export const CONTENT_JOB_TYPES = {
  MATCH_PREVIEW: 'match_preview',
  LEAGUE_ROUNDUP: 'league_roundup',
  MODEL_REPORT: 'model_report',
  POST_MATCH_NARRATIVE: 'post_match_narrative',
  CONTENT_SCAN: 'content_scan',
} as const;
```

### 2.4 Rate Limiting for API Calls

BullMQ provides built-in rate limiting for workers, essential for respecting LLM API quotas:

```typescript
// src/lib/queue/workers/content.worker.ts (existing pattern at line 88-96)
import { Worker, Job } from 'bullmq';
import { getQueueConnection, QUEUE_NAMES } from '../index';

export function createContentWorker() {
  return new Worker<GenerateContentPayload>(
    QUEUE_NAMES.CONTENT,
    async (job: Job<GenerateContentPayload>) => {
      const { type, data } = job.data;
      // Content generation logic
    },
    {
      connection: getQueueConnection(),
      concurrency: 1, // Process one at a time
      limiter: {
        max: 30, // Max 30 requests per minute
        duration: 60000, // Per minute
      },
    }
  );
}
```

**Additional Rate Limiting Strategies**:

```typescript
// Manual rate limit management for dynamic limits
async function manageContentRateLimit(
  worker: Worker,
  apiResponse: APIResponse
) {
  // Check for rate limit headers
  const remaining = apiResponse.headers.get('x-ratelimit-remaining');
  const resetTime = apiResponse.headers.get('x-ratelimit-reset-time');
  
  if (remaining === '0' && resetTime) {
    const delayMs = new Date(resetTime).getTime() - Date.now();
    await worker.rateLimit(delayMs);
    throw new Worker.RateLimitError();
  }
}
```

### 2.5 Queue Dependencies and Chaining

For complex content generation workflows, use BullMQ's job dependencies:

```typescript
// src/lib/queue/content-workflow.ts
async function generateMatchDayContentWorkflow(matchId: string) {
  const contentQueue = getContentQueue();
  
  // Step 1: Generate pre-match preview
  const previewJob = await contentQueue.add(
    'generate-match-preview',
    { type: 'match_preview', data: { matchId } },
    { jobId: `preview-${matchId}` }
  );
  
  // Step 2: Generate betting analysis (depends on preview)
  await contentQueue.add(
    'generate-betting-content',
    { type: 'betting_content', data: { matchId } },
    {
      jobId: `betting-${matchId}`,
      parent: { id: previewJob.id, queue: QUEUE_NAMES.CONTENT },
    }
  );
  
  // Step 3: Queue post-match generation (ready for later)
  await contentQueue.add(
    'schedule-post-match',
    {
      type: 'schedule_post_match',
      data: {
        matchId,
        triggerAfter: 'match_finish',
        delay: 60000,
      },
    },
    { jobId: `post-match-scheduled-${matchId}` }
  );
}
```

---

## 3. HTML Rendering Patterns in Next.js for Match Content

### 3.1 Server Components for Static Content

Next.js App Router Server Components are ideal for rendering match content with optimal performance:

```tsx
// src/app/matches/[slug]/page.tsx
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { cacheKeys, withCache, CACHE_TTL } from '@/lib/cache/redis';
import { getMatchBySlug, getMatchContent } from '@/lib/db/queries';
import { MatchContentClient } from './match-content-client';
import { MatchPreviewServer } from './match-preview-server';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// ISR: Revalidate match content every 5 minutes
export const revalidate = 300;

export default async function MatchPage({ params }: PageProps) {
  const { slug } = await params;
  
  // Fetch match data with caching
  const match = await withCache(
    cacheKeys.matchBySlug(slug),
    CACHE_TTL.FIXTURES_SCHEDULED,
    async () => {
      const result = await getMatchBySlug(slug);
      if (!result) return null;
      return result;
    }
  );
  
  if (!match) {
    notFound();
  }
  
  // Fetch generated content
  const matchContent = await getMatchContent(match.id);
  
  return (
    <main className="container mx-auto py-8">
      <MatchPreviewServer
        match={match}
        content={matchContent}
      />
      
      <Suspense fallback={<div>Loading interactive content...</div>}>
        <MatchContentClient matchId={match.id} />
      </Suspense>
    </main>
  );
}
```

### 3.2 Incremental Static Regeneration (ISR) Patterns

For frequently accessed match content, ISR provides optimal performance with automatic updates:

```tsx
// src/app/league/[slug]/roundup/page.tsx
import { cacheKeys, withCache, CACHE_TTL } from '@/lib/cache/redis';
import { getLeagueRoundupData } from '@/lib/content/queries';
import { generateLeagueRoundup } from '@/lib/content/generator';

// Time-based revalidation: every hour for roundups
export const revalidate = 3600;

// On-demand revalidation helper
export async function triggerRoundupRevalidation(competitionSlug: string) {
  await revalidatePath(`/league/${slug}/roundup`);
}

// ISR page implementation
export default async function LeagueRoundupPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  
  const roundupData = await withCache(
    cacheKeys.leagueRoundup(slug),
    CACHE_TTL.LEADERBOARD, // 1 minute for dynamic content
    async () => {
      const data = await getLeagueRoundupData(slug);
      if (!data) return null;
      
      // Generate fresh content if cache miss
      return await generateLeagueRoundup(data);
    }
  );
  
  if (!roundupData) {
    return <div>No roundup available for this week</div>;
  }
  
  return (
    <article className="prose lg:prose-xl mx-auto py-8">
      <h1>{roundupData.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: roundupData.content }} />
    </article>
  );
}
```

### 3.3 Caching Strategies from Redis

The existing Redis caching layer at `src/lib/cache/redis.ts` provides foundation for content caching:

```typescript
// src/lib/cache/content-cache.ts
import { cacheKeys, CACHE_TTL, cacheGet, cacheSet, cacheDelete } from './redis';
import { loggers } from '@/lib/logger/modules';

export const CONTENT_CACHE_TTL = {
  matchPreview: 3600,      // 1 hour - pre-match content
  bettingContent: 1800,    // 30 minutes - near kickoff
  postMatchNarrative: 86400, // 24 hours - after match
  leagueRoundup: 7200,     // 2 hours - weekly content
  modelReport: 43200,      // 12 hours - periodic reports
} as const;

export async function cacheMatchContent(
  matchId: string,
  contentType: keyof typeof CONTENT_CACHE_TTL,
  content: object
): Promise<boolean> {
  const key = `${cacheKeys.matchContent(matchId)}:${contentType}`;
  const ttl = CONTENT_CACHE_TTL[contentType];
  
  try {
    await cacheSet(key, content, ttl);
    loggers.cache.debug({ matchId, contentType, ttl }, 'Cached match content');
    return true;
  } catch (error) {
    loggers.cache.error({ matchId, contentType, error }, 'Failed to cache content');
    return false;
  }
}

export async function getCachedMatchContent<T>(
  matchId: string,
  contentType: keyof typeof CONTENT_CACHE_TTL
): Promise<T | null> {
  const key = `${cacheKeys.matchContent(matchId)}:${contentType}`;
  return cacheGet<T>(key);
}

export async function invalidateMatchContent(matchId: string): Promise<void> {
  await cacheDeletePattern(`${cacheKeys.matchContent(matchId)}:*`);
}
```

### 3.4 Existing Content Generation Patterns

The codebase already implements content generation patterns in `src/lib/content/generator.ts`:

```typescript
// src/lib/content/generator.ts (pattern reference)
import { generateMatchPreview, generateLeagueRoundup, generateModelReport } from './generator';
import { TOGETHER_MODELS } from '@/lib/llm/together-client';
import { loggers } from '@/lib/logger/modules';

export async function generateMatchPreview(data: MatchPreviewInput): Promise<string> {
  const log = loggers.contentGeneration.child({ type: 'match_preview' });
  
  // Build prompt from template
  const prompt = buildMatchPreviewPrompt(data);
  
  // Call LLM with structured output
  const response = await callTogetherAI(
    [{ role: 'user', content: prompt }],
    {
      model: TOGETHER_MODELS.preview,
      temperature: 0.4,
      maxTokens: 2048,
    }
  );
  
  // Parse and validate response
  const parsed = parsePreviewResponse(response);
  
  // Store in database
  const previewId = await storeMatchPreview(parsed);
  
  log.info({ previewId }, 'Match preview generated');
  return previewId;
}
```

### 3.5 Content Rendering Components

```tsx
// src/components/match/match-content.tsx
import { MatchContent as MatchContentType } from '@/lib/db/schema';

interface MatchContentProps {
  content: MatchContentType;
}

export function MatchContent({ content }: MatchContentProps) {
  return (
    <div className="match-content space-y-6">
      {content.preMatchContent && (
        <section className="pre-match">
          <h2 className="text-xl font-semibold mb-2">Pre-Match Analysis</h2>
          <div
            className="prose"
            dangerouslySetInnerHTML={{ __html: parseMarkdown(content.preMatchContent) }}
          />
        </section>
      )}
      
      {content.bettingContent && (
        <section className="betting">
          <h2 className="text-xl font-semibold mb-2">Betting Insights</h2>
          <div
            className="prose"
            dangerouslySetInnerHTML={{ __html: parseMarkdown(content.bettingContent) }}
          />
        </section>
      )}
      
      {content.postMatchContent && (
        <section className="post-match">
          <h2 className="text-xl font-semibold mb-2">Match Review</h2>
          <div
            className="prose"
            dangerouslySetInnerHTML={{ __html: parseMarkdown(content.postMatchContent) }}
          />
        </section>
      )}
    </div>
  );
}
```

---

## 4. Content Deduplication/Similarity Detection Approaches

### 4.1 MinHash/LSH for Similarity Detection

MinHash with Locality-Sensitive Hashing (LSH) provides efficient approximate similarity detection for large content corpora:

```typescript
// src/lib/content/deduplication/minhash.ts
import crypto from 'crypto';

interface MinHashSignature {
  hashFunctions: number[];
}

class MinHash {
  private readonly numHashes: number;
  private readonly maxHash: bigint;
  
  constructor(numHashes: number = 128) {
    this.numHashes = numHashes;
    this.maxHash = BigInt(2) ** BigInt(64) - BigInt(1);
  }
  
  // Generate MinHash signature for a set of tokens
  generateSignature(tokens: string[]): MinHashSignature {
    const hashFunctions: number[] = [];
    
    for (let i = 0; i < this.numHashes; i++) {
      let minHash = Number.MAX_SAFE_INTEGER;
      
      for (const token of tokens) {
        const hash = this.doubleHash(token, i);
        if (hash < minHash) {
          minHash = hash;
        }
      }
      
      hashFunctions.push(minHash);
    }
    
    return { hashFunctions };
  }
  
  // Double hashing for better distribution
  private doubleHash(token: string, seed: number): number {
    const combined = `${seed}:${token}`;
    const hash = crypto.createHash('sha256').update(combined).digest();
    const bigintHash = BigInt('0x' + hash.toString('hex').slice(0, 16));
    return Number(bigintHash % BigInt(Number.MAX_SAFE_INTEGER));
  }
  
  // Estimate Jaccard similarity from signatures
  estimateSimilarity(sig1: MinHashSignature, sig2: MinHashSignature): number {
    let matches = 0;
    for (let i = 0; i < this.numHashes; i++) {
      if (sig1.hashFunctions[i] === sig2.hashFunctions[i]) {
        matches++;
      }
    }
    return matches / this.numHashes;
  }
}

// LSH Index for bucketing similar documents
class LSHIndex {
  private readonly bands: number;
  private readonly rowsPerBand: number;
  private readonly buckets: Map<string, string[]>;
  private readonly minhash: MinHash;
  
  constructor(numHashes: number = 128, bands: number = 16) {
    this.bands = bands;
    this.rowsPerBand = Math.ceil(numHashes / bands);
    this.buckets = new Map();
    this.minhash = new MinHash(numHashes);
  }
  
  // Generate LSH buckets for a document
  private getBuckets(signature: MinHashSignature): string[] {
    const buckets: string[] = [];
    
    for (let band = 0; band < this.bands; band++) {
      const start = band * this.rowsPerBand;
      const end = start + this.rowsPerBand;
      const bandHashes = signature.hashFunctions.slice(start, end);
      
      // Create bucket key from band hashes
      const bucketKey = crypto
        .createHash('sha256')
        .update(bandHashes.join(':'))
        .digest('hex');
      
      buckets.push(bucketKey);
    }
    
    return buckets;
  }
  
  // Index a document
  index(documentId: string, tokens: string[]): void {
    const signature = this.minhash.generateSignature(tokens);
    const buckets = this.getBuckets(signature);
    
    for (const bucket of buckets) {
      const existing = this.buckets.get(bucket) || [];
      existing.push(documentId);
      this.buckets.set(bucket, existing);
    }
  }
  
  // Find potential duplicates
  findCandidates(documentId: string, tokens: string[]): string[] {
    const signature = this.minhash.generateSignature(tokens);
    const buckets = this.getBuckets(signature);
    const candidates = new Set<string>();
    
    for (const bucket of buckets) {
      const documents = this.buckets.get(bucket) || [];
      for (const doc of documents) {
        if (doc !== documentId) {
          candidates.add(doc);
        }
      }
    }
    
    return Array.from(candidates);
  }
}

export { MinHash, LSHIndex };
```

### 4.2 Jaccard Similarity for Text Comparison

For simpler use cases, direct Jaccard similarity computation is effective:

```typescript
// src/lib/content/deduplication/jaccard.ts
interface TokenSet {
  [key: string]: number; // Token -> frequency
}

function tokenize(text: string): TokenSet {
  // Normalize and tokenize
  const normalized = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ');   // Normalize whitespace
  
  const tokens = normalized.split(' ');
  const tokenSet: TokenSet = {};
  
  for (const token of tokens) {
    if (token.length > 2) { // Filter short tokens
      tokenSet[token] = (tokenSet[token] || 0) + 1;
    }
  }
  
  return tokenSet;
}

function jaccardSimilarity(set1: TokenSet, set2: TokenSet): number {
  const union = new Set([...Object.keys(set1), ...Object.keys(set2)]);
  const intersection = new Set(
    Object.keys(set1).filter(key => key in set2)
  );
  
  return intersection.size / union.size;
}

// Weighted Jaccard for TF-aware comparison
function weightedJaccard(set1: TokenSet, set2: TokenSet): number {
  const allTokens = new Set([...Object.keys(set1), ...Object.keys(set2)]);
  let numerator = 0 = 0;
;
  let denominator  
  for (const token of allTokens) {
    const weight1 = set1[token] || 0;
    const weight2 = set2[token] || 0;
    numerator += Math.min(weight1, weight2);
    denominator += Math.max(weight1, weight2);
  }
  
  return denominator === 0 ? 0 : numerator / denominator;
}

export function compareContent(content1: string, content2: string): {
  jaccard: number;
  weightedJaccard: number;
  threshold: 'duplicate' | 'similar' | 'unique';
} {
  const tokens1 = tokenize(content1);
  const tokens2 = tokenize(content2);
  
  const jaccard = jaccardSimilarity(tokens1, tokens2);
  const weighted = weightedJaccard(tokens1, tokens2);
  
  let threshold: 'duplicate' | 'similar' | 'unique';
  if (jaccard > 0.9) {
    threshold = 'duplicate';
  } else if (jaccard > 0.7) {
    threshold = 'similar';
  } else {
    threshold = 'unique';
  }
  
  return { jaccard, weightedJaccard: weighted, threshold };
}
```

### 4.3 Semantic Embedding Comparison

For semantic similarity, use vector embeddings with cosine similarity:

```typescript
// src/lib/content/deduplication/embeddings.ts
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseUrl: 'https://api.together.xyz/v1',
});

interface EmbeddingVector {
  vector: number[];
  text: string;
}

async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'togethercomputer/m2-bert-80M-2k-retrieval',
    input: text,
  });
  
  return response.data[0].embedding;
}

function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vector dimensions must match');
  }
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  
  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

async function findSemanticDuplicates(
  newContent: string,
  existingContents: Array<{ id: string; content: string }>,
  similarityThreshold: number = 0.85
): Promise<Array<{ id: string; similarity: number }>> {
  const newEmbedding = await getEmbedding(newContent);
  const duplicates: Array<{ id: string; similarity: number }> = [];
  
  for (const existing of existingContents) {
    const existingEmbedding = await getEmbedding(existing.content);
    const similarity = cosineSimilarity(newEmbedding, existingEmbedding);
    
    if (similarity >= similarityThreshold) {
      duplicates.push({ id: existing.id, similarity });
    }
  }
  
  return duplicates.sort((a, b) => b.similarity - a.similarity);
}
```

### 4.4 Database Query Patterns

The existing schema at `src/lib/db/schema.ts` supports content deduplication through existing tables:

```typescript
// src/lib/db/queries/content.ts
import { eq, sql } from 'drizzle-orm';
import { getDb, matchContent, blogPosts } from '@/lib/db';
import { cacheGet, cacheSet, CACHE_TTL } from '@/lib/cache/redis';

export async function findSimilarContent(
  contentType: 'match' | 'league' | 'model',
  excludeId: string,
  similarityThreshold: number = 0.7
): Promise<string[]> {
  const db = getDb();
  
  // Query for content with similar characteristics
  const result = await db
    .select({ id: matchContent.id })
    .from(matchContent)
    .innerJoin(matches, eq(matchContent.matchId, matches.id))
    .where(
      sql`
        ${matchContent.id} != ${excludeId}
        AND (${matchContent.preMatchContent} IS NOT NULL OR ${matchContent.postMatchContent} IS NOT NULL)
      `
    )
    .limit(100);
  
  return result.map(r => r.id);
}

// Check for duplicate by exact content hash
export async function findByContentHash(
  contentHash: string
): Promise<string | null> {
  const db = getDb();
  
  const result = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .where(sql`SUBSTRING(md5(${blogPosts.content}), 1, 16) = ${contentHash}`)
    .limit(1);
  
  return result[0]?.id || null;
}

// Store content with hash for deduplication
export async function storeContentWithHash(
  content: string,
  contentType: string
): Promise<{ id: string; contentHash: string }> {
  const contentHash = crypto
    .createHash('md5')
    .update(content)
    .digest('hex');
  
  // Check for existing
  const existing = await findByContentHash(contentHash);
  if (existing) {
    return { id: existing, contentHash };
  }
  
  // Store new content
  // ... (actual storage logic)
  
  return { id: 'new-id', contentHash };
}
```

### 4.5 Complete Deduplication Service

```typescript
// src/lib/content/deduplication/service.ts
import { MinHash, LSHIndex } from './minhash';
import { compareContent } from './jaccard';
import { findSemanticDuplicates } from './embeddings';
import { findSimilarContent } from '@/lib/db/queries/content';

interface DeduplicationResult {
  isDuplicate: boolean;
  similarIds: Array<{ id: string; score: number; method: string }>;
  action: 'allow' | 'warn' | 'block';
}

export class ContentDeduplicationService {
  private lsh: LSHIndex;
  private minhash: MinHash;
  
  constructor() {
    this.minhash = new MinHash(128);
    this.lsh = new LSHIndex(128, 16);
  }
  
  async checkForDuplicates(
    content: string,
    contentType: string,
    excludeId?: string
  ): Promise<DeduplicationResult> {
    const similarIds = await findSimilarContent(contentType, excludeId || '');
    const findings: Array<{ id: string; score: number; method: string }> = [];
    
    // Token-based comparison
    for (const id of similarIds) {
      const existing = await this.getContentById(id);
      if (existing) {
        const { jaccard, threshold } = compareContent(content, existing);
        
        if (threshold !== 'unique') {
          findings.push({
            id,
            score: jaccard,
            method: threshold === 'duplicate' ? 'exact_token' : 'similar_token',
          });
        }
      }
    }
    
    // Semantic comparison for borderline cases
    if (findings.length === 0 || findings.some(f => f.score < 0.9)) {
      const semanticResults = await findSemanticDuplicates(
        content,
        similarIds.map(id => ({ id, content: '' })), // Fetch actual content
        0.85
      );
      
      for (const result of semanticResults) {
        if (!findings.some(f => f.id === result.id)) {
          findings.push({
            id: result.id,
            score: result.similarity,
            method: 'semantic_embedding',
          });
        }
      }
    }
    
    // Determine action based on findings
    const maxScore = Math.max(...findings.map(f => f.score), 0);
    let action: 'allow' | 'warn' | 'block' = 'allow';
    
    if (maxScore > 0.95) {
      action = 'block';
    } else if (maxScore > 0.8) {
      action = 'warn';
    }
    
    return {
      isDuplicate: action !== 'allow',
      similarIds: findings,
      action,
    };
  }
  
  private async getContentById(id: string): Promise<string | null> {
    // Fetch from database
    return null;
  }
}

export const deduplicationService = new ContentDeduplicationService();
```

---

## 5. Implementation Recommendations

### 5.1 Phased Rollout Strategy

**Phase 4.1: Foundation**
- Implement LLM client wrapper with temperature control
- Set up content queue worker with rate limiting
- Create base prompt templates

**Phase 4.2: Core Generation**
- Build match preview generation pipeline
- Implement league roundup generation
- Add post-match narrative generation

**Phase 4.3: Optimization**
- Implement MinHash deduplication
- Add semantic similarity detection
- Set up cache invalidation patterns

### 5.2 Key Integration Points

| Component | Integration Point | Dependencies |
|-----------|------------------|--------------|
| Content Queue | `src/lib/queue/index.ts:331-336` | Existing queue setup |
| Prompt Templates | `src/lib/content/prompts.ts` | Extend existing patterns |
| Database Schema | `src/lib/db/schema.ts:363-482` | blogPosts, matchContent tables |
| Caching | `src/lib/cache/redis.ts` | Extend CACHE_TTL constants |
| LLM Client | `src/lib/llm/prompt.ts` | Reuse existing patterns |

### 5.3 Performance Considerations

1. **Queue Concurrency**: Keep content worker at concurrency 1 due to API rate limits
2. **Cache TTL**: Match content varies freshness requirements - use tiered TTL
3. **Deduplication Cost**: Run async to avoid blocking content generation
4. **ISR Revalidation**: Set revalidate based on content update frequency

### 5.4 Error Handling Patterns

```typescript
// src/lib/content/error-handling.ts
export class ContentGenerationError extends Error {
  constructor(
    message: string,
    public readonly contentType: string,
    public readonly matchId?: string,
    public readonly retryable: boolean = true
  ) {
    super(message);
    this.name = 'ContentGenerationError';
  }
}

export async function withContentRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (error instanceof ContentGenerationError && !error.retryable) {
        throw error;
      }
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
```

---

## 6. References

### External Documentation

1. **BullMQ Documentation**
   - [BullMQ GitHub](https://github.com/taskforcesh/bullmq)
   - [Rate Limiting Guide](https://github.com/taskforcesh/bullmq/blob/master/elixir/guides/rate_limiting.md)
   - [Worker Configuration](https://github.com/taskforcesh/bullmq/blob/master/elixir/README.md)

2. **Together AI Documentation**
   - [Together AI API Docs](https://docs.together.ai/)
   - [JSON Mode Guide](https://docs.together.ai/docs/json-mode)
   - [OpenAI Compatibility](https://docs.together.ai/docs/openai-api-compatibility)

3. **Next.js Documentation**
   - [Next.js App Router](https://nextjs.org/docs/app)
   - [Incremental Static Regeneration](https://nextjs.org/docs/app/guides/incremental-static-regeneration)
   - [Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)

### Internal Codebase References

| File | Purpose |
|------|---------|
| `src/lib/llm/prompt.ts` | Existing LLM prompt patterns |
| `src/lib/content/prompts.ts` | Content generation templates |
| `src/lib/queue/index.ts` | Queue configuration |
| `src/lib/queue/workers/content.worker.ts` | Content worker implementation |
| `src/lib/cache/redis.ts` | Caching infrastructure |
| `src/lib/db/schema.ts` | Database schema with content tables |

---

*Document Version: 1.0*
*Created: January 2026*
*Phase: 04-Content Pipeline*
