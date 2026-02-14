import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@0ne/db/server'
import {
  encryptCookies,
  isEncryptionConfigured,
} from '@/lib/cookie-encryption'

export const dynamic = 'force-dynamic'

// CORS headers for Chrome extension
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

/**
 * OPTIONS /api/extension/push-cookies
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

// ============================================
// Types
// ============================================

interface PushCookiesRequest {
  staffSkoolId: string
  cookies: string // Full cookie string
  authTokenExpiresAt: string | null // ISO string
  hasSession: boolean
}

interface PushCookiesResponse {
  success: boolean
  stored: boolean
  expiresAt: string | null
  error?: string
}

// ============================================
// Auth Helper
// ============================================

function validateExtensionApiKey(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('authorization')
  const expectedKey = process.env.EXTENSION_API_KEY

  if (!expectedKey) {
    console.error('[Extension API] EXTENSION_API_KEY environment variable not set')
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500, headers: corsHeaders }
    )
  }

  if (!authHeader) {
    return NextResponse.json(
      { error: 'Missing Authorization header' },
      { status: 401, headers: corsHeaders }
    )
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    return NextResponse.json(
      { error: 'Invalid Authorization header format. Expected: Bearer {apiKey}' },
      { status: 401, headers: corsHeaders }
    )
  }

  const apiKey = match[1]
  if (apiKey !== expectedKey) {
    return NextResponse.json(
      { error: 'Invalid API key' },
      { status: 401, headers: corsHeaders }
    )
  }

  return null // Valid
}

// ============================================
// POST /api/extension/push-cookies
// ============================================

export async function POST(request: NextRequest) {
  // Validate API key
  const authError = validateExtensionApiKey(request)
  if (authError) return authError

  // Check encryption is configured
  if (!isEncryptionConfigured()) {
    console.error('[Extension API] COOKIE_ENCRYPTION_KEY not configured')
    return NextResponse.json(
      {
        success: false,
        stored: false,
        expiresAt: null,
        error: 'Server encryption not configured',
      } as PushCookiesResponse,
      { status: 500, headers: corsHeaders }
    )
  }

  try {
    const body: PushCookiesRequest = await request.json()

    // Validate request
    if (!body.staffSkoolId?.trim()) {
      return NextResponse.json(
        {
          success: false,
          stored: false,
          expiresAt: null,
          error: 'Missing required field: staffSkoolId',
        } as PushCookiesResponse,
        { status: 400, headers: corsHeaders }
      )
    }

    if (!body.cookies?.trim()) {
      return NextResponse.json(
        {
          success: false,
          stored: false,
          expiresAt: null,
          error: 'Missing required field: cookies',
        } as PushCookiesResponse,
        { status: 400, headers: corsHeaders }
      )
    }

    console.log(
      `[Extension API] Storing cookies for staff ${body.staffSkoolId}`,
      body.authTokenExpiresAt ? `(expires: ${body.authTokenExpiresAt})` : '(no expiry)'
    )

    // Encrypt cookies
    const encryptedCookies = encryptCookies(body.cookies)

    // Parse expiry date
    const expiresAt = body.authTokenExpiresAt ? new Date(body.authTokenExpiresAt) : null

    // Upsert into database
    const supabase = createServerClient()

    const { error } = await supabase.from('extension_cookies').upsert(
      {
        staff_skool_id: body.staffSkoolId,
        cookies_encrypted: encryptedCookies,
        auth_token_expires_at: expiresAt?.toISOString() ?? null,
        session_cookie_present: body.hasSession,
        last_updated: new Date().toISOString(),
      },
      {
        onConflict: 'staff_skool_id',
      }
    )

    if (error) {
      console.error('[Extension API] Error storing cookies:', error)
      return NextResponse.json(
        {
          success: false,
          stored: false,
          expiresAt: null,
          error: `Database error: ${error.message}`,
        } as PushCookiesResponse,
        { status: 500, headers: corsHeaders }
      )
    }

    console.log(`[Extension API] Cookies stored successfully for ${body.staffSkoolId}`)

    const response: PushCookiesResponse = {
      success: true,
      stored: true,
      expiresAt: expiresAt?.toISOString() ?? null,
    }

    return NextResponse.json(response, { headers: corsHeaders })
  } catch (error) {
    console.error('[Extension API] POST exception:', error)
    return NextResponse.json(
      {
        success: false,
        stored: false,
        expiresAt: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      } as PushCookiesResponse,
      { status: 500, headers: corsHeaders }
    )
  }
}
