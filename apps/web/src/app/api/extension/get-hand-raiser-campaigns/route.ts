import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServerClient } from '@0ne/db/server'

export const dynamic = 'force-dynamic'

// CORS headers for Chrome extension
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Clerk-User-Id',
}

/**
 * OPTIONS /api/extension/get-hand-raiser-campaigns
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

// =============================================
// Auth Helper (Supports both Clerk and API key)
// =============================================

interface AuthResult {
  valid: boolean
  authType: 'clerk' | 'apiKey' | null
  userId?: string
  skoolUserId?: string
  error?: string
}

async function validateExtensionAuth(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization')

  if (!authHeader) {
    return { valid: false, authType: null, error: 'Missing Authorization header' }
  }

  // Check for Clerk auth first (Clerk <token>)
  if (authHeader.startsWith('Clerk ')) {
    try {
      const { userId } = await auth()
      if (userId) {
        const client = await clerkClient()
        const user = await client.users.getUser(userId)
        const skoolUserId = (user.publicMetadata?.skoolUserId as string) || undefined

        return { valid: true, authType: 'clerk', userId, skoolUserId }
      }
      return { valid: false, authType: 'clerk', error: 'Invalid or expired Clerk session' }
    } catch {
      return { valid: false, authType: 'clerk', error: 'Failed to validate Clerk session' }
    }
  }

  // Check for Bearer token (API key)
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i)
  if (bearerMatch) {
    const expectedKey = process.env.EXTENSION_API_KEY
    if (!expectedKey) {
      console.error('[Extension API] EXTENSION_API_KEY environment variable not set')
      return { valid: false, authType: 'apiKey', error: 'Server configuration error' }
    }

    if (bearerMatch[1] === expectedKey) {
      return { valid: true, authType: 'apiKey' }
    }
    return { valid: false, authType: 'apiKey', error: 'Invalid API key' }
  }

  return { valid: false, authType: null, error: 'Invalid Authorization header format' }
}

// =============================================
// Types
// =============================================

interface CampaignResponse {
  id: string
  postUrl: string
  skoolPostId: string | null
  communitySlug: string
  keywordFilter: string | null
  ghlTag: string | null
  dmTemplate: string | null
}

// =============================================
// Helpers
// =============================================

/**
 * Extract community slug from a Skool post URL
 * e.g. "https://www.skool.com/fruitful/some-post-abc123" -> "fruitful"
 */
function extractCommunitySlug(postUrl: string): string {
  try {
    const url = new URL(postUrl)
    // Path is like /fruitful/some-post-slug-abc123
    const parts = url.pathname.split('/').filter(Boolean)
    return parts[0] || 'unknown'
  } catch {
    // Fallback: try regex on raw string
    const match = postUrl.match(/skool\.com\/([^/]+)/)
    return match?.[1] || 'unknown'
  }
}

// =============================================
// GET /api/extension/get-hand-raiser-campaigns
// =============================================

/**
 * Returns active hand-raiser campaigns for the authenticated staff member.
 *
 * Query params:
 * - staffSkoolId (required): Skool user ID of the staff member
 *
 * The staffSkoolId is resolved to a Clerk user_id via staff_users table,
 * then campaigns are queried by that user_id.
 */
export async function GET(request: NextRequest) {
  // Validate auth (supports both Clerk and API key)
  const authResult = await validateExtensionAuth(request)
  if (!authResult.valid) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: 401, headers: corsHeaders }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    let staffSkoolId = searchParams.get('staffSkoolId')

    // If using Clerk auth and staffSkoolId not provided, use linked Skool ID
    if (authResult.authType === 'clerk' && !staffSkoolId && authResult.skoolUserId) {
      staffSkoolId = authResult.skoolUserId
    }

    if (!staffSkoolId?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Missing required query parameter: staffSkoolId' },
        { status: 400, headers: corsHeaders }
      )
    }

    const supabase = createServerClient()

    // Resolve staffSkoolId -> Clerk user_id via staff_users table
    const { data: staffUser } = await supabase
      .from('staff_users')
      .select('user_id')
      .eq('skool_user_id', staffSkoolId)
      .single()

    if (!staffUser) {
      console.log(`[Extension API] No staff_users mapping for staffSkoolId: ${staffSkoolId}`)
      return NextResponse.json(
        { success: true, campaigns: [] },
        { headers: corsHeaders }
      )
    }

    const clerkUserId = staffUser.user_id

    // Query active campaigns for this user
    const { data: campaigns, error } = await supabase
      .from('dm_hand_raiser_campaigns')
      .select('id, post_url, skool_post_id, keyword_filter, ghl_tag, dm_template')
      .eq('user_id', clerkUserId)
      .eq('is_active', true)

    if (error) {
      console.error('[Extension API] Error fetching hand-raiser campaigns:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500, headers: corsHeaders }
      )
    }

    // Transform to camelCase response format with extracted communitySlug
    const campaignResponses: CampaignResponse[] = (campaigns || []).map((c) => ({
      id: c.id,
      postUrl: c.post_url,
      skoolPostId: c.skool_post_id,
      communitySlug: extractCommunitySlug(c.post_url),
      keywordFilter: c.keyword_filter,
      ghlTag: c.ghl_tag,
      dmTemplate: c.dm_template,
    }))

    console.log(
      `[Extension API] Returning ${campaignResponses.length} active campaigns for staff ${staffSkoolId}`
    )

    return NextResponse.json(
      { success: true, campaigns: campaignResponses },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('[Extension API] GET hand-raiser-campaigns exception:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500, headers: corsHeaders }
    )
  }
}
