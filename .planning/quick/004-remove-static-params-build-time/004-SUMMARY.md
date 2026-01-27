# Quick Summary: Fix deployment failure - remove static params

## Completed
- Removed generateStaticParams from league page to avoid build-time database queries

## Files Changed
- `src/app/leagues/[slug]/page.tsx` - Removed static generation during build

## Expected Result
- Build should complete without requiring database access
- Pages render on-demand with ISR (60s cache)
- First request to each league page will render and cache for subsequent visitors