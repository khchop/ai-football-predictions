import { NextRequest, NextResponse } from 'next/server';
import { reEnableModel } from '@/lib/db/queries';
import { validateBody } from '@/lib/validation/middleware';
import { reEnableModelBodySchema } from '@/lib/validation/schemas';

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
    // Validate request body
    const { data: validatedBody, error: validationError } = await validateBody(reEnableModelBodySchema, request);
    if (validationError) {
      return validationError;
    }

    const { modelId } = validatedBody;

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
