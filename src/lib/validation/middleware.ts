import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Validation error response format
 */
interface ValidationErrorDetail {
  field: string;
  message: string;
}

interface ValidationErrorResponse {
  success: false;
  error: {
    code: 'VALIDATION_ERROR';
    message: string;
    details: ValidationErrorDetail[];
  };
}

/**
 * Create a standardized validation error response
 */
export function validationErrorResponse(error: z.ZodError<unknown>): NextResponse<ValidationErrorResponse> {
  const details: ValidationErrorDetail[] = error.issues.map((issue: z.ZodIssue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));

  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details,
      },
    },
    { status: 400 }
  );
}

/**
 * Validate query parameters
 */
export function validateQuery<T>(
  schema: z.ZodSchema<T>,
  searchParams: Record<string, string | string[] | undefined>
): { data: T; error: null } | { data: null; error: NextResponse } {
  try {
    const data = schema.parse(searchParams);
    return { data, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { data: null, error: validationErrorResponse(error) };
    }
    return {
      data: null,
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: [],
          },
        },
        { status: 400 }
      ),
    };
  }
}

/**
 * Validate route parameters
 */
export function validateParams<T>(
  schema: z.ZodSchema<T>,
  params: Record<string, string | string[]>
): { data: T; error: null } | { data: null; error: NextResponse } {
  try {
    const data = schema.parse(params);
    return { data, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { data: null, error: validationErrorResponse(error) };
    }
    return {
      data: null,
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: [],
          },
        },
        { status: 400 }
      ),
    };
  }
}

/**
 * Validate request body
 */
export async function validateBody<T>(
  schema: z.ZodSchema<T>,
  request: NextRequest
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  try {
    const body = await request.json();
    const data = schema.parse(body);
    return { data, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { data: null, error: validationErrorResponse(error) };
    }
    if (error instanceof SyntaxError) {
      return {
        data: null,
        error: NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid JSON in request body',
              details: [],
            },
          },
          { status: 400 }
        ),
      };
    }
    return {
      data: null,
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: [],
          },
        },
        { status: 400 }
      ),
    };
  }
}
