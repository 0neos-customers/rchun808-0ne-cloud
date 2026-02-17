import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@0ne/db/server'
import {
  encryptCookies,
  isEncryptionConfigured,
} from '@/lib/cookie-encryption'
import { corsHeaders, validateExtensionApiKey } from '@/lib/extension-auth'

export { OPTIONS } from '@/lib/extension-auth'

export const dynamic = 'force-dynamic'

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
