# Quick Task 005: Improve Sitemap Organization

## Goal

Restructure sitemap from single monolithic file to multiple organized sitemaps with proper chunking for scalability.

## Current State

- Single `src/app/sitemap.ts` with all URLs mixed
- Hardcoded limit of 1000 matches
- `generateSitemaps()` is a stub (returns `[{ id: '0' }]`)
- No sitemap index

## Target State

```
/sitemap.xml           → Sitemap index (points to all sub-sitemaps)
/sitemap/static.xml    → Homepage, about, leaderboard, matches index
/sitemap/leagues.xml   → All league pages
/sitemap/models.xml    → All model pages
/sitemap/blog.xml      → All blog posts
/sitemap/matches/0.xml → Match pages chunk 0 (up to 50,000)
/sitemap/matches/1.xml → Match pages chunk 1 (if needed)
```

## Tasks

### Task 1: Create sitemap index route

**File:** `src/app/sitemap.xml/route.ts`

Create sitemap index that references all sub-sitemaps:
- GET handler returns XML sitemap index
- Lists all sub-sitemap URLs
- Sets proper Content-Type header

### Task 2: Create static pages sitemap

**File:** `src/app/sitemap/static.xml/route.ts`

Contains:
- Homepage (priority 1.0)
- About page
- Leaderboard index
- Matches index
- Blog index

### Task 3: Create leagues sitemap

**File:** `src/app/sitemap/leagues.xml/route.ts`

Contains:
- All active competition pages
- Query: `competitions WHERE active = true`

### Task 4: Create models sitemap

**File:** `src/app/sitemap/models.xml/route.ts`

Contains:
- All model pages
- Query: `SELECT id FROM models`

### Task 5: Create blog sitemap

**File:** `src/app/sitemap/blog.xml/route.ts`

Contains:
- All published blog posts
- Query: `blogPosts WHERE status = 'published'`

### Task 6: Create chunked matches sitemap

**File:** `src/app/sitemap/matches/[id]/route.ts`

- Dynamic route for match sitemap chunks
- Chunk size: 45,000 (buffer below 50K limit)
- No hardcoded limit - fetches ALL matches
- Proper pagination using OFFSET/LIMIT

### Task 7: Remove old sitemap.ts

Delete `src/app/sitemap.ts` after new structure is in place.

### Task 8: Update robots.txt

Ensure robots.txt points to `/sitemap.xml` (sitemap index).

## Dependencies

- Task 7 depends on Tasks 1-6
- Task 8 can run in parallel with Tasks 1-6

## Commit Strategy

Single atomic commit after all tasks complete.
