# Quick Task 010: Improve Blog Post Methodology, SEO/GEO, and FAQ

## Problem Summary

1. **Wrong Methodology**: Blog posts depend on LLM to explain scoring, leading to incorrect/inconsistent explanations
2. **Poor SEO/GEO Structure**: Posts dive straight into stats without contextual intro
3. **No FAQ Section**: Blog posts lack dynamically generated FAQ for search visibility

## Solution

### Task 1: Add Proper Methodology Template to League Roundup Prompt

**File:** `src/lib/content/prompts.ts`

Update `buildLeagueRoundupPrompt()` to include a detailed methodology template that:
- Explains the quota-based scoring system correctly (without Kicktipp branding)
- Covers: Tendency Points (2-6 based on prediction rarity), Goal Diff Bonus (+1), Exact Score Bonus (+3)
- Maximum 10 points per prediction
- Links to /methodology page for full details

**Key change:** Replace generic `## Methodology (how scoring works)` with a concrete template.

### Task 2: Add SEO/GEO Intro Section to Prompt

**File:** `src/lib/content/prompts.ts`

Add a new section requirement for a contextual intro (before diving into stats):
- 2-3 sentences providing context (what league, what round, why this matters)
- Natural language that AI search engines can cite
- Avoid "wall of stats" opening

Structure change:
```
Old: Opening Summary → Stats
New: Opening Summary → Context Intro → Stats
```

### Task 3: Add FAQ Section to League Roundup Prompt

**File:** `src/lib/content/prompts.ts`

Add `## Frequently Asked Questions` section requirement with 3-4 dynamic FAQs:
- "Which AI model performed best this week?"
- "How accurate were AI predictions for [League] [Round]?"
- "What was the biggest upset this round?"
- "How does the scoring system work?"

Return as part of content markdown (not separate JSON field).

### Task 4: Update JSON Return Schema

**File:** `src/lib/content/prompts.ts`

Update the return JSON schema to include the new structure:
```
content: "Opening summary → Context Intro → ## Top 10 Models → ## Match-by-Match Audit → ## Biggest Consensus Misses → ## Methodology → ## FAQ"
```

## Verification

- [ ] Build passes
- [ ] Methodology section has correct scoring explanation
- [ ] No "Kicktipp" mentions in prompt
- [ ] FAQ section included in content structure
- [ ] Context intro before stats dive
