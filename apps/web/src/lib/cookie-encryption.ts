/**
 * Cookie Encryption Utilities
 * Phase 6: Secure storage of Skool cookies
 *
 * Uses AES-256-CBC encryption with a server-side key
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// ============================================
// Configuration
// ============================================

/**
 * Get the encryption key from environment
 * Key should be 32 bytes (64 hex characters)
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.COOKIE_ENCRYPTION_KEY

  if (!keyHex) {
    throw new Error('COOKIE_ENCRYPTION_KEY environment variable not set')
  }

  if (keyHex.length !== 64) {
    throw new Error('COOKIE_ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  }

  return Buffer.from(keyHex, 'hex')
}

// ============================================
// Encryption Functions
// ============================================

/**
 * Encrypt a string using AES-256-CBC
 * Returns format: IV:encryptedData (both in hex)
 */
export function encryptCookies(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(16) // 16 bytes for AES

  const cipher = createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  // Return IV:encrypted format
  return iv.toString('hex') + ':' + encrypted
}

/**
 * Decrypt a string that was encrypted with encryptCookies
 * Input format: IV:encryptedData (both in hex)
 */
export function decryptCookies(encrypted: string): string {
  const key = getEncryptionKey()

  // Split IV and encrypted data
  const parts = encrypted.split(':')
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted format - expected IV:data')
  }

  const [ivHex, encryptedText] = parts
  const iv = Buffer.from(ivHex, 'hex')

  const decipher = createDecipheriv('aes-256-cbc', key, iv)
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a new encryption key (for setup)
 * Returns a 64-character hex string
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Check if encryption is properly configured
 */
export function isEncryptionConfigured(): boolean {
  const keyHex = process.env.COOKIE_ENCRYPTION_KEY
  return !!(keyHex && keyHex.length === 64)
}

/**
 * Parse JWT expiry from auth_token
 * JWT format: header.payload.signature
 */
export function parseJwtExpiry(token: string): Date | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    // Decode payload (base64url -> JSON)
    const payloadB64 = parts[1]
    // Handle base64url encoding
    const payloadB64Std = payloadB64.replace(/-/g, '+').replace(/_/g, '/')
    const payloadJson = Buffer.from(payloadB64Std, 'base64').toString('utf8')
    const payload = JSON.parse(payloadJson)

    if (payload.exp && typeof payload.exp === 'number') {
      return new Date(payload.exp * 1000)
    }

    return null
  } catch {
    return null
  }
}

/**
 * Check if a cookie string contains an auth_token and extract its expiry
 */
export function extractAuthTokenExpiry(cookies: string): Date | null {
  // Parse cookie string to find auth_token
  const cookiePairs = cookies.split(';').map((pair) => pair.trim())

  for (const pair of cookiePairs) {
    const [name, value] = pair.split('=')
    if (name?.trim() === 'auth_token' && value) {
      return parseJwtExpiry(value.trim())
    }
  }

  return null
}

/**
 * Check if cookies have session cookie present
 */
export function hasSessionCookie(cookies: string): boolean {
  const cookiePairs = cookies.split(';').map((pair) => pair.trim())

  for (const pair of cookiePairs) {
    const [name] = pair.split('=')
    if (name?.trim() === 'session') {
      return true
    }
  }

  return false
}
