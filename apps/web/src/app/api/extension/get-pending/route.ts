import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@0ne/db/server'

export const dynamic = 'force-dynamic'

// CORS headers for Chrome extension
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

/**
 * OPTIONS /api/extension/get-pending
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

// =============================================
// Types
// =============================================

interface PendingMessage {
  id: string
  skool_conversation_id: string
  skool_user_id: string
  message_text: string
  created_at: string
  // Phase 5: Multi-staff support
  staff_skool_id: string | null
  staff_display_name: string | null
}

interface GetPendingResponse {
  success: boolean
  messages: PendingMessage[]
  count: number
}

// =============================================
// Auth Helper
// =============================================

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

  // Extract Bearer token
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

// =============================================
// GET /api/extension/get-pending
// =============================================

/**
 * Get Pending Outbound Messages
 *
 * Returns messages that need to be sent via the Chrome extension.
 * These are messages created from GHL that need to be delivered to Skool.
 *
 * Query params:
 * - staffSkoolId: The staff member's Skool user ID
 * - limit: Max messages to return (default 10)
 */
export async function GET(request: NextRequest) {
  // Validate API key
  const authError = validateExtensionApiKey(request)
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const staffSkoolId = searchParams.get('staffSkoolId')
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    if (!staffSkoolId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: staffSkoolId' },
        { status: 400, headers: corsHeaders }
      )
    }

    console.log(`[Extension API] Fetching pending outbound for staff ${staffSkoolId}`)

    const supabase = createServerClient()

    // Query for pending outbound messages
    // These are messages that:
    // 1. Belong to this staff member (user_id = staffSkoolId OR staff_skool_id = staffSkoolId)
    // 2. Are outbound (direction = 'outbound')
    // 3. Are pending (status = 'pending')
    // 4. Have a GHL message ID (came from GHL) OR source='hand-raiser' (from hand-raiser campaigns)
    //
    // Phase 5: Also filter by staff_skool_id for multi-staff routing
    // Messages can be routed to specific staff via staff_skool_id field
    const { data: pendingMessages, error } = await supabase
      .from('dm_messages')
      .select('id, skool_conversation_id, skool_user_id, message_text, created_at, staff_skool_id, staff_display_name')
      .or(`user_id.eq.${staffSkoolId},staff_skool_id.eq.${staffSkoolId}`)
      .eq('direction', 'outbound')
      .eq('status', 'pending')
      // Pick up GHL messages (have ghl_message_id) OR hand-raiser messages (source='hand-raiser')
      .or('ghl_message_id.not.is.null,source.eq.hand-raiser')
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      console.error('[Extension API] Database error:', error)
      return NextResponse.json(
        { error: 'Database query failed', details: error.message },
        { status: 500, headers: corsHeaders }
      )
    }

    const messages = pendingMessages || []

    console.log(`[Extension API] Found ${messages.length} pending outbound messages`)

    const response: GetPendingResponse = {
      success: true,
      messages,
      count: messages.length,
    }

    return NextResponse.json(response, { headers: corsHeaders })
  } catch (error) {
    console.error('[Extension API] GET pending exception:', error)
    return NextResponse.json(
      {
        success: false,
        messages: [],
        count: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500, headers: corsHeaders }
    )
  }
}
