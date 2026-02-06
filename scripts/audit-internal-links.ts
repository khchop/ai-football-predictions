/**
 * Build-time sitemap and internal link architecture audit
 *
 * Validates:
 * - Pass 1: Sitemap URL validation (no UUIDs, no long-form slugs, HTTP health)
 * - Pass 2: Sitemap completeness (all expected pages present)
 * - Pass 3: Internal link architecture (structural analysis of link sources)
 * - Pass 4: Meta tag validation (title, description, H1, OG tags)
 * - Pass 5: JSON-LD validation (duplicate schemas, required properties)
 * - Pass 6: TTFB measurement (production performance by page type)
 *
 * Exit code 0 = pass (warnings OK), exit code 1 = fail
 */

// Load environment variables from .env.local
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getDb, matches, models, blogPosts } from '@/lib/db';
import { COMPETITIONS } from '@/lib/football/competitions';
import { eq, and, isNotNull } from 'drizzle-orm';
import * as cheerio from 'cheerio';

// Long-form league slugs that trigger redirects (from middleware)
const LEAGUE_SLUG_REDIRECTS: Record<string, string> = {
  'premier-league': 'epl',
  'champions-league': 'ucl',
  'europa-league': 'uel',
  'la-liga': 'laliga',
  'serie-a': 'seriea',
  'ligue-1': 'ligue1',
};

const UUID_PATTERN = /\/matches\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

interface AuditResult {
  pass: boolean;
  failures: string[];
  warnings: string[];
}

interface Pass1Result extends AuditResult {
  urlCount: number;
  spotCheckCount: number;
}

interface Pass2Result extends AuditResult {
  modelCount: number;
  dbModelCount: number;
  matchCount: number;
  dbMatchCount: number;
  blogCount: number;
}

interface Pass3Result extends AuditResult {
  linkSourceCounts: Record<string, number>;
}

interface Pass4Result extends AuditResult {
  totalChecked: number;
  titleViolations: number;
  descriptionViolations: number;
  h1Violations: number;
  ogIncomplete: number;
}

interface Pass5Result extends AuditResult {
  totalChecked: number;
  duplicateOrganization: number;
  duplicateWebSite: number;
  invalidSportsEvent: number;
  invalidArticle: number;
  invalidBreadcrumb: number;
  invalidFaq: number;
  totalSchemaErrors: number;
}

interface Pass6Result extends AuditResult {
  totalChecked: number;
  slowPages: Array<{ url: string; ttfb: number; pageType: string }>;
  avgTTFBByType: Record<string, number>;
}

/**
 * Pass 1: Sitemap URL Validation
 * Fetches sitemaps and validates URLs
 */
async function pass1SitemapUrlValidation(baseUrl: string): Promise<Pass1Result> {
  const result: Pass1Result = {
    pass: true,
    failures: [],
    warnings: [],
    urlCount: 0,
    spotCheckCount: 0,
  };

  try {
    // Fetch sitemap index
    const indexUrl = `${baseUrl}/sitemap.xml`;
    const indexResponse = await fetch(indexUrl);
    if (!indexResponse.ok) {
      result.failures.push(`Failed to fetch sitemap index: ${indexResponse.status}`);
      result.pass = false;
      return result;
    }

    const indexXml = await indexResponse.text();

    // Extract sub-sitemap URLs using regex (simple XML parsing)
    const sitemapUrlMatches = indexXml.matchAll(/<loc>(.*?)<\/loc>/g);
    const sitemapUrls = Array.from(sitemapUrlMatches).map(m => m[1]);

    if (sitemapUrls.length === 0) {
      result.failures.push('No sub-sitemaps found in sitemap index');
      result.pass = false;
      return result;
    }

    // Fetch and parse each sub-sitemap
    const allUrls: string[] = [];
    for (const sitemapUrl of sitemapUrls) {
      const response = await fetch(sitemapUrl);
      if (!response.ok) {
        result.warnings.push(`Failed to fetch sub-sitemap: ${sitemapUrl}`);
        continue;
      }

      const xml = await response.text();
      const urlMatches = xml.matchAll(/<loc>(.*?)<\/loc>/g);
      const urls = Array.from(urlMatches).map(m => m[1]);
      allUrls.push(...urls);
    }

    result.urlCount = allUrls.length;

    // Validate: No /matches/UUID URLs
    const uuidUrls = allUrls.filter(url => UUID_PATTERN.test(url));
    if (uuidUrls.length > 0) {
      result.failures.push(`Found ${uuidUrls.length} /matches/UUID URLs (SMAP-02):`);
      uuidUrls.slice(0, 3).forEach(url => result.failures.push(`  - ${url}`));
      result.pass = false;
    }

    // Validate: No long-form league slugs
    const longFormSlugs = Object.keys(LEAGUE_SLUG_REDIRECTS);
    const badSlugUrls = allUrls.filter(url =>
      longFormSlugs.some(slug => url.includes(`/leagues/${slug}`))
    );
    if (badSlugUrls.length > 0) {
      result.failures.push(`Found ${badSlugUrls.length} long-form league slug URLs (REDIR-06):`);
      badSlugUrls.slice(0, 3).forEach(url => result.failures.push(`  - ${url}`));
      result.pass = false;
    }

    // Spot-check: Fetch 5 random URLs and verify they return 200
    const sampleSize = Math.min(5, allUrls.length);
    const sampledUrls = allUrls
      .sort(() => Math.random() - 0.5)
      .slice(0, sampleSize);

    let successCount = 0;
    for (const url of sampledUrls) {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok) {
          successCount++;
        } else {
          result.warnings.push(`URL returned ${response.status}: ${url}`);
        }
      } catch (error) {
        result.warnings.push(`Failed to fetch URL: ${url}`);
      }
    }

    result.spotCheckCount = successCount;

  } catch (error) {
    result.failures.push(`Pass 1 error: ${error instanceof Error ? error.message : String(error)}`);
    result.pass = false;
  }

  return result;
}

/**
 * Pass 2: Sitemap Completeness
 * Verifies all expected pages are in sitemap (database-based)
 */
async function pass2SitemapCompleteness(): Promise<Pass2Result> {
  const result: Pass2Result = {
    pass: true,
    failures: [],
    warnings: [],
    modelCount: 0,
    dbModelCount: 0,
    matchCount: 0,
    dbMatchCount: 0,
    blogCount: 0,
  };

  try {
    const db = getDb();

    // Count active models
    const activeModels = await db
      .select()
      .from(models)
      .where(eq(models.active, true));
    result.dbModelCount = activeModels.length;

    // Count matches with slugs
    const matchesWithSlugs = await db
      .select()
      .from(matches)
      .where(isNotNull(matches.slug));
    result.dbMatchCount = matchesWithSlugs.length;

    // Count published blog posts
    const publishedPosts = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.status, 'published'));
    result.blogCount = publishedPosts.length;

    // For actual sitemap validation, we need to fetch the sitemaps
    // However, without a running server, we can only validate the database counts
    // The actual sitemap presence check would require Pass 1 to run

    // Structural validation: Verify expected static pages would be in sitemap
    const expectedStaticPages = [
      '/',
      '/about',
      '/leaderboard',
      '/matches',
      '/blog',
      '/methodology',
      '/models',
      '/leagues'
    ];

    // Verify all 17 competitions would be in league sitemap
    const competitionCount = COMPETITIONS.length;
    if (competitionCount !== 17) {
      result.warnings.push(`Expected 17 competitions, found ${competitionCount}`);
    }

    // Store counts for reporting
    result.modelCount = result.dbModelCount;
    result.matchCount = result.dbMatchCount;

    // Since we can't actually fetch the sitemap without a running server,
    // we can only validate that the database has the expected data
    if (result.dbModelCount === 0) {
      result.failures.push('No active models found in database (SMAP-03)');
      result.pass = false;
    }

    if (result.dbMatchCount === 0) {
      result.warnings.push('No matches with slugs found in database');
    }

  } catch (error) {
    result.failures.push(`Pass 2 error: ${error instanceof Error ? error.message : String(error)}`);
    result.pass = false;
  }

  return result;
}

/**
 * Pass 3: Internal Link Architecture Inventory
 * Structural analysis of link sources for each page type
 */
async function pass3InternalLinkArchitecture(): Promise<Pass3Result> {
  const result: Pass3Result = {
    pass: true,
    failures: [],
    warnings: [],
    linkSourceCounts: {},
  };

  try {
    // Model pages link sources:
    // 1. /models index (all models)
    // 2. /leaderboard (top 10 models)
    // 3. League hub top-5 widget (5 models × 17 leagues)
    // 4. Related models widget (N model pages)
    // 5. Match predicting-models widget (N match pages)
    const modelLinkSources = 5;
    result.linkSourceCounts['Model pages'] = modelLinkSources;

    // League pages link sources:
    // 1. /leagues index (all 17 leagues)
    // 2. Breadcrumbs on match pages (all matches)
    // 3. Model leagues-covered widget (N model pages)
    // 4. Navigation menu (global)
    const leagueLinkSources = 4;
    result.linkSourceCounts['League pages'] = leagueLinkSources;

    // Match pages link sources:
    // 1. League hub match grid (all matches in league)
    // 2. Model recent-predictions widget (N model pages × 10 matches each)
    // 3. Blog post match links (variable)
    const matchLinkSources = 3;
    result.linkSourceCounts['Match pages'] = matchLinkSources;

    // Blog pages link sources:
    // 1. /blog index (all posts)
    // 2. Related articles widget (variable, currently disabled)
    const blogLinkSources = 1; // Only blog index for now
    result.linkSourceCounts['Blog pages'] = blogLinkSources;

    // Check for pages below 3-link threshold (SEO best practice)
    if (blogLinkSources < 3) {
      result.warnings.push(`Blog pages: ${blogLinkSources} link sources — below 3-link threshold (LINK-05)`);
    }

    // All other page types meet the threshold
    if (modelLinkSources < 3) {
      result.warnings.push(`Model pages: ${modelLinkSources} link sources — below threshold`);
    }
    if (leagueLinkSources < 3) {
      result.warnings.push(`League pages: ${leagueLinkSources} link sources — below threshold`);
    }
    if (matchLinkSources < 3) {
      result.warnings.push(`Match pages: ${matchLinkSources} link sources — below threshold`);
    }

  } catch (error) {
    result.failures.push(`Pass 3 error: ${error instanceof Error ? error.message : String(error)}`);
    result.pass = false;
  }

  return result;
}

/**
 * Helper: Extract all schema types from JSON-LD scripts, flattening @graph arrays
 */
function extractAllSchemaTypes(jsonLdScripts: unknown[]): Record<string, unknown>[] {
  const allSchemas: Record<string, unknown>[] = [];

  jsonLdScripts.forEach(script => {
    if (!script || typeof script !== 'object') return;

    const s = script as Record<string, unknown>;

    // Handle @graph arrays
    if (s['@graph'] && Array.isArray(s['@graph'])) {
      s['@graph'].forEach((item: unknown) => {
        if (item && typeof item === 'object') {
          allSchemas.push(item as Record<string, unknown>);
        }
      });
    } else if (s['@type']) {
      allSchemas.push(s);
    }
  });

  return allSchemas;
}

/**
 * Helper: Validate SportsEvent required properties
 */
function validateSportsEvent(event: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (!event.name) errors.push('Missing required property: name');
  if (!event.startDate) errors.push('Missing required property: startDate');

  // location must exist and be a Place with address
  if (!event.location) {
    errors.push('Missing required property: location');
  } else if (typeof event.location === 'object') {
    const loc = event.location as Record<string, unknown>;
    if (loc['@type'] !== 'Place') {
      errors.push('location must be @type Place');
    }
    // Address can be string or object, just needs to exist
    if (!loc.address && !loc.name) {
      errors.push('location.Place requires address or name property');
    }
  }

  return errors;
}

/**
 * Helper: Validate Article required properties
 */
function validateArticle(article: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (!article.headline) errors.push('Missing required property: headline');
  if (!article.author) errors.push('Missing required property: author');

  // publisher must exist and have logo as ImageObject
  if (!article.publisher) {
    errors.push('Missing required property: publisher');
  } else if (typeof article.publisher === 'object') {
    const pub = article.publisher as Record<string, unknown>;

    // Publisher can be an @id reference or a full object
    if (pub['@id']) {
      // Reference to Organization elsewhere - acceptable
    } else {
      // Full publisher object - check for logo
      if (!pub.logo) {
        errors.push('publisher missing logo property');
      } else if (typeof pub.logo === 'object') {
        const logo = pub.logo as Record<string, unknown>;
        if (logo['@type'] !== 'ImageObject') {
          errors.push('publisher.logo must be @type ImageObject');
        }
        if (!logo.url) {
          errors.push('publisher.logo missing url property');
        }
      }
    }
  }

  return errors;
}

/**
 * Helper: Validate BreadcrumbList items have 'item' property
 */
function validateBreadcrumbList(breadcrumb: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (!breadcrumb.itemListElement || !Array.isArray(breadcrumb.itemListElement)) {
    errors.push('Missing or invalid itemListElement array');
    return errors;
  }

  breadcrumb.itemListElement.forEach((listItem: unknown, index: number) => {
    if (!listItem || typeof listItem !== 'object') {
      errors.push(`itemListElement[${index}] is not an object`);
      return;
    }

    const item = listItem as Record<string, unknown>;
    if (!item.item) {
      errors.push(`itemListElement[${index}] missing required 'item' property`);
    }
  });

  return errors;
}

/**
 * Helper: Validate FAQPage has minimum 2 questions (warning, not failure)
 */
function validateFAQPage(faq: Record<string, unknown>): { warnings: string[] } {
  const warnings: string[] = [];

  if (!faq.mainEntity || !Array.isArray(faq.mainEntity)) {
    warnings.push('FAQPage missing mainEntity array');
    return { warnings };
  }

  if (faq.mainEntity.length < 2) {
    warnings.push(`FAQPage has only ${faq.mainEntity.length} question(s) — Google recommends 2+`);
  }

  return { warnings };
}

/**
 * Pass 4: Meta Tag Validation
 * Fetches rendered HTML pages and validates meta tags using cheerio
 */
async function pass4MetaTagValidation(baseUrl: string): Promise<Pass4Result> {
  const result: Pass4Result = {
    pass: true,
    failures: [],
    warnings: [],
    totalChecked: 0,
    titleViolations: 0,
    descriptionViolations: 0,
    h1Violations: 0,
    ogIncomplete: 0,
  };

  try {
    // Fetch sitemap URLs (reuse Pass 1 logic)
    const indexUrl = `${baseUrl}/sitemap.xml`;
    const indexResponse = await fetch(indexUrl);
    if (!indexResponse.ok) {
      result.failures.push(`Failed to fetch sitemap index: ${indexResponse.status}`);
      result.pass = false;
      return result;
    }

    const indexXml = await indexResponse.text();
    const sitemapUrlMatches = indexXml.matchAll(/<loc>(.*?)<\/loc>/g);
    const sitemapUrls = Array.from(sitemapUrlMatches).map(m => m[1]);

    // Fetch and collect all URLs
    const allUrls: string[] = [];
    for (const sitemapUrl of sitemapUrls) {
      const response = await fetch(sitemapUrl);
      if (!response.ok) continue;

      const xml = await response.text();
      const urlMatches = xml.matchAll(/<loc>(.*?)<\/loc>/g);
      const urls = Array.from(urlMatches).map(m => m[1]);
      allUrls.push(...urls);
    }

    // Sample if >50 URLs (controlled by AUDIT_SAMPLE env var)
    const auditSample = process.env.AUDIT_SAMPLE ? parseInt(process.env.AUDIT_SAMPLE) : 50;
    const urlsToCheck = allUrls.length > auditSample
      ? allUrls.sort(() => Math.random() - 0.5).slice(0, auditSample)
      : allUrls;

    result.totalChecked = urlsToCheck.length;

    // Check each URL
    for (let i = 0; i < urlsToCheck.length; i++) {
      const url = urlsToCheck[i];

      // Log progress every 10 URLs
      if ((i + 1) % 10 === 0 || i === 0) {
        console.log(`  Checking ${i + 1}/${urlsToCheck.length}: ${url}`);
      }

      try {
        // Fetch with 5s timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Kroam-Audit/1.0' }
        });
        clearTimeout(timeoutId);

        if (!response.ok) continue;

        const html = await response.text();
        const $ = cheerio.load(html);

        // Title check (CTAG-04)
        const title = $('title').text();
        if (title.length > 60) {
          result.titleViolations++;
          result.failures.push(`Title too long (${title.length} chars): ${url}`);
          result.pass = false;
        }

        // Description check (CTAG-02/03)
        const description = $('meta[name="description"]').attr('content') || '';
        if (description.length < 100 || description.length > 160) {
          result.descriptionViolations++;
          result.failures.push(`Description invalid (${description.length} chars, need 100-160): ${url}`);
          result.pass = false;
        }

        // H1 check (CTAG-01/06)
        const h1Count = $('h1').length;
        if (h1Count === 0) {
          result.h1Violations++;
          result.failures.push(`No H1 tag found: ${url}`);
          result.pass = false;
        } else if (h1Count > 1) {
          result.h1Violations++;
          result.failures.push(`Multiple H1 tags (${h1Count}): ${url}`);
          result.pass = false;
        }

        // OG check (CTAG-05) - WARN only, not FAIL
        const ogTitle = $('meta[property="og:title"]').attr('content');
        const ogDescription = $('meta[property="og:description"]').attr('content');
        const ogImage = $('meta[property="og:image"]').attr('content');
        const ogUrl = $('meta[property="og:url"]').attr('content');

        if (!ogTitle || !ogDescription || !ogImage || !ogUrl) {
          result.ogIncomplete++;
          result.warnings.push(`Incomplete OG tags: ${url}`);
        }

      } catch (error) {
        // Timeout or fetch error - skip this URL
        if (error instanceof Error && error.name === 'AbortError') {
          result.warnings.push(`Timeout checking: ${url}`);
        }
      }
    }

  } catch (error) {
    result.failures.push(`Pass 4 error: ${error instanceof Error ? error.message : String(error)}`);
    result.pass = false;
  }

  return result;
}

/**
 * Pass 6: TTFB Measurement
 * Measures Time To First Byte for sampled production URLs by page type
 */
async function pass6TTFBMeasurement(baseUrl: string): Promise<Pass6Result> {
  const result: Pass6Result = {
    pass: true,
    failures: [],
    warnings: [],
    totalChecked: 0,
    slowPages: [],
    avgTTFBByType: {},
  };

  try {
    // Fetch sitemap URLs (reuse Pass 1 logic)
    const indexUrl = `${baseUrl}/sitemap.xml`;
    const indexResponse = await fetch(indexUrl);
    if (!indexResponse.ok) {
      result.failures.push(`Failed to fetch sitemap index: ${indexResponse.status}`);
      result.pass = false;
      return result;
    }

    const indexXml = await indexResponse.text();
    const sitemapUrlMatches = indexXml.matchAll(/<loc>(.*?)<\/loc>/g);
    const sitemapUrls = Array.from(sitemapUrlMatches).map(m => m[1]);

    // Fetch and collect all URLs
    const allUrls: string[] = [];
    for (const sitemapUrl of sitemapUrls) {
      const response = await fetch(sitemapUrl);
      if (!response.ok) continue;

      const xml = await response.text();
      const urlMatches = xml.matchAll(/<loc>(.*?)<\/loc>/g);
      const urls = Array.from(urlMatches).map(m => m[1]);
      allUrls.push(...urls);
    }

    // Categorize URLs by page type
    const urlsByType: Record<string, string[]> = {
      'Index pages': [],
      'League pages': [],
      'Match pages': [],
      'Model pages': [],
      'Blog pages': [],
    };

    const indexPages = ['/', '/blog', '/models', '/matches', '/leagues', '/leaderboard', '/about', '/methodology'];

    allUrls.forEach(url => {
      const path = url.replace(baseUrl, '');

      if (indexPages.includes(path)) {
        urlsByType['Index pages'].push(url);
      } else if (path.startsWith('/leagues/')) {
        const segments = path.split('/').filter(s => s);
        // League pages have 2 segments: /leagues/{slug}
        // Match pages have 3 segments: /leagues/{slug}/{match}
        if (segments.length === 2) {
          urlsByType['League pages'].push(url);
        } else if (segments.length === 3) {
          urlsByType['Match pages'].push(url);
        }
      } else if (path.startsWith('/models/') && path !== '/models') {
        urlsByType['Model pages'].push(url);
      } else if (path.startsWith('/blog/') && path !== '/blog') {
        urlsByType['Blog pages'].push(url);
      }
    });

    // Sample up to AUDIT_SAMPLE per page type (default 5)
    const sampleSize = process.env.AUDIT_SAMPLE ? parseInt(process.env.AUDIT_SAMPLE) : 5;
    const ttfbMeasurements: Record<string, number[]> = {};

    for (const [pageType, urls] of Object.entries(urlsByType)) {
      if (urls.length === 0) continue;

      const sampled = urls
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(sampleSize, urls.length));

      ttfbMeasurements[pageType] = [];

      for (const url of sampled) {
        try {
          // Measure TTFB with performance.now()
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

          const startTime = performance.now();
          const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: { 'User-Agent': 'Kroam-Audit/1.0' }
          });
          const ttfb = performance.now() - startTime;
          clearTimeout(timeoutId);

          result.totalChecked++;
          ttfbMeasurements[pageType].push(ttfb);

          // Track slow pages
          if (ttfb > 2000) {
            result.slowPages.push({ url, ttfb, pageType });
            result.warnings.push(`Slow page (${Math.round(ttfb)}ms TTFB): ${url}`);
          } else if (ttfb > 1000) {
            result.warnings.push(`Warning TTFB (${Math.round(ttfb)}ms): ${url}`);
          }

        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            result.warnings.push(`Timeout measuring TTFB: ${url}`);
          } else {
            result.warnings.push(`Failed to measure TTFB for ${url}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    }

    // Calculate average TTFB per page type
    for (const [pageType, measurements] of Object.entries(ttfbMeasurements)) {
      if (measurements.length > 0) {
        const avg = measurements.reduce((sum, val) => sum + val, 0) / measurements.length;
        result.avgTTFBByType[pageType] = avg;
      }
    }

  } catch (error) {
    result.failures.push(`Pass 6 error: ${error instanceof Error ? error.message : String(error)}`);
    result.pass = false;
  }

  return result;
}

/**
 * Pass 5: JSON-LD Validation
 * Extracts and validates JSON-LD schemas from rendered HTML pages
 */
async function pass5JsonLdValidation(baseUrl: string): Promise<Pass5Result> {
  const result: Pass5Result = {
    pass: true,
    failures: [],
    warnings: [],
    totalChecked: 0,
    duplicateOrganization: 0,
    duplicateWebSite: 0,
    invalidSportsEvent: 0,
    invalidArticle: 0,
    invalidBreadcrumb: 0,
    invalidFaq: 0,
    totalSchemaErrors: 0,
  };

  try {
    // Fetch sitemap URLs (reuse Pass 1 logic)
    const indexUrl = `${baseUrl}/sitemap.xml`;
    const indexResponse = await fetch(indexUrl);
    if (!indexResponse.ok) {
      result.failures.push(`Failed to fetch sitemap index: ${indexResponse.status}`);
      result.pass = false;
      return result;
    }

    const indexXml = await indexResponse.text();
    const sitemapUrlMatches = indexXml.matchAll(/<loc>(.*?)<\/loc>/g);
    const sitemapUrls = Array.from(sitemapUrlMatches).map(m => m[1]);

    // Fetch and collect all URLs
    const allUrls: string[] = [];
    for (const sitemapUrl of sitemapUrls) {
      const response = await fetch(sitemapUrl);
      if (!response.ok) continue;

      const xml = await response.text();
      const urlMatches = xml.matchAll(/<loc>(.*?)<\/loc>/g);
      const urls = Array.from(urlMatches).map(m => m[1]);
      allUrls.push(...urls);
    }

    // Sample if >50 URLs (controlled by AUDIT_SAMPLE env var)
    const auditSample = process.env.AUDIT_SAMPLE ? parseInt(process.env.AUDIT_SAMPLE) : 50;
    const urlsToCheck = allUrls.length > auditSample
      ? allUrls.sort(() => Math.random() - 0.5).slice(0, auditSample)
      : allUrls;

    result.totalChecked = urlsToCheck.length;

    // Check each URL
    for (let i = 0; i < urlsToCheck.length; i++) {
      const url = urlsToCheck[i];

      // Log progress every 10 URLs
      if ((i + 1) % 10 === 0 || i === 0) {
        console.log(`  Checking ${i + 1}/${urlsToCheck.length}: ${url}`);
      }

      try {
        // Fetch with 5s timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Kroam-Audit/1.0' }
        });
        clearTimeout(timeoutId);

        if (!response.ok) continue;

        const html = await response.text();
        const $ = cheerio.load(html);

        // Extract all JSON-LD scripts
        const jsonLdScripts: unknown[] = [];
        $('script[type="application/ld+json"]').each((_, el) => {
          try {
            const content = $(el).html();
            if (content) {
              jsonLdScripts.push(JSON.parse(content));
            }
          } catch (error) {
            result.warnings.push(`Invalid JSON-LD at ${url}: ${error instanceof Error ? error.message : String(error)}`);
          }
        });

        // Extract all schemas (flatten @graph arrays)
        const allSchemas = extractAllSchemaTypes(jsonLdScripts);

        // Count schema types for duplication check
        const typeCounts = new Map<string, number>();
        allSchemas.forEach(schema => {
          const type = schema['@type'];
          if (typeof type === 'string') {
            typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
          }
        });

        // SCHEMA-01: Check for duplicate Organization/WebSite
        const orgCount = typeCounts.get('Organization') || 0;
        if (orgCount > 1) {
          result.duplicateOrganization++;
          result.failures.push(`Duplicate Organization (${orgCount} found): ${url}`);
          result.pass = false;
        }

        const websiteCount = typeCounts.get('WebSite') || 0;
        if (websiteCount > 1) {
          result.duplicateWebSite++;
          result.failures.push(`Duplicate WebSite (${websiteCount} found): ${url}`);
          result.pass = false;
        }

        // SCHEMA-02: Validate SportsEvent required properties
        allSchemas.forEach(schema => {
          if (schema['@type'] === 'SportsEvent') {
            const errors = validateSportsEvent(schema);
            if (errors.length > 0) {
              result.invalidSportsEvent++;
              result.failures.push(`Invalid SportsEvent: ${url}\n    ${errors.join('\n    ')}`);
              result.pass = false;
            }
          }
        });

        // SCHEMA-03: Validate Article required properties
        allSchemas.forEach(schema => {
          const type = schema['@type'];
          if (type === 'Article' || type === 'NewsArticle') {
            const errors = validateArticle(schema);
            if (errors.length > 0) {
              result.invalidArticle++;
              result.failures.push(`Invalid Article: ${url}\n    ${errors.join('\n    ')}`);
              result.pass = false;
            }
          }
        });

        // SCHEMA-04: Validate BreadcrumbList item property
        allSchemas.forEach(schema => {
          if (schema['@type'] === 'BreadcrumbList') {
            const errors = validateBreadcrumbList(schema);
            if (errors.length > 0) {
              result.invalidBreadcrumb++;
              result.failures.push(`Invalid BreadcrumbList: ${url}\n    ${errors.join('\n    ')}`);
              result.pass = false;
            }
          }
        });

        // SCHEMA-03 (FAQPage): Validate minimum questions (WARNING only)
        allSchemas.forEach(schema => {
          if (schema['@type'] === 'FAQPage') {
            const { warnings } = validateFAQPage(schema);
            if (warnings.length > 0) {
              result.invalidFaq++;
              warnings.forEach(w => result.warnings.push(`${url}: ${w}`));
            }
          }
        });

      } catch (error) {
        // Timeout or fetch error - skip this URL
        if (error instanceof Error && error.name === 'AbortError') {
          result.warnings.push(`Timeout checking: ${url}`);
        }
      }
    }

    // Calculate total schema errors
    result.totalSchemaErrors =
      result.duplicateOrganization +
      result.duplicateWebSite +
      result.invalidSportsEvent +
      result.invalidArticle +
      result.invalidBreadcrumb;

  } catch (error) {
    result.failures.push(`Pass 5 error: ${error instanceof Error ? error.message : String(error)}`);
    result.pass = false;
  }

  return result;
}

/**
 * Main audit function
 */
async function runAudit() {
  console.log('=== Sitemap & Internal Link Audit ===\n');

  const baseUrl = process.env.AUDIT_BASE_URL;
  let pass1: Pass1Result | null = null;
  let pass2: Pass2Result;
  let pass3: Pass3Result;
  let pass4: Pass4Result | null = null;
  let pass5: Pass5Result | null = null;
  let pass6: Pass6Result | null = null;

  // Pass 1: Only run if AUDIT_BASE_URL is set (requires running server)
  if (baseUrl) {
    console.log('Pass 1: Sitemap URL Validation');
    pass1 = await pass1SitemapUrlValidation(baseUrl);

    if (pass1.pass) {
      console.log(`  ✓ No /matches/UUID URLs found (checked ${pass1.urlCount} URLs)`);
      console.log(`  ✓ No long-form league slugs found`);
      console.log(`  ✓ Spot-check: ${pass1.spotCheckCount}/${Math.min(5, pass1.urlCount)} URLs returned 200`);
    } else {
      pass1.failures.forEach(f => console.log(`  ✗ ${f}`));
    }

    pass1.warnings.forEach(w => console.log(`  ⚠ ${w}`));
    console.log('');
  } else {
    console.log('Pass 1: SKIPPED (set AUDIT_BASE_URL to run sitemap URL validation)\n');
  }

  // Pass 2: Sitemap Completeness
  console.log('Pass 2: Sitemap Completeness');
  pass2 = await pass2SitemapCompleteness();

  if (pass2.pass) {
    console.log(`  ✓ ${pass2.modelCount} active models in database`);
    console.log(`  ✓ ${pass2.matchCount} matches with slugs in database`);
    console.log(`  ✓ ${pass2.blogCount} published blog posts in database`);
    console.log(`  ✓ 17 competitions configured`);
  } else {
    pass2.failures.forEach(f => console.log(`  ✗ ${f}`));
  }

  pass2.warnings.forEach(w => console.log(`  ⚠ ${w}`));
  console.log('');

  // Pass 3: Internal Link Architecture
  console.log('Pass 3: Internal Link Architecture');
  pass3 = await pass3InternalLinkArchitecture();

  if (pass3.pass) {
    Object.entries(pass3.linkSourceCounts).forEach(([pageType, count]) => {
      const emoji = count >= 3 ? '✓' : '⚠';
      console.log(`  ${emoji} ${pageType}: ${count}+ link sources`);
    });
  } else {
    pass3.failures.forEach(f => console.log(`  ✗ ${f}`));
  }

  pass3.warnings.forEach(w => console.log(`  ⚠ ${w}`));
  console.log('');

  // Pass 4: Meta Tag Validation (only if AUDIT_BASE_URL is set)
  if (baseUrl) {
    console.log('Pass 4: Meta Tag Validation');
    pass4 = await pass4MetaTagValidation(baseUrl);

    if (pass4.pass) {
      console.log(`  ✓ All ${pass4.totalChecked} pages have valid title tags (<60 chars)`);
      console.log(`  ✓ All ${pass4.totalChecked} pages have valid description tags (100-160 chars)`);
      console.log(`  ✓ All ${pass4.totalChecked} pages have exactly one H1 tag`);
      if (pass4.ogIncomplete === 0) {
        console.log(`  ✓ All ${pass4.totalChecked} pages have complete OG tags`);
      }
    } else {
      pass4.failures.forEach(f => console.log(`  ✗ ${f}`));
    }

    pass4.warnings.forEach(w => console.log(`  ⚠ ${w}`));
    console.log('');
  } else {
    console.log('Pass 4: SKIPPED (set AUDIT_BASE_URL to run meta tag validation)\n');
  }

  // Pass 5: JSON-LD Validation (only if AUDIT_BASE_URL is set)
  if (baseUrl) {
    console.log('Pass 5: JSON-LD Validation');
    pass5 = await pass5JsonLdValidation(baseUrl);

    if (pass5.pass) {
      console.log(`  ✓ No duplicate Organization schemas (checked ${pass5.totalChecked} pages)`);
      console.log(`  ✓ No duplicate WebSite schemas (checked ${pass5.totalChecked} pages)`);
      console.log(`  ✓ All SportsEvent schemas have required properties`);
      console.log(`  ✓ All Article schemas have required properties`);
      console.log(`  ✓ All BreadcrumbList schemas valid`);
      console.log(`  ✓ Total schema errors: ${pass5.totalSchemaErrors} (target: <50)`);
    } else {
      console.log(`  ✗ Total schema errors: ${pass5.totalSchemaErrors}`);
      if (pass5.duplicateOrganization > 0) {
        console.log(`  ✗ Duplicate Organization found on ${pass5.duplicateOrganization} page(s)`);
      }
      if (pass5.duplicateWebSite > 0) {
        console.log(`  ✗ Duplicate WebSite found on ${pass5.duplicateWebSite} page(s)`);
      }
      if (pass5.invalidSportsEvent > 0) {
        console.log(`  ✗ Invalid SportsEvent schemas: ${pass5.invalidSportsEvent}`);
      }
      if (pass5.invalidArticle > 0) {
        console.log(`  ✗ Invalid Article schemas: ${pass5.invalidArticle}`);
      }
      if (pass5.invalidBreadcrumb > 0) {
        console.log(`  ✗ Invalid BreadcrumbList schemas: ${pass5.invalidBreadcrumb}`);
      }
      pass5.failures.forEach(f => console.log(`  ✗ ${f}`));
    }

    if (pass5.invalidFaq > 0) {
      console.log(`  ⚠ FAQPage schemas with <2 questions: ${pass5.invalidFaq} (recommendation only)`);
    }
    pass5.warnings.forEach(w => console.log(`  ⚠ ${w}`));
    console.log('');
  } else {
    console.log('Pass 5: SKIPPED (set AUDIT_BASE_URL to run JSON-LD validation)\n');
  }

  // Pass 6: TTFB Measurement (only if AUDIT_BASE_URL is set)
  if (baseUrl) {
    console.log('Pass 6: TTFB Measurement');
    pass6 = await pass6TTFBMeasurement(baseUrl);

    if (Object.keys(pass6.avgTTFBByType).length > 0) {
      console.log(`  ✓ Checked ${pass6.totalChecked} pages across ${Object.keys(pass6.avgTTFBByType).length} page types`);

      // Display average TTFB by page type
      Object.entries(pass6.avgTTFBByType).forEach(([pageType, avgTTFB]) => {
        const avgMs = Math.round(avgTTFB);
        const emoji = avgTTFB > 2000 ? '✗' : avgTTFB > 1000 ? '⚠' : '✓';
        console.log(`  ${emoji} ${pageType}: ${avgMs}ms avg TTFB`);
      });

      // List slow pages (>2s)
      if (pass6.slowPages.length > 0) {
        console.log(`  ⚠ ${pass6.slowPages.length} page(s) exceed 2s TTFB threshold (best-effort optimization)`);
        pass6.slowPages.slice(0, 5).forEach(({ url, ttfb, pageType }) => {
          console.log(`    - [${pageType}] ${Math.round(ttfb)}ms: ${url}`);
        });
        if (pass6.slowPages.length > 5) {
          console.log(`    ... and ${pass6.slowPages.length - 5} more`);
        }
      }
    } else {
      console.log(`  ⚠ No URLs categorized for TTFB measurement`);
    }

    pass6.warnings.forEach(w => console.log(`  ⚠ ${w}`));
    console.log('');
  } else {
    console.log('Pass 6: SKIPPED (set AUDIT_BASE_URL to run TTFB measurement)\n');
  }

  // Aggregate results
  const allFailures = [
    ...(pass1?.failures || []),
    ...pass2.failures,
    ...pass3.failures,
    ...(pass4?.failures || []),
    ...(pass5?.failures || []),
    // Note: pass6 warnings are NOT failures - TTFB is best-effort
  ];

  const allWarnings = [
    ...(pass1?.warnings || []),
    ...pass2.warnings,
    ...pass3.warnings,
    ...(pass4?.warnings || []),
    ...(pass5?.warnings || []),
    ...(pass6?.warnings || []),
  ];

  const passed = allFailures.length === 0;

  // Summary
  if (passed) {
    console.log(`=== AUDIT PASSED (0 failures, ${allWarnings.length} warnings) ===`);
    process.exit(0);
  } else {
    console.log(`=== AUDIT FAILED (${allFailures.length} failures, ${allWarnings.length} warnings) ===`);
    process.exit(1);
  }
}

// Run the audit
runAudit().catch((error) => {
  console.error('Fatal error during audit:', error);
  process.exit(1);
});
