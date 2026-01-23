import { NextRequest, NextResponse } from 'next/server';
import { reEnableModel } from '@/lib/db/queries';
import { validateBody } from '@/lib/validation/middleware';
import { reEnableModelBodySchema } from '@/lib/validation/schemas';
import { requireAdminAuth } from '@/lib/utils/admin-auth';
import { createErrorResponse } from '@/lib/utils/error-sanitizer';

export async function POST(request: NextRequest) {
  // Admin authentication (timing-safe comparison)
  const authError = requireAdminAuth(request);
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
    return createErrorResponse(error, 500, 're-enable-model');
  }
}
