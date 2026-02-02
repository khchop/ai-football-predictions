---
phase: 16-ai-search-optimization
plan: 01
subsystem: seo
tags: [robots.txt, llms.txt, ai-crawlers, geo]

# What this plan built on
requires:
  - phase-15 # Performance optimization provides stable match pages

# What this plan delivered
provides:
  - ai-crawler-access # All major AI crawlers explicitly allowed
  - llms-txt-compliance # llms.txt follows specification with markdown links

# Future phases that might need this
affects:
  - phase-16-02 # Schema consolidation builds on crawler access

tech-stack:
  added: []
  patterns:
    - "Explicit AI crawler allow rules in robots.ts"
    - "Markdown link syntax in llms.txt for AI parsers"

key-files:
  created: []
  modified:
    - src/app/robots.ts
    - src/app/llms.txt/route.ts

decisions:
  - id: 16-01-01
    choice: "Group AI crawlers by company in robots.ts"
    reason: "Improves maintainability and makes quarterly reviews easier"
  - id: 16-01-02
    choice: "Add descriptive text to llms.txt markdown links"
    reason: "Better AI parser compatibility - some LLMs parse [text](url) better than bare URLs"

metrics:
  duration: "2 minutes"
  completed: "2026-02-02"
---

# Phase 16 Plan 01: AI Crawler Configuration Summary

**One-liner:** Expanded robots.txt to 10 AI crawlers (added Amazonbot, OAI-SearchBot, Claude-SearchBot) and improved llms.txt URL formatting.

## What Was Built

Added comprehensive AI crawler support to maximize visibility in AI search results (ChatGPT Search, Perplexity, Claude, Amazon Q).

### Task 1: AI Crawler User-Agents in robots.ts

**Changes:**
- Added `OAI-SearchBot` (OpenAI's SearchGPT crawler, distinct from training GPTBot)
- Added `Claude-SearchBot` (Anthropic's search feature crawler)
- Added `Amazonbot` (Amazon Alexa, Amazon Q, shopping search)
- Added comprehensive JSDoc explaining AI crawler strategy
- Organized crawlers by company: OpenAI (3), Anthropic (3), Google (1), Perplexity (1), Amazon (1), Common Crawl (1)

**Total AI crawlers:** 10 (previously 7)

**Files:** `src/app/robots.ts`
**Commit:** `5bf8801`

### Task 2: llms.txt Markdown Link Improvement

**Changes:**
- Converted Important URLs from bare URLs to markdown link syntax
- Added descriptive text for each link
- Format: `[Sitemap](https://kroam.xyz/sitemap.xml): XML sitemap for all pages`

**llms.txt spec compliance verified:**
- H1 site name present
- Blockquote summary present
- H2 sections with content present
- Important URLs with markdown links present

**Files:** `src/app/llms.txt/route.ts`
**Commit:** `dc81f64`

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| 16-01-01 | Group AI crawlers by company | Improves maintainability for quarterly reviews |
| 16-01-02 | Descriptive text in llms.txt links | Better AI parser compatibility |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

```
Build: PASS (npm run build completed)
robots.ts: Contains Amazonbot, OAI-SearchBot, Claude-SearchBot
llms.txt: Uses markdown [text](url) syntax
AI crawlers: 10 user-agents with explicit allow rules
```

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `5bf8801` | feat | Add missing AI crawler user-agents to robots.ts |
| `dc81f64` | chore | Improve llms.txt Important URLs with markdown links |

## Next Phase Readiness

**Ready for 16-02:** Schema.org consolidation can proceed. AI crawlers can now access all content; schema improvements will enhance how that content is understood.

**No blockers identified.**
