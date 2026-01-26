# SEO/GEO Implementation Plan

**Project**: SEO & Generative Engine Optimization (GEO) for kroam.xyz
**Generated**: 2026-01-25T14:30:00Z
**Focus**: Search Rankings + AI Citation Across All Content

## Technical Context & Standards

**Detected Stack & Patterns:**
- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Drizzle ORM + PostgreSQL
- **Rendering**: Server Components (force-dynamic where needed)
- **API**: Server Actions + Route Handlers
- **Content Generation**: Together AI (blog posts, match analysis)
- **Conventions**: 
  - Metadata via `generateMetadata()` functions
  - Schema.org via `<script type="application/ld+json">`
  - Dynamic rendering for real-time data
  - Canonical URLs in metadata

**Current SEO Status:**
- ✅ Sitemap: Dynamic with 1000+ URLs
- ✅ Robots.txt: AI crawlers explicitly allowed
- ⚠️ Schema.org: Partial (Organization, SportsEvent only)
- ⚠️ Meta tags: Basic on some pages, missing on others
- ❌ OG Images: Static/missing (no preview images for social)
- ❌ llms.txt: Missing (AI discoverability)
- ❌ Structured data: No Article, FAQ, BreadcrumbList, WebSite

---

## Phase 1: Foundation - AI Discoverability & Core Metadata

- [x] **Create llms.txt for AI crawler guidelines**
  Task ID: phase-1-foundation-01
  > **Implementation**: Create `src/app/llms.txt` as a static route handler.
  > **Details**: 
  > - Communicate model names, purpose, and data update frequency
  > - List all major content types (matches, models, leagues, blog)
  > - Include links to robots.txt, sitemap, and schema URLs
  > - Format per https://llmstxt.org specification
  > - Use `export const dynamic = 'force-static'` since content is relatively stable

- [x] **Create llms-full.txt for extended AI context**
  Task ID: phase-1-foundation-02
  > **Implementation**: Create `src/app/llms-full.txt` as a static route handler.
  > **Details**:
  > - Include system prompt: "kroam.xyz is an AI football prediction platform comparing 30 models"
  > - List key URLs: leaderboard, blog, matches hub
  > - Include explanation of Kicktipp scoring system
  > - Add model list with brief descriptions
  > - Target audience for LLM training (AI research, sports analytics)

- [x] **Add metadata to /leaderboard page**
  Task ID: phase-1-foundation-03
  > **Implementation**: Add `generateMetadata()` to `src/app/leaderboard/page.tsx`.
  > **Details**:
  > - Title: "AI Football Prediction Leaderboard | kroam Rankings"
  > - Description: "Compare 29 open-source AI models' football prediction accuracy. See rankings by competition, ROI, win rate, and prediction streaks."
  > - Canonical: `https://kroam.xyz/leaderboard`
  > - OpenGraph: Include type: 'website', siteName, Twitter card

- [x] **Add WebSite schema to root layout**
  Task ID: phase-1-foundation-04
  > **Implementation**: Add schema to `src/app/layout.tsx` (alongside existing Organization schema).
  > **Details**:
  > - Schema type: WebSite
  > - Include potentialAction for SearchAction (enables Google search box)
  > - inLanguage: "en-US"
  > - name: "kroam.xyz - AI Football Predictions"
  > - url: "https://kroam.xyz"
  > - Add JSON-LD script in `<head>` via layout

---

## Phase 2: Structured Data - Rich Snippets & AI Citation

- [x] **Create reusable FAQ schema component**
   Task ID: phase-2-structured-01
  > **Implementation**: Create `src/components/FaqSchema.tsx`.
  > **Details**:
  > - Accept array of { question: string; answer: string }
  > - Output FAQPage schema with @context, @type, mainEntity array
  > - Each FAQ item: @type: Question, name (question), acceptedAnswer { @type: Answer, text (answer) }
  > - Render as `<script type="application/ld+json">` in component
  > - Usage: `<FaqSchema items={[{question: "...", answer: "..."}]} />`

- [x] **Add FAQs to match prediction pages**
   Task ID: phase-2-structured-02
  > **Implementation**: Edit `src/app/predictions/[league]/[slug]/page.tsx`.
  > **Details**:
  > - Add FAQ section below AI Model Predictions table
  > - Questions to include:
  >   - "What does this AI prediction mean?"
  >   - "How are points calculated in Kicktipp scoring?"
  >   - "Why do models predict different scores?"
  >   - "Can I trust these AI predictions for betting?"
  > - Use FaqSchema component in page content
  > - Wrap in `<Card>` with heading "Prediction Insights"

- [x] **Add Article schema to blog posts**
   Task ID: phase-2-structured-03
  > **Implementation**: Create `src/components/ArticleSchema.tsx` and use in `src/app/blog/[slug]/page.tsx`.
  > **Details**:
  > - Schema type: NewsArticle or BlogPosting (use BlogPosting for analysis)
  > - Required fields: headline (post.title), description (post.excerpt), datePublished, author, image
  > - For author: use { @type: "Person", name: "kroam.xyz AI" } or post.generatedBy if available
  > - Include wordCount (estimate from post.content.split(' ').length)
  > - inLanguage: "en-US"
  > - Add schema to blog page head

- [x] **Add BreadcrumbList schema to pages**
   Task ID: phase-2-structured-04
  > **Implementation**: Create `src/components/BreadcrumbSchema.tsx`.
  > **Details**:
  > - Accept breadcrumbs: array of { name: string; url: string }
  > - Output BreadcrumbList with itemListElement array
  > - Use on: match prediction page, league page, blog post page, model page
  > - Example for `/predictions/epl/man-city-vs-arsenal`:
  >   - Home → Predictions → Premier League → Man City vs Arsenal
  > - Position field auto-increment based on array index

- [x] **Fix SportsEvent schema in match pages**
   Task ID: phase-2-structured-05
  > **Implementation**: Fix `src/components/SportsEventSchema.tsx`.
  > **Details**:
  > - Replace incorrect eventStatus values (currently has 'EventPostponed' and 'EventScheduled' mixed)
  > - Use correct schema.org values:
  >   - Scheduled: "https://schema.org/EventScheduled"
  >   - Live: "https://schema.org/EventInProgress"
  >   - Finished: "https://schema.org/EventCompleted"
  > - Add awaitingResult field if match.status === 'live'
  > - If match.homeScore and match.awayScore exist: add competition field with @type: "SportsCompetition"

---

## Phase 3: Dynamic OG Images - Social & AI Sharing

- [x] **Create OG image generation route for matches**
   Task ID: phase-3-og-images-01
   > **Implementation**: Create `src/app/api/og/match/route.ts`.
   > **Status**: ✅ COMPLETE - File exists at `src/app/api/og/match/route.tsx` with ImageResponse
   > **Details**:
   > - Uses next/og ImageResponse for 1200x630px PNG generation
   > - Accepts: `homeTeam`, `awayTeam`, `competition` params
   > - Gradient background (purple to indigo), displays team names with "vs", competition badge
   > - "AI Predictions" branding badge at bottom
   > - Runtime: edge (optimized)

- [x] **Create OG image generation route for models**
   Task ID: phase-3-og-images-02
   > **Implementation**: Create `src/app/api/og/model/route.ts`.
   > **Status**: ✅ COMPLETE - File exists at `src/app/api/og/model/route.tsx`
   > **Details**:
   > - Accepts: `modelName`, `accuracy`, `rank` params
   > - Displays model name with rank badge and accuracy stats
   > - Purple gradient background matching site theme
   > - kroam.xyz branding

- [x] **Create OG image generation route for leagues**
   Task ID: phase-3-og-images-03
   > **Implementation**: Create `src/app/api/og/league/route.ts`.
   > **Status**: ✅ COMPLETE - File exists at `src/app/api/og/league/route.tsx`
   > **Details**:
   > - Accepts: `leagueName`, `matchCount`, `upcomingCount` params
   > - Trophy icon + league name + match statistics
   > - Gradient background, edge runtime

- [x] **Update match prediction page to use dynamic OG image**
   Task ID: phase-3-og-images-04
   > **Implementation**: Edit `src/app/predictions/[league]/[slug]/page.tsx` generateMetadata().
   > **Status**: ✅ COMPLETE - Lines 59-83 implement OG image
   > **Details**:
   > - Creates ogImageUrl from `/api/og/match` with searchParams
   > - Passes: homeTeam, awayTeam, competition name
   > - Included in openGraph.images array with 1200x630 dimensions
   > - Twitter card also uses OG image

- [x] **Update model page to use dynamic OG image**
   Task ID: phase-3-og-images-05
   > **Implementation**: Edit `src/app/models/[id]/page.tsx` generateMetadata().
   > **Status**: ✅ COMPLETE - Uses /api/og/model in metadata
   > **Details**:
   > - Builds ogImageUrl with modelName, accuracy, rank params
   > - Included in openGraph.images array

- [x] **Update league hub page to use dynamic OG image**
   Task ID: phase-3-og-images-06
   > **Implementation**: Edit `src/app/predictions/[league]/page.tsx` generateMetadata().
   > **Status**: ✅ COMPLETE - Uses /api/og/league in metadata
   > **Details**:
   > - Fetches match counts and creates ogImageUrl with leagueName, matchCount, upcomingCount
   > - Included in openGraph.images array

- [x] **Update blog posts to use dynamic OG image**
   Task ID: phase-3-og-images-07
   > **Implementation**: Edit `src/app/blog/[slug]/page.tsx` generateMetadata().
   > **Status**: ✅ COMPLETE - Content-type detection implemented
   > **Details**:
   > - Detects post.contentType ('model_report' or 'league_roundup')
   > - Uses /api/og/model for model reports
   > - Uses /api/og/league for league roundups
   > - Falls back to generic OG image for other content types

---

## Phase 4: Content Optimization - GEO-Focused Citeable Content

- [x] **Add "AI Analysis" citable content section to match pages**
   Task ID: phase-4-content-01
   > **Implementation**: Edit `src/app/predictions/[league]/[slug]/page.tsx`.
   > **Status**: ✅ COMPLETE - PredictionInsightsBlockquote component exists
   > **Details**:
   > - Component: `src/components/match/PredictionInsightsBlockquote.tsx`
   > - Provides AI analysis with citable blockquote styling
   > - Shows predicted scores, model confidence, win probabilities
   > - Displays top-performing models for the match
   > - Includes attribution: "AI-generated from model predictions"

- [x] **Add model comparison FAQ to leaderboard page**
   Task ID: phase-4-content-02
   > **Implementation**: Edit `src/app/leaderboard/page.tsx`.
   > **Status**: ✅ COMPLETE - FAQs implemented with FaqSchema
   > **Details**:
   > - Section: "Understanding Model Rankings" at lines 186-202
   > - Static FAQ array: `leaderboardFaqs` (lines 15-36)
   > - Questions cover:
   >   - "What determines AI model ranking?"
   >   - "How is prediction accuracy calculated?"
   >   - "What are the best performing models?"
   >   - "Can I filter leaderboard by competition or time period?"
   >   - "What does 'Correct Tendencies' mean?"
   > - FaqSchema component renders JSON-LD for search engines

- [x] **Enhance homepage with citeable stats**
   Task ID: phase-4-content-03
   > **Implementation**: Edit `src/app/page.tsx` in the "StatsBar" section.
   > **Status**: ✅ COMPLETE - FeaturedInsights component implemented
   > **Details**:
   > - Component: `FeaturedInsights()` function at lines 219-246
   > - Fetches `getTopPerformingModel()` for dynamic top model display
   > - Shows: "Top performing model: [modelName]"
   > - Shows: "Average score: [avgPoints] points per prediction"
   > - Attribution: "Powered by AI prediction analysis"
   > - Responsive design with gradient styling

---

## Phase 5: Technical SEO Polish - Complete Coverage

- [x] **Add hreflang tags for future i18n support**
   Task ID: phase-5-polish-01
   > **Implementation**: Edit `src/app/layout.tsx` metadata generation.
   > **Details**:
   > - Add alternates.languages for future expansion:
   >   ```
   >   alternates: {
   >     languages: {
   >       'en-US': 'https://kroam.xyz',
   >       'de': 'https://de.kroam.xyz',
   >       'es': 'https://es.kroam.xyz',
   >     }
   >   }
   >   ```
   > - Or use canonical + hreflang approach if preferred
   > - This signals to Google we're prepared for i18n
   > **Status**: COMPLETE - Added to layout.tsx with 5 language variants

- [x] **Add JSON-LD WebPage schema to all dynamic pages**
   Task ID: phase-5-polish-02
   > **Implementation**: Create `src/components/WebPageSchema.tsx`.
   > **Details**:
   > - Schema type: WebPage
   > - Fields: @context, @type, name (page title), description, url, datePublished, mainEntity
   > - Use on every page via layout or per-page
   > - Helps Google understand page purpose
   > - Particularly important for prediction pages and blog
   > **Status**: COMPLETE - Added to models, blog, predictions [league] and [slug] pages

- [x] **Add image alt text optimization pass**
   Task ID: phase-5-polish-03
   > **Implementation**: Audit and fix `<Image>` alt attributes across codebase.
   > **Details**:
   > - Search: `<Image.*alt=` in all .tsx files
   > - Current issue: `alt={match.homeTeam}` is minimal
   > - Improve to: `alt="${match.homeTeam} team logo"`
   > - For prediction tables: `alt="AI prediction accuracy icon"`
   > - This helps with image indexing for GEO
   > **Status**: COMPLETE - Already implemented in Phase 6, all team logos have descriptive alt text

- [x] **Add structured URL parameters for tracking**
   Task ID: phase-5-polish-04
   > **Implementation**: Add utm_source and utm_medium handling (optional).
   > **Details**:
   > - Consider: `?utm_source=gpt-bot&utm_medium=ai-citation` for API routes
   > - This helps track AI citation vs regular traffic
   > - Not required but useful for analytics
   > - Focus on other tasks first
   > **Status**: SKIPPED - Optional nice-to-have, lower priority than other improvements

---

## Implementation Notes

### Architecture & Dependencies
- **Image Generation**: Will need `node-canvas` or similar. Alternatively, use sharp + SVG-to-PNG if canvas unavailable. Check current `package.json` for compatible image library.
- **Server Components**: All OG image routes should be `force-dynamic` since they use query params
- **Caching**: Use Next.js response caching headers to avoid regenerating images too frequently
- **Revalidation**: sitemap.ts already has `revalidate = 3600` (1 hour) - OG images should match or be longer

### Testing Checklist
After each phase:
1. **Local Testing**: `npm run dev` and check routes locally
2. **Build Test**: `npm run build` to catch any SSR issues
3. **Manual Verification**: 
   - Check robots.txt at `/robots.txt`
   - Validate Schema.org at https://validator.schema.org/
   - Test OG images via https://og.og/
   - Check on mobile preview (Facebook, Twitter, LinkedIn)
4. **Sitemap Check**: Verify all new pages in `/sitemap.xml`

### Rollout Strategy
- **Phase 1 (Foundation)**: Launch first - low risk, high visibility to AI crawlers
- **Phase 2 (Structured Data)**: Deploy together - improves rich snippets
- **Phase 3 (OG Images)**: Medium effort, high impact for social sharing + AI context
- **Phase 4 (Content)**: Can be done progressively
- **Phase 5 (Polish)**: Final pass before promotion

### Monitoring
- **Google Search Console**: Monitor index coverage, rich results
- **Lighthouse**: Check Core Web Vitals aren't impacted by OG image routes
- **AI Citation Tracking**: Monitor traffic from GPTBot, Perplexity, ClaudeBot via logs
- **Social Metrics**: Monitor shares, engagement on social platforms

---

## Phase 6: Advanced SEO - Coverage Gaps & Voice Search

- [x] **Add metadata to About page**
  Task ID: phase-6-coverage-01
  > **Implementation**: Edit `src/app/about/page.tsx`.
  > **Details**: Add `generateMetadata()` with title, description, canonical, and OpenGraph

- [x] **Add metadata to Blog index page**
  Task ID: phase-6-coverage-02
  > **Implementation**: Edit `src/app/blog/page.tsx`.
  > **Details**: Add metadata for blog listing page

- [x] **Add metadata to Matches hub page**
  Task ID: phase-6-coverage-03
  > **Implementation**: Edit `src/app/matches/page.tsx`.
  > **Details**: Add metadata for matches listing page

- [x] **Enhance image alt text across components**
  Task ID: phase-6-coverage-04
  > **Implementation**: Edit multiple files with Image components.
  > **Details**: Improve alt text from team names to descriptive text

- [x] **Add SoftwareApplication schema to layout**
  Task ID: phase-6-coverage-05
  > **Implementation**: Edit `src/app/layout.tsx`.
  > **Details**: Add JSON-LD SoftwareApplication schema

- [x] **Add speakable schema to blog articles**
  Task ID: phase-6-coverage-06
  > **Implementation**: Edit `src/components/ArticleSchema.tsx`.
  > **Details**: Add speakable property for voice search

- [x] **Add blog posts to sitemap**
  Task ID: phase-6-coverage-07
  > **Implementation**: Edit `src/app/sitemap.ts`.
  > **Details**: Include published blog posts in sitemap

- [x] **Create WebPageSchema component**
  Task ID: phase-6-coverage-08
  > **Implementation**: Create `src/components/WebPageSchema.tsx`.
  > **Details**: Reusable WebPage schema component

- [x] **Make llms.txt dynamic with live stats**
  Task ID: phase-6-coverage-09
  > **Implementation**: Edit `src/app/llms.txt/route.ts`.
  > **Details**: Add dynamic model count and performance stats

- [x] **Add internal linking to match pages**
  Task ID: phase-6-coverage-10
  > **Implementation**: Edit `src/app/predictions/[league]/[slug]/page.tsx`.
  > **Details**: Add "Related Predictions" and "Popular Models" sections

---

## Success Metrics

After implementation, track:
1. **Google Search Rankings**: Monitor keyword positions (e.g., "AI football predictions", "{league name} predictions")
2. **Organic Traffic**: Compare month-over-month traffic from search engines
3. **AI Citation**: Monitor referral traffic from LLM outputs (Perplexity, ChatGPT, Claude)
4. **Rich Results**: Check Google Search Console for FAQ, Article, Event rich snippets
5. **Social Sharing**: Monitor OpenGraph image displays on social platforms
6. **Crawl Efficiency**: Monitor Google Bot crawl stats in GSC

---

*Generated by Clavix `/clavix-plan` | Project: seo-geo-improvements*
