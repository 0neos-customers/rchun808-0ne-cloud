import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@0ne/db/server'
import { corsHeaders, validateExtensionAuth } from '@/lib/extension-auth'

export { OPTIONS } from '@/lib/extension-auth'

export const dynamic = 'force-dynamic'

/**
 * Conversation Sync Status API
 *
 * Returns sync status for given conversation IDs
 * Used by the extension to know which conversations have been synced
 * and where to resume from for incremental sync.
 */

// =============================================
// Types
// =============================================

interface ConversationSyncState {
  conversationId: string
  participantName?: string
  lastSyncedMessageId: string | null
  lastSyncedMessageTime: string | null
  backfillComplete: boolean
  lastSyncTime: number
  totalMessagesSynced: number
}

interface GetSyncStatusRequest {
  staffSkoolId: string
  conversationIds: string[]
}

interface GetSyncStatusResponse {
  success: boolean
  conversations: ConversationSyncState[]
  error?: string
}

// =============================================
// POST /api/extension/conversation-sync-status
// =============================================

export async function POST(request: NextRequest) {
  // Validate auth
  const authResult = await validateExtensionAuth(request)
  if (!authResult.valid) {
    return NextResponse.json(
      { success: false, conversations: [], error: authResult.error },
      { status: 401, headers: corsHeaders }
    )
  }

  try {
    const body: GetSyncStatusRequest = await request.json()

    // If using Clerk auth and staffSkoolId not provided, use linked Skool ID
    if (authResult.authType === 'clerk' && !body.staffSkoolId && authResult.skoolUserId) {
      body.staffSkoolId = authResult.skoolUserId
    }

    // Validate request
    if (!body.staffSkoolId?.trim()) {
      return NextResponse.json(
        { success: false, conversations: [], error: 'Missing required field: staffSkoolId' },
        { status: 400, headers: corsHeaders }
      )
    }

    if (!Array.isArray(body.conversationIds)) {
      return NextResponse.json(
        { success: false, conversations: [], error: 'conversationIds must be an array' },
        { status: 400, headers: corsHeaders }
      )
    }

    const { staffSkoolId, conversationIds } = body

    console.log(
      `[Extension API] Getting sync status for ${conversationIds.length} conversations (staff: ${staffSkoolId})`
    )

    // If no conversation IDs provided, return empty array
    if (conversationIds.length === 0) {
      return NextResponse.json(
        { success: true, conversations: [] } as GetSyncStatusResponse,
        { headers: corsHeaders }
      )
    }

    const supabase = createServerClient()

    // Fetch sync status for all requested conversations
    const { data, error } = await supabase
      .from('conversation_sync_status')
      .select('*')
      .eq('staff_skool_id', staffSkoolId)
      .in('conversation_id', conversationIds)

    if (error) {
      console.error('[Extension API] Error fetching sync status:', error)
      return NextResponse.json(
        { success: false, conversations: [], error: error.message },
        { status: 500, headers: corsHeaders }
      )
    }

    // Map database rows to response format
    const conversations: ConversationSyncState[] = (data || []).map((row) => ({
      conversationId: row.conversation_id,
      participantName: row.participant_name || undefined,
      lastSyncedMessageId: row.last_synced_message_id,
      lastSyncedMessageTime: row.last_synced_message_time,
      backfillComplete: row.backfill_complete ?? false,
      lastSyncTime: row.last_sync_time ? new Date(row.last_sync_time).getTime() : Date.now(),
      totalMessagesSynced: row.total_messages_synced ?? 0,
    }))

    console.log(
      `[Extension API] Returning sync status for ${conversations.length} conversations`
    )

    const response: GetSyncStatusResponse = {
      success: true,
      conversations,
    }

    return NextResponse.json(response, { headers: corsHeaders })
  } catch (error) {
    console.error('[Extension API] POST exception:', error)
    return NextResponse.json(
      {
        success: false,
        conversations: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      } as GetSyncStatusResponse,
      { status: 500, headers: corsHeaders }
    )
  }
}
