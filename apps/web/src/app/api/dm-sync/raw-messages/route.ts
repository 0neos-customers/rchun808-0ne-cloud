import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@0ne/db/server'
import { sanitizeForPostgrestFilter } from '@/lib/postgrest-utils'

export const dynamic = 'force-dynamic'

interface RawMessage {
  id: string
  skool_conversation_id: string
  skool_message_id: string
  skool_user_id: string
  sender_name: string | null
  skool_username: string | null
  direction: 'inbound' | 'outbound'
  message_text: string | null
  status: 'synced' | 'pending' | 'failed'
  ghl_message_id: string | null
  ghl_contact_id: string | null
  ghl_location_id: string | null
  skool_community_slug: string | null
  created_at: string
  synced_at: string | null
}

interface RawMessagesResponse {
  messages: RawMessage[]
  summary: {
    total: number
    inbound: number
    outbound: number
    synced: number
    pending: number
    failed: number
  }
  pagination: {
    limit: number
    offset: number
    hasMore: boolean
  }
}

/**
 * GET /api/dm-sync/raw-messages
 * List raw DM messages captured by the extension
 * Query params: search, direction, status, conversation_id, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)

    const search = searchParams.get('search')?.trim() || ''
    const direction = searchParams.get('direction') // 'inbound' | 'outbound' | 'all'
    const status = searchParams.get('status') // 'synced' | 'pending' | 'failed' | 'all'
    const conversationId = searchParams.get('conversation_id')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Build query
    let query = supabase
      .from('dm_messages')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    // Apply filters
    if (search) {
      const safeSearch = sanitizeForPostgrestFilter(search)
      query = query.or(`message_text.ilike.%${safeSearch}%,sender_name.ilike.%${safeSearch}%`)
    }

    if (direction && direction !== 'all') {
      query = query.eq('direction', direction)
    }

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (conversationId) {
      query = query.eq('skool_conversation_id', conversationId)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: messages, count, error } = await query

    if (error) {
      console.error('[Raw Messages API] GET error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get summary stats (unfiltered totals for dashboard)
    const { data: allMessages } = await supabase
      .from('dm_messages')
      .select('direction, status')

    const summary = {
      total: allMessages?.length || 0,
      inbound: allMessages?.filter((m) => m.direction === 'inbound').length || 0,
      outbound: allMessages?.filter((m) => m.direction === 'outbound').length || 0,
      synced: allMessages?.filter((m) => m.status === 'synced').length || 0,
      pending: allMessages?.filter((m) => m.status === 'pending').length || 0,
      failed: allMessages?.filter((m) => m.status === 'failed').length || 0,
    }

    // Enrich messages with contact mapping and sync config data
    if (messages && messages.length > 0) {
      // Get unique skool_user_ids and user_ids
      const skoolUserIds = [...new Set(messages.map((m) => m.skool_user_id))]
      const userIds = [...new Set(messages.map((m) => m.clerk_user_id))]

      // Get contact mappings for these users
      const { data: mappings } = await supabase
        .from('dm_contact_mappings')
        .select('skool_user_id, skool_username, ghl_contact_id')
        .in('skool_user_id', skoolUserIds)

      // Get sync configs for location and community slug
      const { data: configs } = await supabase
        .from('dm_sync_config')
        .select('clerk_user_id, ghl_location_id, skool_community_slug')
        .in('clerk_user_id', userIds)

      // Build lookup maps
      const mappingMap = new Map(
        mappings?.map((m) => [m.skool_user_id, m]) || []
      )
      const configMap = new Map(
        configs?.map((c) => [c.clerk_user_id, c]) || []
      )

      // Enrich messages
      const enrichedMessages: RawMessage[] = messages.map((msg) => {
        const mapping = mappingMap.get(msg.skool_user_id)
        const config = configMap.get(msg.clerk_user_id)

        return {
          id: msg.id,
          skool_conversation_id: msg.skool_conversation_id,
          skool_message_id: msg.skool_message_id,
          skool_user_id: msg.skool_user_id,
          sender_name: msg.sender_name,
          skool_username: mapping?.skool_username || null,
          direction: msg.direction,
          message_text: msg.message_text,
          status: msg.status,
          ghl_message_id: msg.ghl_message_id,
          ghl_contact_id: mapping?.ghl_contact_id || null,
          ghl_location_id: config?.ghl_location_id || null,
          skool_community_slug: config?.skool_community_slug || null,
          created_at: msg.created_at,
          synced_at: msg.synced_at,
        }
      })

      return NextResponse.json({
        messages: enrichedMessages,
        summary,
        pagination: {
          limit,
          offset,
          hasMore: (count || 0) > offset + limit,
        },
      } as RawMessagesResponse)
    }

    return NextResponse.json({
      messages: [],
      summary,
      pagination: {
        limit,
        offset,
        hasMore: false,
      },
    } as RawMessagesResponse)
  } catch (error) {
    console.error('[Raw Messages API] GET exception:', error)
    return NextResponse.json(
      { error: 'Failed to fetch raw messages', details: String(error) },
      { status: 500 }
    )
  }
}
