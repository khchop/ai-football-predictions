/**
 * Next.js Middleware
 * 
 * Handles cross-cutting concerns for all routes:
 * - CORS (Cross-Origin Resource Sharing)
 * - Request body size limits
 * - Security headers
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Main middleware handler
 * Runs on every request to API routes
 */
export function middleware(request: NextRequest) {
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

  // Add CORS headers to response
  if (request.nextUrl.pathname.startsWith('/api/')) {
    addCORSHeaders(request, response);
  }

  return response;
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
 * Only run this middleware on API routes
 */
export const config = {
  matcher: '/api/:path*',
};
