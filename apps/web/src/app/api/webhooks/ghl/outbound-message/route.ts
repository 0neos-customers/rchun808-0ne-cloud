/**
 * GHL Outbound Message Webhook
 *
 * Handles outbound messages from GHL when a user replies in the unified inbox
 * to a Skool conversation. This webhook is triggered by the GHL Conversation
 * Provider system.
 *
 * Flow:
 * 1. User replies in GHL inbox to Skool thread
 * 2. GHL sends webhook to this endpoint
 * 3. We verify signature and parse payload
 * 4. Look up Skool user from dm_contact_mappings
 * 5. Queue message for sending via Skool API
 *
 * POST /api/webhooks/ghl/outbound-message
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@0ne/db/server'
import {
  verifyGhlWebhookSignature,
  type GhlOutboundMessagePayload,
} from '@/features/dm-sync/lib/ghl-conversation'
import {
  resolveOutboundStaff,
  formatOutboundMessage,
} from '@/features/dm-sync/lib/staff-users'

// Disable body parsing - we need raw body for signature verification
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Database row type for dm_messages
 */
interface DmMessageInsert {
  user_id: string
  skool_conversation_id: string
  skool_message_id: string
  ghl_message_id: string | null
  skool_user_id: string
  direction: 'inbound' | 'outbound'
  message_text: string | null
  status: 'synced' | 'pending' | 'failed'
  // Phase 5: Multi-staff support
  staff_skool_id?: string | null
  staff_display_name?: string | null
  ghl_user_id?: string | null
}

/**
 * Contact mapping row from database
 */
interface ContactMappingRow {
  id: string
  user_id: string
  skool_user_id: string
  skool_username: string | null
  skool_display_name: string | null
  ghl_contact_id: string
}

export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    // 1. Get raw body for signature verification
    const rawBody = await request.text()

    // 2. Verify webhook signature
    const signature = request.headers.get('x-ghl-signature') || ''

    if (!verifyGhlWebhookSignature(rawBody, signature)) {
      console.error('[GHL Webhook] Invalid signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // 3. Parse payload
    let payload: GhlOutboundMessagePayload
    try {
      payload = JSON.parse(rawBody) as GhlOutboundMessagePayload
    } catch {
      console.error('[GHL Webhook] Invalid JSON payload')
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }

    // 4. Validate required fields
    const { contactId, body, conversationId, locationId, messageId } = payload

    if (!contactId || !body || !conversationId || !locationId) {
      console.error('[GHL Webhook] Missing required fields:', {
        hasContactId: !!contactId,
        hasBody: !!body,
        hasConversationId: !!conversationId,
        hasLocationId: !!locationId,
      })
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    console.log('[GHL Webhook] Processing outbound message:', {
      contactId,
      conversationId,
      locationId,
      messageLength: body.length,
      messageId,
      replyToAltId: payload.replyToAltId,
    })

    // 5. Look up Skool user from dm_contact_mappings (by ghl_contact_id)
    const supabase = createServerClient()

    const { data: mapping, error: mappingError } = await supabase
      .from('dm_contact_mappings')
      .select('*')
      .eq('ghl_contact_id', contactId)
      .single()

    if (mappingError || !mapping) {
      console.error('[GHL Webhook] Contact mapping not found:', {
        contactId,
        error: mappingError?.message,
      })
      // Return 200 to acknowledge receipt - we can't process but shouldn't retry
      return NextResponse.json({
        success: false,
        error: 'Contact mapping not found',
        contactId,
      })
    }

    const typedMapping = mapping as ContactMappingRow

    console.log('[GHL Webhook] Found Skool mapping:', {
      skoolUserId: typedMapping.skool_user_id,
      skoolUsername: typedMapping.skool_username,
      userId: typedMapping.user_id,
    })

    // 6. Phase 5: Resolve which staff should send this message
    // Extract GHL user ID from payload if available (depends on GHL webhook format)
    // GHL webhook may include userId field for the sender
    const ghlSenderUserId = (payload as unknown as Record<string, unknown>).userId as string | undefined

    const { staff, processedMessage } = await resolveOutboundStaff(
      typedMapping.user_id,
      body,
      ghlSenderUserId,
      typedMapping.skool_user_id
    )

    console.log('[GHL Webhook] Resolved staff for outbound:', {
      staffSkoolId: staff?.skoolUserId,
      staffDisplayName: staff?.displayName,
      matchMethod: staff?.matchMethod,
      hasOverride: processedMessage !== body,
    })

    // 7. Get or create a placeholder conversation ID for Skool
    // In real sync, this would come from an existing Skool conversation
    // For now, we'll use the GHL conversation ID as a placeholder
    const skoolConversationId = `ghl:${conversationId}`

    // Generate a unique message ID for Skool (will be updated when actually sent)
    const pendingSkoolMessageId = `pending:${Date.now()}:${Math.random().toString(36).substring(7)}`

    // 8. Format message with staff prefix if we have a staff member
    const finalMessageText = staff
      ? formatOutboundMessage(staff.displayName, processedMessage)
      : processedMessage

    // 9. Queue message for sending via Skool API
    // Insert into dm_messages with direction='outbound', status='pending'
    const messageInsert: DmMessageInsert = {
      user_id: typedMapping.user_id,
      skool_conversation_id: skoolConversationId,
      skool_message_id: pendingSkoolMessageId,
      ghl_message_id: messageId || null,
      skool_user_id: typedMapping.skool_user_id,
      direction: 'outbound',
      message_text: finalMessageText,
      status: 'pending',
      // Phase 5: Multi-staff attribution
      staff_skool_id: staff?.skoolUserId || null,
      staff_display_name: staff?.displayName || null,
      ghl_user_id: ghlSenderUserId || null,
    }

    const { data: insertedMessage, error: insertError } = await supabase
      .from('dm_messages')
      .insert(messageInsert)
      .select('id')
      .single()

    if (insertError) {
      console.error('[GHL Webhook] Failed to queue message:', insertError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to queue message',
          details: insertError.message,
        },
        { status: 500 }
      )
    }

    const duration = Date.now() - startTime

    console.log('[GHL Webhook] Message queued successfully:', {
      queuedMessageId: insertedMessage?.id,
      skoolUserId: typedMapping.skool_user_id,
      skoolUsername: typedMapping.skool_username,
      duration,
    })

    // 8. Return 200 OK
    return NextResponse.json({
      success: true,
      queued: true,
      messageId: insertedMessage?.id,
      skoolUserId: typedMapping.skool_user_id,
      duration,
    })
  } catch (error) {
    console.error('[GHL Webhook] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Health check endpoint
 * GHL may ping this to verify the webhook URL is active
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/webhooks/ghl/outbound-message',
    description: 'GHL outbound message webhook for Skool DM sync',
    timestamp: new Date().toISOString(),
  })
}
