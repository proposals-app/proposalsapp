import { headers } from 'next/headers';
import { auth as arbitrumAuth } from '@/lib/auth/arbitrum_auth';
import { auth as uniswapAuth } from '@/lib/auth/uniswap_auth';
import { db } from '@proposalsapp/db';
import { daoSlugSchema } from '@/lib/validations';

// Map of DAO slugs to their auth instances
const authMap = {
  arbitrum: arbitrumAuth,
  uniswap: uniswapAuth,
  // Add other DAOs as needed
};

/**
 * Get the current user session for a specific DAO
 */
export async function getCurrentUser(daoSlug: string) {
  const validatedSlug = daoSlugSchema.parse(daoSlug);

  // For special DAOs, use their specific auth
  const authInstance =
    authMap[validatedSlug as keyof typeof authMap] || arbitrumAuth;

  const session = await authInstance.api.getSession({
    headers: await headers(),
  });

  return {
    session,
    userId: session?.user?.id,
    user: session?.user,
  };
}

/**
 * Get the current user and ensure they are authenticated
 * Throws an error if user is not authenticated
 */
export async function requireAuth(daoSlug: string) {
  const { session, userId, user } = await getCurrentUser(daoSlug);

  if (!userId || !user) {
    throw new Error('Authentication required');
  }

  return { session, userId, user };
}

/**
 * Get DAO details by slug
 */
export async function getDaoBySlug(daoSlug: string) {
  const validatedSlug = daoSlugSchema.parse(daoSlug);

  const dao = await db.public
    .selectFrom('dao')
    .where('slug', '=', validatedSlug)
    .select(['id', 'slug', 'name', 'picture'])
    .executeTakeFirst();

  if (!dao) {
    throw new Error(`DAO not found for slug: ${validatedSlug}`);
  }

  return dao;
}

/**
 * Get DAO details and ensure it exists
 * Throws an error if DAO is not found
 */
export async function requireDao(daoSlug: string) {
  return await getDaoBySlug(daoSlug);
}

/**
 * Combined utility to get both authenticated user and DAO
 * Useful for most server actions that need both
 */
export async function requireAuthAndDao(daoSlug: string) {
  const [userResult, dao] = await Promise.all([
    requireAuth(daoSlug),
    requireDao(daoSlug),
  ]);

  return {
    ...userResult,
    dao,
  };
}

/**
 * Optional auth version - returns null user data if not authenticated
 * Useful for actions that work both authenticated and unauthenticated
 */
export async function getOptionalUserAndDao(daoSlug: string) {
  const [userResult, dao] = await Promise.all([
    getCurrentUser(daoSlug),
    requireDao(daoSlug),
  ]);

  return {
    ...userResult,
    dao,
  };
}

/**
 * Standard result types for server actions
 */
export type ServerActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type ServerActionVoidResult =
  | { success: true }
  | { success: false; error: string; code?: string };

/**
 * Creates a success result for server actions
 */
export function createSuccessResult<T>(data: T): ServerActionResult<T> {
  return { success: true, data };
}

export function createSuccessVoidResult(): ServerActionVoidResult {
  return { success: true };
}

/**
 * Creates an error result for server actions
 */
export function createErrorResult(
  error: string,
  code?: string
): ServerActionResult<never> {
  return { success: false, error, code };
}

export function createErrorVoidResult(
  error: string,
  code?: string
): ServerActionVoidResult {
  return { success: false, error, code };
}

/**
 * Standardized error handling wrapper for server actions
 */
export async function handleServerAction<T>(
  action: () => Promise<T>,
  errorContext: string
): Promise<ServerActionResult<T>> {
  try {
    const data = await action();
    return createSuccessResult(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${errorContext}] Error:`, error);
    return createErrorResult(errorMessage);
  }
}

/**
 * Standardized error handling wrapper for void server actions
 */
export async function handleVoidServerAction(
  action: () => Promise<void>,
  errorContext: string
): Promise<ServerActionVoidResult> {
  try {
    await action();
    return createSuccessVoidResult();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${errorContext}] Error:`, error);
    return createErrorVoidResult(errorMessage);
  }
}

/**
 * For server actions that should silently fail (e.g., non-critical operations)
 */
export async function handleSilentServerAction<T>(
  action: () => Promise<T>,
  fallback: T,
  errorContext: string
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    console.error(`[${errorContext}] Error (silent):`, error);
    return fallback;
  }
}
