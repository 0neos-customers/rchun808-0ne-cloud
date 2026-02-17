import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@0ne/db/server'
import { corsHeaders, validateExtensionAuth } from '@/lib/extension-auth'

export { OPTIONS } from '@/lib/extension-auth'

export const dynamic = 'force-dynamic'

// =============================================
// POST /api/extension/retry-failed
// =============================================

/**
 * Retry Failed Messages
 *
 * Resets failed outbound messages back to pending status
 * so they can be picked up and retried by the extension.
 */
export async function POST(request: NextRequest) {
  const authResult = await validateExtensionAuth(request)
  if (!authResult.valid) {
    return NextResponse.json(
      { error: authResult.error },
      { status: 401, headers: corsHeaders }
    )
  }

  try {
    const body = await request.json()
    const { staffSkoolId, messageIds } = body

    if (!staffSkoolId) {
      return NextResponse.json(
        { error: 'Missing required field: staffSkoolId' },
        { status: 400, headers: corsHeaders }
      )
    }

    const supabase = createServerClient()

    // Build query for failed messages
    let query = supabase
      .from('dm_messages')
      .update({ status: 'pending' })
      .eq('direction', 'outbound')
      .eq('status', 'failed')
      .eq('staff_skool_id', staffSkoolId)

    // If specific message IDs provided, filter to those
    if (messageIds && Array.isArray(messageIds) && messageIds.length > 0) {
      query = query.in('id', messageIds)
    }

    const { data, error, count } = await query.select('id')

    if (error) {
      console.error('[Extension API] Retry failed error:', error)
      return NextResponse.json(
        { error: 'Database update failed', details: error.message },
        { status: 500, headers: corsHeaders }
      )
    }

    const resetCount = data?.length || 0
    console.log(`[Extension API] Reset ${resetCount} failed messages to pending`)

    return NextResponse.json({
      success: true,
      reset: resetCount,
    }, { headers: corsHeaders })
  } catch (error) {
    console.error('[Extension API] POST retry-failed exception:', error)
    return NextResponse.json(
      {
        success: false,
        reset: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500, headers: corsHeaders }
    )
  }
}
