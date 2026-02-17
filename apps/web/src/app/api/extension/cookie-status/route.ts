import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@0ne/db/server'
import { corsHeaders, validateExtensionApiKey } from '@/lib/extension-auth'

export { OPTIONS } from '@/lib/extension-auth'

export const dynamic = 'force-dynamic'

// ============================================
// Types
// ============================================

interface CookieStatusResponse {
  success: boolean
  hasValidCookies: boolean
  expiresAt: string | null
  expiringSoon: boolean
  hoursRemaining: number | null
  error?: string
}

// ============================================
// GET /api/extension/cookie-status
// ============================================

export async function GET(request: NextRequest) {
  // Validate API key
  const authError = validateExtensionApiKey(request)
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const staffSkoolId = searchParams.get('staffSkoolId')

    if (!staffSkoolId?.trim()) {
      return NextResponse.json(
        {
          success: false,
          hasValidCookies: false,
          expiresAt: null,
          expiringSoon: false,
          hoursRemaining: null,
          error: 'Missing required parameter: staffSkoolId',
        } as CookieStatusResponse,
        { status: 400, headers: corsHeaders }
      )
    }

    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('extension_cookies')
      .select('auth_token_expires_at, session_cookie_present, last_updated')
      .eq('staff_skool_id', staffSkoolId)
      .single()

    if (error) {
      // No cookies found is not an error, just no cookies
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          {
            success: true,
            hasValidCookies: false,
            expiresAt: null,
            expiringSoon: false,
            hoursRemaining: null,
          } as CookieStatusResponse,
          { headers: corsHeaders }
        )
      }

      console.error('[Extension API] Error fetching cookie status:', error)
      return NextResponse.json(
        {
          success: false,
          hasValidCookies: false,
          expiresAt: null,
          expiringSoon: false,
          hoursRemaining: null,
          error: `Database error: ${error.message}`,
        } as CookieStatusResponse,
        { status: 500, headers: corsHeaders }
      )
    }

    // Calculate expiry status
    const expiresAt = data.auth_token_expires_at ? new Date(data.auth_token_expires_at) : null
    const now = new Date()

    let hasValidCookies = false
    let expiringSoon = false
    let hoursRemaining: number | null = null

    if (expiresAt) {
      const msRemaining = expiresAt.getTime() - now.getTime()
      hoursRemaining = msRemaining / (1000 * 60 * 60)

      hasValidCookies = msRemaining > 0
      expiringSoon = hoursRemaining > 0 && hoursRemaining <= 24

      // Round to 1 decimal place
      hoursRemaining = hasValidCookies ? Math.round(hoursRemaining * 10) / 10 : 0
    }

    const response: CookieStatusResponse = {
      success: true,
      hasValidCookies,
      expiresAt: expiresAt?.toISOString() ?? null,
      expiringSoon,
      hoursRemaining,
    }

    return NextResponse.json(response, { headers: corsHeaders })
  } catch (error) {
    console.error('[Extension API] GET exception:', error)
    return NextResponse.json(
      {
        success: false,
        hasValidCookies: false,
        expiresAt: null,
        expiringSoon: false,
        hoursRemaining: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      } as CookieStatusResponse,
      { status: 500, headers: corsHeaders }
    )
  }
}
