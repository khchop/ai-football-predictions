/**
 * Admin Authentication Utilities
 * 
 * Provides timing-safe password comparison to prevent timing attacks.
 * All admin endpoints should use validateAdminPassword() or requireAdminAuth().
 */

import crypto from 'crypto';
import { loggers } from '@/lib/logger/modules';

/**
 * Validates admin password using timing-safe comparison
 * Prevents timing attacks by ensuring constant-time comparison regardless of input
 */
export function validateAdminPassword(providedPassword: string | null): { valid: boolean; error?: string } {
  const expectedPassword = process.env.ADMIN_PASSWORD;
  
  if (!expectedPassword) {
    loggers.instrumentation.error('ADMIN_PASSWORD not configured in environment');
    return { valid: false, error: 'Server configuration error' };
  }
  
  if (!providedPassword) {
    return { valid: false, error: 'Admin password required' };
  }
  
  // Convert to buffers for timing-safe comparison
  const providedBuffer = Buffer.from(providedPassword, 'utf8');
  const expectedBuffer = Buffer.from(expectedPassword, 'utf8');
  
  // Ensure same length comparison (prevents length-based timing attack)
  if (providedBuffer.length !== expectedBuffer.length) {
    // Still do a comparison to maintain constant time
    // Compare against a dummy buffer of the same length
    crypto.timingSafeEqual(expectedBuffer, expectedBuffer);
    return { valid: false, error: 'Invalid admin password' };
  }
  
  try {
    const isValid = crypto.timingSafeEqual(providedBuffer, expectedBuffer);
    
    if (!isValid) {
      return { valid: false, error: 'Invalid admin password' };
    }
    
    return { valid: true };
  } catch (error) {
    // timingSafeEqual can throw if lengths don't match (shouldn't happen with our check)
    return { valid: false, error: 'Invalid admin password' };
  }
}

/**
 * Express/Next.js middleware helper for admin routes
 * Returns error Response if authentication fails, null if valid
 * 
 * Usage:
 * export async function POST(request: Request) {
 *   const authError = requireAdminAuth(request);
 *   if (authError) return authError;
 *   // ... proceed with admin operation
 * }
 */
export function requireAdminAuth(request: Request): Response | null {
  const adminPassword = request.headers.get('X-Admin-Password');
  const result = validateAdminPassword(adminPassword);
  
  if (!result.valid) {
    loggers.instrumentation.warn('Unauthorized admin access attempt');
    return Response.json(
      { error: result.error },
      { status: 401 }
    );
  }
  
  return null; // Authentication passed
}
