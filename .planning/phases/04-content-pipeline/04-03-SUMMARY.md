---
phase: 04-content-pipeline
plan: "03"
subsystem: content
tags: [postgresql, deduplication, roundups, jaccard-similarity]
---

# Phase 4 Plan 3: Content Storage Schema and Similarity Detection Summary

**Objective:** Add content storage schema and similarity detection to ensure unique roundups.

**One-liner:** Jaccard similarity deduplication for unique match roundups with 0.7 threshold

---

## Dependency Graph

**Requires:** Phase 4 Plan 04-02 (LLM-Powered Post-Match Roundups)

**Provides:** 
- `matchRoundups` database table for full roundup storage
- `deduplication.ts` service with Jaccard similarity
- Integrated deduplication in roundup generation pipeline

**Affects:**
- Future content pipeline phases requiring content uniqueness
- Roundup generation performance (additional similarity checks)

---

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Jaccard similarity over MinHash | Simpler implementation, sufficient for typical roundup volumes (<1000). MinHash would be better for >10,000 documents. |
| SHA-256 for content hashing | Industry-standard for exact duplicate detection. Fast computation, collision-resistant. |
| 0.7 similarity threshold | Balances strictness with natural language variation. Content with >70% token overlap is likely templated or duplicated. |
| Regeneration with angle rotation | Four narrative angles (tactical, player focus, historical, statistical) provide variety without changing core facts. |
| Manual migration file | DATABASE_URL not available in execution environment. Migration SQL file created for manual execution. |

---

## Deviations from Plan

**None - plan executed exactly as written.**

---

## Files Created/Modified

### Created Files

| File | Purpose |
|------|---------|
| `src/lib/content/deduplication.ts` | Jaccard similarity deduplication service |
| `drizzle/0010_add_match_roundups.sql` | Database migration for matchRoundups table |

### Modified Files

| File | Changes |
|------|---------|
| `src/lib/db/schema.ts` | Added `matchRoundups` table with 18 columns |
| `src/lib/content/generator.ts` | Integrated deduplication into roundup generation |

### Key Files Reference

| Path | Provides |
|------|----------|
| `src/lib/db/schema.ts:485-540` | `matchRoundups` table definition |
| `src/lib/content/deduplication.ts` | `tokenize()`, `computeJaccardSimilarity()`, `checkForDuplicates()` |
| `src/lib/content/generator.ts:730-990` | Deduplication integration with regeneration logic |
| `drizzle/0010_add_match_roundups.sql` | PostgreSQL migration for table creation |

---

## Technical Implementation

### Jaccard Similarity Algorithm

```
tokenize(text) → normalize lowercase, remove HTML/punctuation → split on whitespace
computeJaccard(tokens1, tokens2) → |intersection| / |union|
threshold: > 0.7 = too similar → regenerate
```

### Deduplication Workflow

1. **Exact duplicate check**: Compute SHA-256 hash, query existing roundups
2. **Similarity check**: Tokenize narrative, compare with 10 most recent roundups
3. **Action decision**: `allow` | `regenerate` | `skip`
4. **Regeneration**: If >70% similar, regenerate with different narrative angle

### Narrative Angles for Regeneration

1. Tactical analysis (formation changes, key moments)
2. Individual player performances
3. Historical context and season implications
4. Statistical deep-dive

### Database Schema

```sql
match_roundups (
  id TEXT PRIMARY KEY,
  match_id TEXT UNIQUE REFERENCES matches(id),
  title TEXT NOT NULL,
  scoreboard TEXT NOT NULL,      -- JSON
  events TEXT,                   -- JSON array
  stats TEXT NOT NULL,           -- JSON
  model_predictions TEXT NOT NULL, -- HTML table
  top_performers TEXT NOT NULL,  -- JSON array
  narrative TEXT NOT NULL,       -- Full HTML content
  keywords TEXT,
  similarity_hash TEXT,          -- SHA-256
  generation_cost DOUBLE PRECISION,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  generated_by TEXT,
  status TEXT DEFAULT 'pending',
  published_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

---

## Metrics

| Metric | Value |
|--------|-------|
| Tasks completed | 4/4 |
| Files created | 2 |
| Files modified | 2 |
| Lines added | ~500 |
| Deduplication threshold | 0.7 (70%) |
| Regeneration attempts | Max 2 |
| Recent roundups compared | 10 |

---

## Authentication Gates

**None** - No external authentication required for this plan.

---

## Next Steps

After applying the database migration:

```bash
npm run db:migrate  # Apply drizzle/0010_add_match_roundups.sql
```

The roundup generation will now:
- Check for duplicates before storage
- Regenerate with different angle if >70% similar
- Store similarity hash for future detection

---

## Verification Commands

```bash
# Verify table exists
psql $DATABASE_URL -c "SELECT * FROM match_roundups LIMIT 1;"

# Verify deduplication compiles
npx tsc --noEmit src/lib/content/deduplication.ts

# Test similarity detection
node -e "const {tokenize, computeJaccardSimilarity} = require('./src/lib/content/deduplication'); console.log(computeJaccardSimilarity(tokenize('hello world'), tokenize('hello world')));"
```

---

*Executed: 2026-01-27*
*Duration: Plan execution completed*
*Next: Phase 4 Plan 04-04 or verification*
