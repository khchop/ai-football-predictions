---
phase: 04-content-pipeline
plan: "04"
type: execute
wave: 3
depends_on: ["04-03"]
files_created:
  - src/app/api/matches/[id]/roundup/route.ts
  - src/components/match/roundup-viewer.tsx
files_modified:
  - src/lib/cache/redis.ts
  - src/lib/db/queries.ts
  - src/app/leagues/[slug]/[match]/page.tsx
---

# Phase 4 Plan 4: Roundup Content Display Integration

**One-liner:** Integrated roundup content into match pages with HTML rendering and 24-hour caching

## Objective

Display generated post-match roundups on match pages with proper structure, rich formatting, and cached delivery. The roundup includes scoreboard, events timeline, statistics, model predictions, top performers, and narrative analysis.

## Summary

Successfully implemented roundup content display integration with the following deliverables:

### Completed Tasks

1. **Roundup Caching Constants** - Added 24-hour cache TTL and cache key generators for roundup content
2. **Roundup API Endpoint** - Created GET `/api/matches/{matchId}/roundup` with cache headers and 404 handling
3. **RoundupViewer Component** - Built comprehensive component with all roundup sections
4. **Match Page Integration** - Integrated RoundupViewer into slug-based match page for finished matches
5. **Roundup Query Helpers** - Added database queries for fetching roundups by ID and slug

### Key Features Delivered

- **Scoreboard Header**: Team names, final score, competition badge, venue, and kickoff time
- **Events Timeline**: Chronological list with minute badges, color-coded by event type (goals, cards, substitutions)
- **Stats Grid**: Cards for possession, shots, shots on target, corners, and xG
- **Model Predictions**: HTML table rendering with dangerouslySetInnerHTML
- **Top Performers**: Ranked list with model names, predictions, and points
- **Narrative Section**: Full HTML content rendering for match analysis
- **Keywords**: SEO keywords displayed on page
- **Caching**: 24-hour cache with Cache-Control headers and X-Cache HIT/MISS indicator

## Tech Stack Additions

- No new libraries required
- Uses existing Redis caching infrastructure
- Leverages existing Drizzle ORM patterns

## Dependencies

- **On 04-03**: matchRoundups table schema and content generation
- **On Next.js 16**: App Router API routes and Server Components

## Files Created

| File | Purpose |
|------|---------|
| `src/app/api/matches/[id]/roundup/route.ts` | API endpoint for serving roundup data with caching |
| `src/components/match/roundup-viewer.tsx` | Component for rendering all roundup sections |

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/cache/redis.ts` | Added CACHE_TTL.ROUNDUP (86400s) and cacheKeys.roundup/roundupBySlug |
| `src/lib/db/queries.ts` | Added getMatchRoundup() and getMatchRoundupBySlug() functions |
| `src/app/leagues/[slug]/[match]/page.tsx` | Integrated RoundupViewer for finished matches with roundup |

## API Details

**Endpoint:** `GET /api/matches/{matchId}/roundup`

**Response (200 OK):**
```json
{
  "id": "uuid",
  "matchId": "uuid",
  "title": "Match Roundup Title",
  "scoreboard": { "homeTeam": "...", "awayTeam": "...", "homeScore": 2, "awayScore": 1, "competition": "..." },
  "events": [{ "minute": 23, "type": "goal", "description": "Goal description" }],
  "stats": { "possession": 55, "shots": 12, "shotsOnTarget": 5, "corners": 4, "xG": 1.8 },
  "modelPredictions": "<table>...</table>",
  "topPerformers": [{ "modelName": "Model X", "prediction": "2-1", "points": 9 }],
  "narrative": "<p>Full HTML analysis...</p>",
  "keywords": ["keyword1", "keyword2"],
  "generatedAt": "2026-01-27T..."
}
```

**Headers:**
- `Cache-Control: public, max-age=86400, s-maxage=86400`
- `X-Cache: HIT` or `MISS`

**Errors:**
- `404 Not Found`: No roundup exists for match
- `500 Internal Server Error`: Database or cache error

## Component Interface

```typescript
interface RoundupViewerProps {
  title: string;
  scoreboard: Scoreboard;
  events: Event[];
  stats: Stats;
  modelPredictions: string;  // HTML table string
  topPerformers: TopPerformer[];
  narrative: string;  // HTML content
  keywords: string[];
  className?: string;
}
```

## Verification

- Build completes successfully (prerendering requires DATABASE_URL)
- All TypeScript types are correct
- API endpoint returns proper JSON structure
- Component renders all sections with Tailwind styling

## Decisions Made

1. **Cache Strategy**: 24-hour TTL for roundup content since it's static after generation
2. **Cache Key Pattern**: Used `roundup:{matchId}` and `roundup:slug:{slug}` for consistency
3. **Component Architecture**: Used dangerouslySetInnerHTML for HTML content (model predictions and narrative)
4. **Integration Point**: Added roundup section after MatchContentSection in match page
5. **Conditional Rendering**: Only displayed for finished matches with available roundup

## Deviations from Plan

**None** - Plan executed exactly as written.

## Performance Considerations

- 24-hour cache reduces database load for popular matches
- Cache-Control headers enable CDN and browser caching
- Server-side rendering of RoundupViewer prevents client-side layout shift
- No client-side JavaScript required for roundup display

## Next Steps

- Add on-demand revalidation when roundup is generated (future enhancement)
- Consider lazy loading roundup section for better initial page load (future enhancement)
- Add roundup generation trigger when match is scored (integration with scoring worker)

---

**Completed:** 2026-01-27  
**Duration:** ~15 minutes  
**Tasks:** 5/5 completed
