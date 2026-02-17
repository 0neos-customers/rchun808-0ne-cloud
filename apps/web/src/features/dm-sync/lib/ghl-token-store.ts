/**
 * GHL Token Store
 *
 * Handles persistent storage and retrieval of GHL OAuth tokens.
 * GHL refresh tokens are single-use - after each refresh, a new
 * refresh token is returned and must be stored.
 *
 * @module dm-sync/lib/ghl-token-store
 */

import { createServerClient } from '@0ne/db/server'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Stored token data
 */
export interface StoredTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

/**
 * Token update data
 */
export interface TokenUpdate {
  accessToken: string
  refreshToken: string
  expiresIn: number // seconds until expiry
}

// =============================================================================
// TOKEN STORE FUNCTIONS
// =============================================================================

/**
 * Get stored GHL tokens for a user
 *
 * Falls back to environment variables if no tokens stored in database.
 * This allows for initial setup via env vars, then automatic rotation.
 *
 * @param userId - The user ID
 * @returns Stored tokens or null if not found
 */
export async function getStoredTokens(
  userId: string
): Promise<StoredTokens | null> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('dm_sync_config')
    .select('ghl_access_token, ghl_refresh_token, ghl_token_expires_at')
    .eq('clerk_user_id', userId)
    .single()

  if (error || !data) {
    console.log(`[GHL Token Store] No config found for user: ${userId}`)
    return null
  }

  // Check if tokens exist in database
  if (data.ghl_refresh_token) {
    console.log('[GHL Token Store] Using tokens from database')
    return {
      accessToken: data.ghl_access_token || '',
      refreshToken: data.ghl_refresh_token,
      expiresAt: data.ghl_token_expires_at
        ? new Date(data.ghl_token_expires_at)
        : new Date(0),
    }
  }

  // Fall back to environment variables (initial setup)
  const envAccessToken = process.env.GHL_MARKETPLACE_ACCESS_TOKEN
  const envRefreshToken = process.env.GHL_MARKETPLACE_REFRESH_TOKEN
  const envExpiresAt = process.env.GHL_MARKETPLACE_TOKEN_EXPIRES

  if (envRefreshToken) {
    console.log('[GHL Token Store] Using tokens from environment (will migrate to DB on next refresh)')
    return {
      accessToken: envAccessToken || '',
      refreshToken: envRefreshToken,
      expiresAt: envExpiresAt ? new Date(parseInt(envExpiresAt)) : new Date(0),
    }
  }

  console.log('[GHL Token Store] No tokens found in database or environment')
  return null
}

/**
 * Save updated GHL tokens to database
 *
 * This is called after each token refresh to persist the new tokens.
 * CRITICAL: GHL refresh tokens are single-use, so we must save the
 * new refresh token or it will be lost.
 *
 * @param userId - The user ID
 * @param tokens - The new token data
 */
export async function saveTokens(
  userId: string,
  tokens: TokenUpdate
): Promise<void> {
  const supabase = createServerClient()

  const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000)

  console.log('[GHL Token Store] Saving new tokens to database', {
    userId,
    accessTokenLength: tokens.accessToken.length,
    refreshTokenLength: tokens.refreshToken.length,
    expiresAt: expiresAt.toISOString(),
  })

  const { error } = await supabase
    .from('dm_sync_config')
    .update({
      ghl_access_token: tokens.accessToken,
      ghl_refresh_token: tokens.refreshToken,
      ghl_token_expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('clerk_user_id', userId)

  if (error) {
    console.error('[GHL Token Store] Failed to save tokens:', error.message)
    throw new Error(`Failed to save GHL tokens: ${error.message}`)
  }

  console.log('[GHL Token Store] Tokens saved successfully')
}

/**
 * Check if stored tokens are expired or about to expire
 *
 * @param tokens - The stored tokens
 * @param bufferMs - Buffer time in milliseconds (default 5 minutes)
 * @returns true if tokens need refresh
 */
export function tokensNeedRefresh(
  tokens: StoredTokens,
  bufferMs: number = 5 * 60 * 1000
): boolean {
  return tokens.expiresAt.getTime() < Date.now() + bufferMs
}

/**
 * Clear stored tokens for a user
 *
 * Use this when tokens become invalid and user needs to re-authorize.
 *
 * @param userId - The user ID
 */
export async function clearTokens(userId: string): Promise<void> {
  const supabase = createServerClient()

  const { error } = await supabase
    .from('dm_sync_config')
    .update({
      ghl_access_token: null,
      ghl_refresh_token: null,
      ghl_token_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('clerk_user_id', userId)

  if (error) {
    console.error('[GHL Token Store] Failed to clear tokens:', error.message)
    throw new Error(`Failed to clear GHL tokens: ${error.message}`)
  }

  console.log('[GHL Token Store] Tokens cleared for user:', userId)
}
