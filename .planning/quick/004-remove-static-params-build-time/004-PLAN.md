# Quick Plan: Fix deployment failure - remove static params to avoid build-time DB queries

## Problem
Deployment fails with RuntimeException at "Creating an optimized production build...". The `generateStaticParams` function causes Next.js to pre-render pages at build time, which requires database connections that aren't available.

## Root Cause
- `generateStaticParams` in `src/app/leagues/[slug]/page.tsx` triggers pre-rendering
- Pre-rendering calls `LeagueHubContent` which fetches from database
- Database not accessible during Docker build, causing static generation to fail

## Solution
- Remove `generateStaticParams` from league page
- Pages will render on-demand with ISR caching (60s revalidation)
- SEO and performance maintained through ISR, not build-time static generation

## Changes
- `src/app/leagues/[slug]/page.tsx`: Removed generateStaticParams function