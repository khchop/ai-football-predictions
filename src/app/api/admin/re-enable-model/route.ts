import { NextRequest, NextResponse } from 'next/server';
import { reEnableModel } from '@/lib/db/queries';

function validateAdminRequest(request: NextRequest): NextResponse | null {
  const password = request.headers.get('X-Admin-Password');
  
  if (!process.env.ADMIN_PASSWORD) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Admin Auth] CRITICAL: ADMIN_PASSWORD not configured in production!');
      return NextResponse.json(
        { success: false, error: 'Server misconfigured' },
        { status: 500 }
      );
    }
    console.warn('[Admin Auth] ADMIN_PASSWORD not configured - allowing in development mode');
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

export async function POST(request: NextRequest) {
  // Validate password
  const authError = validateAdminRequest(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { modelId } = body;

    if (!modelId || typeof modelId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Model ID is required' },
        { status: 400 }
      );
    }

    await reEnableModel(modelId);

    return NextResponse.json({
      success: true,
      message: `Model ${modelId} has been re-enabled`,
    });
  } catch (error) {
    console.error('Error re-enabling model:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
