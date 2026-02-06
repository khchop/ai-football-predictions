/**
 * Next.js Middleware
 *
 * Handles cross-cutting concerns for all routes:
 * - WWW/HTTP redirects (301 permanent)
 * - League slug redirects (single-hop with www/http)
 * - /matches/UUID 410 Gone responses
 * - CORS (Cross-Origin Resource Sharing)
 * - Request body size limits
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// League slug redirects (moved from next.config.ts for single-hop resolution)
const LEAGUE_SLUG_REDIRECTS: Record<string, string> = {
  'premier-league': 'epl',
  'champions-league': 'ucl',
  'europa-league': 'uel',
  'la-liga': 'laliga',
  'serie-a': 'seriea',
  'ligue-1': 'ligue1',
  'turkish-super-lig': 'superlig',
};

/**
 * Main middleware handler
 * Runs on all routes except static assets
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Check /matches/UUID - return 410 Gone immediately
  if (pathname.startsWith('/matches/')) {
    return new NextResponse('Gone', {
      status: 410,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  // 2. Detect all redirect conditions in ONE pass
  const url = new URL(request.url);
  // Use Host header for reliable hostname in Edge Runtime (request.url may have localhost)
  const hostname = request.headers.get('host') || url.hostname;

  // Check www subdomain
  const hasWww = hostname.startsWith('www.');

  // Check HTTP protocol (use x-forwarded-proto header for Edge Runtime reliability)
  const protocol = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
  const isHttp = protocol === 'http';

  // Check league slug redirect
  let leagueSlugRedirect: { from: string; to: string } | null = null;
  for (const [oldSlug, newSlug] of Object.entries(LEAGUE_SLUG_REDIRECTS)) {
    const pattern = `/leagues/${oldSlug}`;
    if (pathname.startsWith(pattern)) {
      leagueSlugRedirect = { from: oldSlug, to: newSlug };
      break;
    }
  }

  // 3. If any redirect condition detected, compute final canonical URL and redirect with 301
  if (hasWww || isHttp || leagueSlugRedirect) {
    // Compute final canonical URL
    const finalHostname = hasWww ? hostname.replace('www.', '') : hostname;
    const finalProtocol = 'https';
    const finalPathname = leagueSlugRedirect
      ? pathname.replace(`/leagues/${leagueSlugRedirect.from}`, `/leagues/${leagueSlugRedirect.to}`)
      : pathname;

    const canonicalUrl = `${finalProtocol}://${finalHostname}${finalPathname}${url.search}`;

    return NextResponse.redirect(canonicalUrl, {
      status: 301,
      headers: {
        'Cache-Control': 'public, max-age=31536000', // Cache redirect for 1 year
      },
    });
  }

  // 4. For API routes, apply existing CORS and body-size logic
  if (pathname.startsWith('/api/')) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return handleCORSPreflight(request);
    }

    // Check request body size
    if (request.method === 'POST' || request.method === 'PUT') {
      const bodySizeCheck = checkBodySize(request);
      if (bodySizeCheck) {
        return bodySizeCheck;
      }
    }

    const response = NextResponse.next();
    addCORSHeaders(request, response);
    return response;
  }

  // 5. For non-redirect, non-API routes, pass through
  return NextResponse.next();
}

/**
 * Handle CORS preflight (OPTIONS) requests
 * Browsers send this before making actual cross-origin requests
 */
function handleCORSPreflight(request: NextRequest): NextResponse {
  const origin = request.headers.get('origin');

  if (!origin || !isAllowedOrigin(origin)) {
    return new NextResponse(null, { status: 403 });
  }

  const response = new NextResponse(null, { status: 204 });

  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Admin-Password'
  );
  response.headers.set('Access-Control-Allow-Credentials', 'false');
  response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours

  return response;
}

/**
 * Add CORS headers to actual response
 */
function addCORSHeaders(request: NextRequest, response: NextResponse): void {
  const origin = request.headers.get('origin');

  if (origin && isAllowedOrigin(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    );
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, X-Admin-Password'
    );
  }
}

/**
 * Validate CORS origin
 * Only allows same-origin and configured base URL
 */
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) {
    return false;
  }

  const allowedOrigins: string[] = [];

  // Add configured base URL
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    allowedOrigins.push(process.env.NEXT_PUBLIC_BASE_URL);
  }

  // In development, allow localhost
  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:3000');
    allowedOrigins.push('http://localhost:3001');
  }

  return allowedOrigins.includes(origin);
}

/**
 * Check request body size and return error if too large
 * Limits: 10KB for admin routes, 100KB for public routes
 */
function checkBodySize(request: NextRequest): NextResponse | null {
  const contentLength = request.headers.get('content-length');

  if (!contentLength) {
    return null; // No content-length header, let it through
  }

  const sizeBytes = parseInt(contentLength, 10);
  const isAdmin = request.nextUrl.pathname.startsWith('/api/admin/');

  // Size limits
  const maxSize = isAdmin ? 10 * 1024 : 100 * 1024; // 10KB admin, 100KB public

  if (sizeBytes > maxSize) {
    const limitKB = maxSize / 1024;
    return new NextResponse(
      JSON.stringify({
        error: `Request body too large (max ${limitKB}KB)`,
      }),
      {
        status: 413, // Payload Too Large
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return null;
}

/**
 * Middleware matcher configuration
 * Run on ALL routes except static assets
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
