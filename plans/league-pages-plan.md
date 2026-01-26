# League Pages Fix & Enhancement Plan

## Problem Analysis

### Root Cause: Empty League Pages (EPL, SerieA)

**Issue**: The [`getMatchesByCompetitionSlug()`](src/lib/db/queries.ts:219) function filters by `competitions.slug`, but the URL uses the compact `id` format.

**Schema**:
- `competitions.id`: e.g., "epl", "seriea" (primary key, used in URLs)
- `competitions.slug`: e.g., "premier-league", "serie-a" (SEO-friendly, used for filtering)

**Current Query** (lines 228):
```typescript
.where(eq(competitions.slug, competitionSlug)) // Wrong! URL uses `id`, not `slug`
```

**Fix**: Change filter to use `competitions.id`:
```typescript
.where(eq(competitions.id, competitionId))
```

---

## Plan: League Pages Enhancement

### Phase 1: Critical Fix (Empty Pages)
1. Fix `getMatchesByCompetitionSlug()` to filter by `competitions.id`
2. Rename function to `getMatchesByCompetitionId()` for clarity
3. Update all callers

### Phase 2: Enhanced Page Header
Add a rich header with competition metadata:

```typescript
interface CompetitionHeaderProps {
  competition: {
    id: string;
    name: string;
    logo?: string;
    season: number;
    matchCount: number;
    nextMatchTime?: string;
  }
}
```

Components:
- Competition logo + name
- Current season indicator
- Total matches tracked
- Next scheduled match countdown

### Phase 3: Top Performing Models per Competition
Create a new query `getTopModelsByCompetition()` that returns:
- Model name and provider
- Average points in this competition
- Total predictions
- Accuracy percentage
- Rank within competition

**Query Logic**:
```typescript
export async function getTopModelsByCompetition(competitionId: string, limit: number = 5) {
  // Join predictions with matches, filter by competition
  // Group by model, calculate avg points, total predictions
  // Order by avg points DESC, limit to top N
}
```

### Phase 4: Competition Statistics
Add a statistics section showing:

**League Overview**:
- Total matches played
- Home wins / Draws / Away wins breakdown
- Average goals per match
- Most common scoreline

**Team Statistics**:
- Top scorers (most goals scored)
- Best home record (most home wins)
- Best away record (most away wins)
- Highest scoring matches

**Prediction Insights**:
- Which result do models predict most?
- Most accurate prediction type (H/D/A)
- Average points per prediction

### Phase 5: Match Predictions Summary
Add a summary section above the match list:

```typescript
interface CompetitionPredictionSummary {
  upcomingMatches: number;
  modelsConsensus: {
    mostPredictedResult: 'H' | 'D' | 'A';
    confidence: number; // percentage
    topPrediction: { homeScore: number; awayScore: number };
  };
  recentAccuracy: {
    avgPointsPerMatch: number;
    tendencyAccuracy: number;
    exactScoreAccuracy: number;
  };
}
```

---

## Implementation Tasks

### Task 1: Fix Empty League Pages
- [ ] Update `getMatchesByCompetitionSlug()` to use `competitions.id` filter
- [ ] Rename function to `getMatchesByCompetitionId()`
- [ ] Update [`league-hub-content.tsx`](src/app/leagues/[slug]/league-hub-content.tsx:43) caller
- [ ] Test: Verify EPL, SerieA, Bundesliga all show matches

### Task 2: Create Competition Header Component
- [ ] Create `src/components/competition/competition-header.tsx`
- [ ] Add competition info (name, logo, season)
- [ ] Add match count and next match countdown
- [ ] Integrate into league page

### Task 3: Add Top Models Section
- [ ] Create `getTopModelsByCompetition()` query in [`queries.ts`](src/lib/db/queries.ts)
- [ ] Create `src/components/competition/competition-top-models.tsx`
- [ ] Add to league page (new tab or inline section)
- [ ] Show model cards with stats per competition

### Task 4: Add Competition Statistics
- [ ] Create `getCompetitionStats()` query
- [ ] Create `src/components/competition/competition-stats.tsx`
- [ ] Add statistics dashboard component
- [ ] Include charts for result distribution

### Task 5: Add Prediction Summary
- [ ] Create `getCompetitionPredictionSummary()` query
- [ ] Create prediction insights component
- [ ] Show model consensus and recent performance

### Task 6: UI/UX Improvements
- [ ] Add loading states with better skeletons
- [ ] Add empty state with helpful messaging
- [ ] Add mobile-responsive layout adjustments
- [ ] Add smooth transitions between tabs

---

## File Changes Summary

### New Files
```
src/components/competition/
  ├── competition-header.tsx
  ├── competition-top-models.tsx
  ├── competition-stats.tsx
  └── competition-prediction-summary.tsx
```

### Modified Files
```
src/lib/db/queries.ts
  ├── getMatchesByCompetitionId() [renamed from getMatchesByCompetitionSlug]
  ├── getTopModelsByCompetition() [new]
  ├── getCompetitionStats() [new]
  └── getCompetitionPredictionSummary() [new]

src/app/leagues/[slug]/league-hub-content.tsx
  ├── Add CompetitionHeader component
  ├── Add Top Models section
  ├── Add Statistics section
  └── Add Prediction Summary section
```

---

## Visual Design

### League Page Layout
```
┌─────────────────────────────────────────────────────────┐
│  🏆 Premier League  |  2024-25  |  📊 127 matches     │
│  Next: Manchester City vs Liverpool (Jan 28, 20:00)     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌────────────── Top Models ───────────────┐           │
│  │  🥇 Llama 3.3 70B - 7.82 avg pts (12)   │           │
│  │  🥈 GPT-4o - 7.45 avg pts (18)          │           │
│  │  🥉 Gemini Pro - 6.91 avg pts (15)      │           │
│  └─────────────────────────────────────────┘           │
│                                                         │
│  ┌────────── Competition Stats ────────────┐           │
│  │  Home Wins: 42%  │  Draws: 28%  │  Away: 30%       │
│  │  Avg Goals: 2.74  │  BTTS: 52%                │           │
│  └─────────────────────────────────────────┘           │
│                                                         │
│  ┌────── Prediction Summary ───────┐                   │
│  │  Models favor Home (55%)        │                   │
│  │  Most common: 1-1, 2-1          │                   │
│  │  Recent accuracy: 72% tendency  │                   │
│  └─────────────────────────────────┘                   │
│                                                         │
│  [Matches]  [Standings]  [News]                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Live  │  Upcoming  │  Recent Results           │   │
│  │  [...]  [...]       [...]                       │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Dependencies

- Competition data from [`competitions.ts`](src/lib/football/competitions.ts)
- Match data from [`matches`](src/lib/db/schema.ts:16) table
- Prediction data from [`predictions`](src/lib/db/schema.ts:324) table
- Model data from [`models`](src/lib/db/schema.ts:51) table
- League standings from [`leagueStandings`](src/lib/db/schema.ts:215) table

---

## Testing Checklist

- [ ] EPL page shows matches
- [ ] SerieA page shows matches
- [ ] Bundesliga page continues to work
- [ ] UCL page shows matches
- [ ] Top models section shows correct data
- [ ] Statistics update when matches are scored
- [ ] Mobile layout works correctly
- [ ] Loading states display properly
- [ ] Empty states show helpful messages
