/**
 * Bull Board Dashboard API Route
 * 
 * Provides a web UI for monitoring the job queue.
 * Access at: http://localhost:3000/api/admin/queues
 * 
 * SECURITY: Requires admin authentication via X-Admin-Password header
 */

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { NextRequest, NextResponse } from 'next/server';

function validateAdminRequest(request: NextRequest): NextResponse | null {
  const password = request.headers.get('X-Admin-Password');
  
  if (!process.env.ADMIN_PASSWORD) {
    // SECURITY: Fail closed in production
    if (process.env.NODE_ENV === 'production') {
      console.error('[Bull Board] CRITICAL: ADMIN_PASSWORD not configured in production!');
      return NextResponse.json(
        { success: false, error: 'Server misconfigured' },
        { status: 500 }
      );
    }
    // Allow in development without password
    console.warn('[Bull Board] ADMIN_PASSWORD not configured - allowing in development mode');
    return null;
  }
  
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  return null;
}

// Lazy initialization to avoid build-time errors
let serverAdapter: ExpressAdapter | null = null;

function getServerAdapter() {
  if (serverAdapter) return serverAdapter;
  
  // Import queue at runtime (not during build)
  const { matchQueue } = require('@/lib/queue');
  
  serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/api/admin/queues');

  createBullBoard({
    queues: [new BullMQAdapter(matchQueue)],
    serverAdapter,
  });
  
  return serverAdapter;
}

// Handle all HTTP methods (Next.js 16: params is now a Promise)
export async function GET(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return handleRequest(req, await params);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return handleRequest(req, await params);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return handleRequest(req, await params);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return handleRequest(req, await params);
}

async function handleRequest(req: NextRequest, params: { path?: string[] }) {
  // Validate password
  const authError = validateAdminRequest(req);
  if (authError) return authError;

  const path = params.path ? params.path.join('/') : '';
  const url = new URL(req.url);
  const fullPath = `/api/admin/queues${path ? '/' + path : ''}${url.search}`;

  // Create a mock Express request/response
  const mockReq: any = {
    url: fullPath,
    method: req.method,
    headers: Object.fromEntries(req.headers.entries()),
    body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.json().catch(() => ({})) : undefined,
  };

  const mockRes: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    setHeader(key: string, value: string) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(data: any) {
      this.body = data;
    },
    json(data: any) {
      this.body = JSON.stringify(data);
      this.setHeader('Content-Type', 'application/json');
    },
    end(data?: any) {
      if (data) this.body = data;
    },
  };

  // Get the Express handler
  const adapter = getServerAdapter();
  const handler = adapter.getRouter();
  
  return new Promise<NextResponse>((resolve) => {
    // Process the request through Bull Board's Express adapter
    (handler as any)(mockReq, mockRes, () => {
      // If no route matched, return 404
      resolve(new NextResponse('Not Found', { status: 404 }));
    });

    // Wait a bit for async operations
    setTimeout(() => {
      const headers = new Headers(mockRes.headers);
      
      // Return the response
      resolve(
        new NextResponse(mockRes.body || '', {
          status: mockRes.statusCode,
          headers,
        })
      );
    }, 100);
  });
}
