import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@0ne/db/server'

export const dynamic = 'force-dynamic'

interface SendMessageRequest {
  message: string
  staffSkoolId: string
}

interface SendMessageResponse {
  success: boolean
  messageId: string
  status: 'pending'
}

/**
 * POST /api/dm-sync/conversations/[id]/send
 * Queue an outbound message for delivery via the Chrome extension
 *
 * Flow:
 * 1. Insert into dm_messages with status='pending', direction='outbound'
 * 2. Extension polls GET /api/extension/get-pending
 * 3. Extension delivers via Skool UI
 * 4. Extension confirms via POST /api/extension/confirm-sent
 * 5. Cron syncs to GHL
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params
    const supabase = createServerClient()
    const body = await request.json() as SendMessageRequest

    const { message, staffSkoolId } = body

    // Validate required fields
    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      )
    }

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    if (!staffSkoolId) {
      return NextResponse.json(
        { error: 'Staff Skool ID is required' },
        { status: 400 }
      )
    }

    // Get the participant's skool_user_id from an existing message in this conversation
    const { data: existingMessage } = await supabase
      .from('dm_messages')
      .select('skool_user_id, clerk_user_id')
      .eq('skool_conversation_id', conversationId)
      .eq('direction', 'inbound')
      .limit(1)
      .single()

    if (!existingMessage) {
      return NextResponse.json(
        { error: 'Conversation not found or has no inbound messages' },
        { status: 404 }
      )
    }

    // Generate a synthetic skool_message_id for the outbound message
    // Format: inbox-{timestamp}-{random} to distinguish from real Skool IDs
    const syntheticMessageId = `inbox-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

    // Insert the outbound message as pending
    const { data: newMessage, error: insertError } = await supabase
      .from('dm_messages')
      .insert({
        clerk_user_id: existingMessage.clerk_user_id,
        skool_conversation_id: conversationId,
        skool_message_id: syntheticMessageId,
        skool_user_id: existingMessage.skool_user_id, // The recipient
        direction: 'outbound',
        message_text: message.trim(),
        status: 'pending',
        staff_skool_id: staffSkoolId,
        source: 'manual',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[Send Message API] INSERT error:', insertError)
      return NextResponse.json(
        { error: 'Failed to queue message', details: insertError.message },
        { status: 500 }
      )
    }

    console.log('[Send Message API] Queued message:', {
      messageId: newMessage.id,
      conversationId,
      syntheticMessageId,
    })

    return NextResponse.json({
      success: true,
      messageId: newMessage.id,
      status: 'pending',
    } as SendMessageResponse)
  } catch (error) {
    console.error('[Send Message API] POST exception:', error)
    return NextResponse.json(
      { error: 'Failed to send message', details: String(error) },
      { status: 500 }
    )
  }
}
