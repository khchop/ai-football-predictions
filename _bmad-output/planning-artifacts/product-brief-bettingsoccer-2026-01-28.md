---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - README.md
  - AGENTS.md
  - plans/league-pages-plan.md
  - LEADERBOARD_INVESTIGATION.md
date: 2026-01-28
author: Pieter
---

# Product Brief: bettingsoccer

<!-- Content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

BettingSoccer is a Next.js web app for football match predictions that compares outputs from multiple LLM models. The immediate product priority is restoring reliability: key user journeys like Match Details and the Leaderboard are currently broken (errors / empty states), causing visitors to drop off. Success in the near term is a fully functional, error-free experience across the core pages; success longer term is delivering richer prediction insights and clear multi-LLM comparison so users can understand which models perform best and why.

---

## Core Vision

### Problem Statement

Visitors cannot reliably use BettingSoccer today because core pages (notably Match Details and Leaderboard) fail to load correctly (errors and empty results). This undermines trust and prevents users from getting the value the app is intended to provide.

### Problem Impact

- Visitors encounter failures and likely abandon the site quickly.
- The product's credibility suffers because predictions and rankings aren't accessible.
- It blocks progress on higher-value features (insight depth, model comparison) because the foundation isn't stable.

### Why Existing Solutions Fall Short

- Many alternatives focus on single-source predictions or generic tips rather than transparent, side-by-side multi-model evaluation.
- Even if competitors provide "working pages," they may not offer deep insight into model performance and why predictions differ (an area BettingSoccer can own once stable).

### Proposed Solution

Stabilize and harden the core experience by prioritizing an "error budget" phase:

- Restore end-to-end functionality for the primary user journeys: Match Details and Leaderboard (and any critical dependencies they require).
- Establish a reliability baseline (no runtime errors on core routes, correct non-empty data where expected, and clear empty/error states when data is unavailable).
- Then iterate on enhanced prediction insights on top of a stable scoring + data pipeline.

### Key Differentiators

- Multi-LLM comparison: the ability to compare predictions and performance across many models in a consistent scoring system.
- Better prediction insights: richer match-level and aggregate analysis that helps users understand confidence, consensus, and model strengths/weaknesses.

## Target Users

### Primary Users

**Casual Football Fan / LLM-Curious Visitor**

- **Core goal:** Compare model performance (leaderboard) and sanity-check whether LLMs can reliably predict football outcomes.
- **Context:** Not yet a mature audience; early-stage product with few/no real external visitors today.
- **Problem experience:** When Match Details errors or the Leaderboard is empty, the visitor cannot evaluate models and loses trust immediately.
- **Success looks like:** Leaderboard and match pages load consistently and show enough data to form an opinion about model reliability.
- **“This is exactly what I needed” moment:** “I can quickly see which models perform best and whether open-source LLMs are actually competitive.”

### Secondary Users

**Project Admin / Operator (You)**

- **Core goal:** Monitor the system (cron jobs, queues, scoring, content generation) and spot failures early.
- **Problem experience:** Silent failures create broken public pages (empty leaderboard, match pages erroring) without a clear operational signal.
- **Success looks like:** A simple admin panel that highlights errors, failed jobs, and missing/generated content so issues can be fixed quickly.

### User Journey

**Visitor journey (model comparison-first):**

1. Discovery: Direct link/bookmark initially (later likely SEO).
2. Landing: Open Leaderboard to compare model performance.
3. Drill-down: Open Match Details to inspect individual predictions and outcomes.
4. Success moment: Trust signal achieved (stable pages + meaningful stats) → visitor can decide if LLM prediction is “real” or noise.

**Admin journey (operations-first):**

1. Check admin panel regularly.
2. See health signals: cron success, queues, scoring status, recent errors.
3. Take action: rerun jobs / inspect failures / fix broken data pipelines.

## Success Metrics

Success for users means the site is reliably usable for the core journeys (compare models, drill into matches) with correct, non-stale data.

### User Success Metrics (Stability + Trust)

- **Route reliability (must-work set):** Home, Matches, Match Details, Leagues, Leaderboard, Blog, Admin
  - Definition of "working": no server errors, no client runtime errors, and data is present + consistent when the database contains it (no "empty leaderboard" due to pipeline issues).
- **Synthetic journey pass rate (automated):**
  - Home loads
  - Matches list loads and shows rows
  - Match details loads and shows predictions + score (when available)
  - Leaderboard loads and shows rows (when scored predictions exist)
  - Leagues load and show matches
  - Blog loads and shows posts
  - Admin loads and shows system status
- **Performance baseline (usability):**
  - P95 page load time for key routes stays within an agreed threshold (optimize after correctness).
- **Data trust signals:**
  - Leaderboard never empty when scored predictions exist.
  - Match pages never error; when data is missing, show a clear "not generated yet" state instead of failing.

### Business Objectives

- **Stability phase complete in ~2 weeks:** core routes stable, errors eliminated, and data pipelines verifiably producing expected outputs.
- **Foundation for differentiation:** once stable, prioritize better prediction insights and multi-LLM comparison as the main reason to care.
- **Operational confidence:** failures become visible quickly through admin/monitoring so regressions do not linger.

### Key Performance Indicators

- **Availability / error rate:** 5xx rate per must-work route stays below 1% (goal: ~0%) over a rolling 7 days.
- **Frontend reliability:** uncaught client errors trend to near-zero (tracked via Sentry/logging).
- **Data freshness / staleness:**
  - "Stale data" incidents detected and surfaced in admin (e.g., matches missing predictions/results beyond expected window).
  - "Empty leaderboard with scored predictions present": 0 incidents per week.
- **Worker health (ops KPIs):**
  - Failed jobs count and retry backlog visible in admin; target: zero stuck failed jobs beyond an agreed window.
  - Time-to-detect a failed pipeline: minutes (not days), via admin indicators/alerts.
- **Admin usability:**
  - Admin panel provides at-a-glance visibility into: failed worker runs, stale/missing data, and failed jobs/retries.

## MVP Scope

### Core Features

**MVP Theme: Stability + Correctness**

- All core pages load without errors and display correct, validated data (KPIs match backend/source-of-truth calculations).

**Core pages (must work):**

- **Home:** Shows core site data (e.g., upcoming/recent matches and/or top models) without errors.
- **Matches:** Match list loads and shows correct match data; includes existing Kicktipp-style quota/points for Home/Draw/Away where applicable.
- **Match Details:**
  - Shows final score (or live score when in progress)
  - Shows per-model prediction
  - Shows the three analysis sections: pre-match analysis, model prediction, post-match analysis
  - Shows odds
  - Explicitly NOT required in MVP: Head-to-Head section, League table section
- **Leagues:** League pages load and correctly filter/show matches for the league (no empty pages due to filtering issues).
- **Leaderboard:**
  - Loads reliably and is non-empty when scored predictions exist
  - Primary KPI is avg points per game (must be validated and correct)
  - Supports filtering (e.g., by competition/league and other key dimensions)
- **Blog:** Blog loads and renders correctly.
- **Admin:** Admin panel loads and provides operational visibility and actions:
  - Failed jobs
  - Stale data
  - Missing data
  - Last-run timestamps / last activity
  - Manual retry actions

### Out of Scope for MVP

- New "better prediction insights" features beyond restoring correctness and stability (keep enhancements for post-MVP).
- Match Details extras such as Head-to-Head and League table.

### MVP Success Criteria

- All must-work pages (Home, Matches, Match Details, Leagues, Leaderboard, Blog, Admin) load without errors.
- Core KPIs are validated: leaderboard avg points per game and related stats match backend calculations.
- Admin surfaces failures (failed jobs, stale/missing data) and supports manual retries so problems do not linger.

### Future Vision

- Richer prediction insights (deeper stats/visualizations beyond baseline correctness).
- Alerts for users (e.g., interesting matches, model consensus shifts).
- Admin alerting when something fails (proactive detection and notification).
