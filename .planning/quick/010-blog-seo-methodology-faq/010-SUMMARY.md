# Quick Task 010: Summary

## Task
Improve blog post methodology, SEO/GEO optimization, and add FAQ section

## Problems Fixed

### 1. Wrong Methodology
**Before:** Prompt said `## Methodology (how scoring works)` and left LLM to explain it
**After:** Prompt includes exact methodology template explaining:
- Quota-based scoring (tendency points 2-6 based on rarity)
- Goal difference bonus (+1)
- Exact score bonus (+3)
- Maximum 10 points per prediction
- Link to /methodology page

### 2. Poor SEO/GEO Structure
**Before:** Jumped straight from opening summary to stats tables
**After:** Added "Context Introduction" section requirement:
- 2-3 sentences providing context before stats
- Explains what the round covered, why it matters
- Natural language for AI search engines to cite

### 3. No FAQ Section
**Before:** No FAQ in blog posts
**After:** Added "Frequently Asked Questions" section with 3-4 Q&A pairs:
- "Which AI model performed best?"
- "How accurate were predictions?"
- "What was the biggest upset?"
- "How does scoring work?"

## Changes

| File | Change |
|------|--------|
| `src/lib/content/prompts.ts` | Updated `buildLeagueRoundupPrompt()` with methodology template, context intro, and FAQ section |

## New Content Structure

```
1. Opening Summary (answer-first, 30-60 words)
2. Context Introduction (2-3 sentences, GEO/SEO)
3. ## Top 10 Models
4. ## Match-by-Match Audit
5. ## Biggest Consensus Misses
6. ## Methodology (fixed template)
7. ## Frequently Asked Questions
```

## Verification
- ✅ Build passes
- ✅ No "Kicktipp" mentions in prompt
- ✅ Proper scoring explanation (quota-based system)
- ✅ FAQ section included
- ✅ Context intro for better SEO

## Commit
da9db4a
