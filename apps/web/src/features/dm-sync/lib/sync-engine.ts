/**
 * DM Sync Engine
 *
 * Orchestrates bidirectional sync between Skool DMs and GHL conversations.
 * Handles deduplication, error recovery, and rate limiting.
 *
 * @module dm-sync/lib/sync-engine
 */

import { createServerClient } from '@0ne/db/server'
import type {
  DmSyncConfig,
  SyncResult,
  SyncError,
  SkoolConversation,
  SkoolMessage,
  DmMessageRow,
  HandRaiserResult,
  HandRaiserCampaignRow,
} from '../types'
import { SkoolDmClient, createSkoolDmClient } from './skool-dm-client'
import { ContactMapper, findOrCreateGhlContact } from './contact-mapper'
import {
  GhlConversationClient,
  GhlConversationProviderClient,
  createGhlConversationProviderClientWithPersistence,
} from './ghl-conversation'
import { getStoredTokens } from './ghl-token-store'

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Rate limit delay between API requests (ms) */
const REQUEST_DELAY_MS = 200

/** Maximum conversations to sync in a single run */
const DEFAULT_MAX_CONVERSATIONS = 25 // Skool API max limit is 25

/** Maximum messages per conversation to sync */
const DEFAULT_MAX_MESSAGES_PER_CONVERSATION = 100

// =============================================================================
// RESULT TYPES
// =============================================================================

/**
 * Result from inbound sync operation
 */
export interface InboundSyncResult {
  synced: number
  skipped: number
  errors: number
  errorDetails: SyncError[]
  debugInfo?: {
    currentUserId: string
    conversations: Array<{
      participantId: string
      participantUsername: string
      messageCount: number
      inboundCount: number
      outboundCount: number
    }>
  }
}

/**
 * Result from outbound send operation
 */
export interface SendPendingResult {
  sent: number
  failed: number
  errorDetails: SyncError[]
}

// =============================================================================
// SYNC ENGINE CONFIGURATION
// =============================================================================

/**
 * Sync engine configuration
 */
export interface SyncEngineConfig {
  config: DmSyncConfig
  skoolCookies: string
  ghlApiKey: string
}

/**
 * Sync options
 */
export interface SyncOptions {
  /** Maximum conversations to sync per run */
  maxConversations?: number
  /** Maximum messages per conversation */
  maxMessagesPerConversation?: number
  /** Sync only conversations with new messages since this date */
  since?: Date
  /** Dry run - don't actually send/store anything */
  dryRun?: boolean
}

// =============================================================================
// STANDALONE SYNC FUNCTIONS
// =============================================================================

/**
 * Sync inbound messages from Skool to GHL
 *
 * 1. Get inbox from Skool using SkoolDmClient
 * 2. For each conversation, get messages
 * 3. Skip messages already in dm_messages table (deduplication)
 * 4. Skip outbound messages (we sent them)
 * 5. Find/create GHL contact using findOrCreateGhlContact()
 * 6. Push message to GHL using GhlConversationProviderClient
 * 7. Insert into dm_messages with status='synced'
 *
 * @param userId - The user ID for multi-tenant support
 * @returns Sync result with counts
 */
export async function syncInboundMessages(
  userId: string
): Promise<InboundSyncResult> {
  const supabase = createServerClient()
  const result: InboundSyncResult = {
    synced: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
    debugInfo: {
      currentUserId: '',
      conversations: [],
    },
  }

  console.log(`[Sync Engine] Starting inbound sync for user: ${userId}`)

  try {
    // Get user's sync config
    const { data: syncConfig, error: configError } = await supabase
      .from('dm_sync_config')
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true)
      .single()

    if (configError || !syncConfig) {
      console.log(`[Sync Engine] No enabled sync config for user: ${userId}`)
      return result
    }

    // Initialize clients
    const skoolClient = createSkoolDmClient(syncConfig.skool_community_slug)

    // Get stored tokens from database (falls back to env vars)
    const storedTokens = await getStoredTokens(userId)

    // Create GHL client with token persistence
    const ghlClient = await createGhlConversationProviderClientWithPersistence(
      userId,
      syncConfig.ghl_location_id,
      process.env.GHL_CONVERSATION_PROVIDER_ID,
      storedTokens ? {
        refreshToken: storedTokens.refreshToken,
        accessToken: storedTokens.accessToken,
        expiresAt: storedTokens.expiresAt,
      } : undefined
    )

    // Get Skool inbox (conversations)
    const conversations = await skoolClient.getInbox(0, DEFAULT_MAX_CONVERSATIONS)
    console.log(`[Sync Engine] Found ${conversations.length} conversations`)

    // Process each conversation
    for (const conversation of conversations) {
      try {
        await processConversation(
          userId,
          conversation,
          syncConfig.ghl_location_id,
          skoolClient,
          ghlClient,
          supabase,
          result
        )

        // Rate limiting
        await delay(REQUEST_DELAY_MS)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(
          `[Sync Engine] Error processing conversation ${conversation.id}:`,
          errorMessage
        )
        result.errors++
        result.errorDetails.push({
          conversationId: conversation.id,
          error: errorMessage,
        })
      }
    }

    console.log(
      `[Sync Engine] Inbound sync complete: synced=${result.synced}, skipped=${result.skipped}, errors=${result.errors}`
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Sync Engine] Fatal error during inbound sync:', errorMessage)
    result.errors++
    result.errorDetails.push({
      error: `Fatal sync error: ${errorMessage}`,
    })
  }

  return result
}

/**
 * Process a single conversation for inbound sync
 */
async function processConversation(
  userId: string,
  conversation: SkoolConversation,
  ghlLocationId: string,
  skoolClient: SkoolDmClient,
  ghlClient: GhlConversationProviderClient,
  supabase: ReturnType<typeof createServerClient>,
  result: InboundSyncResult
): Promise<void> {
  // Get messages for this conversation
  const messages = await skoolClient.getMessages(
    conversation.channelId,
    '1' // Get all messages from beginning
  )

  console.log(
    `[Sync Engine] Processing ${messages.length} messages for conversation ${conversation.id}`
  )

  // Get current user's Skool ID for detecting outbound messages
  const currentUserId = await skoolClient.getCurrentUserId()

  // Get already synced message IDs for this conversation
  const { data: existingMessages } = await supabase
    .from('dm_messages')
    .select('skool_message_id')
    .eq('user_id', userId)
    .eq('skool_conversation_id', conversation.channelId)

  const syncedMessageIds = new Set(
    (existingMessages || []).map((m) => m.skool_message_id)
  )

  // Find/create GHL contact for this conversation's participant
  let ghlContactId: string | null = null

  // Collect debug info
  const inboundMessages = messages.filter(m => !m.isOutbound && m.senderId !== currentUserId)
  const outboundMessages = messages.filter(m => m.isOutbound || m.senderId === currentUserId)

  // Track skip reasons for debugging
  const skipReasons: string[] = []

  result.debugInfo?.conversations.push({
    participantId: conversation.participant.id,
    participantUsername: conversation.participant.username || 'unknown',
    messageCount: messages.length,
    inboundCount: inboundMessages.length,
    outboundCount: outboundMessages.length,
  })

  if (!result.debugInfo?.currentUserId) {
    result.debugInfo!.currentUserId = currentUserId
  }

  for (const message of messages) {
    // Skip already synced messages (deduplication)
    if (syncedMessageIds.has(message.id)) {
      console.log(`[Sync Engine] Skipping already synced: ${message.id}`)
      skipReasons.push(`msg:${message.id}:already_synced`)
      result.skipped++
      continue
    }

    // Determine if message is outbound (from Jimmy) or inbound (from contact)
    const isOutbound = message.isOutbound || message.senderId === currentUserId

    try {
      // Lazily find/create GHL contact on first message
      if (!ghlContactId) {
        const contactResult = await findOrCreateGhlContact(
          userId,
          conversation.participant.id,
          conversation.participant.username,
          conversation.participant.displayName
        )
        ghlContactId = contactResult.ghlContactId

        // Track contact creation result in debug
        if (result.debugInfo) {
          const convDebug = result.debugInfo.conversations.find(
            c => c.participantId === conversation.participant.id
          )
          if (convDebug) {
            (convDebug as any).ghlContactId = ghlContactId || 'NOT_FOUND'
            ;(convDebug as any).contactMatchMethod = contactResult.matchMethod || 'none'
          }
        }

        // Skip all messages if we can't create a contact (no email)
        if (!ghlContactId) {
          skipReasons.push(`msg:${message.id}:no_ghl_contact`)
          result.skipped++
          // Update debug with skip reasons before returning
          if (result.debugInfo) {
            const convDebug = result.debugInfo.conversations.find(
              c => c.participantId === conversation.participant.id
            )
            if (convDebug) {
              (convDebug as any).skipReasons = skipReasons
            }
          }
          return // Exit the entire conversation processing
        }
      }

      // Skip messages with no content
      const messageContent = message.content || ''
      if (!messageContent.trim()) {
        console.log(`[Sync Engine] Skipping empty message ${message.id}`)
        skipReasons.push(`msg:${message.id}:empty_content`)
        result.skipped++
        continue
      }

      // Push message to GHL using appropriate endpoint based on direction
      let ghlMessageId: string

      if (isOutbound) {
        // Outbound message (from Jimmy to contact) - appears on RIGHT side in GHL
        console.log(`[Sync Engine] Syncing outbound: ${message.id} (from Jimmy)`)
        ghlMessageId = await ghlClient.pushOutboundMessage(
          ghlLocationId,
          ghlContactId,
          conversation.participant.id,
          messageContent,
          message.id
        )
      } else {
        // Inbound message (from contact to Jimmy) - appears on LEFT side in GHL
        console.log(`[Sync Engine] Syncing inbound: ${message.id} (from contact)`)
        ghlMessageId = await ghlClient.pushInboundMessage(
          ghlLocationId,
          ghlContactId,
          conversation.participant.id,
          messageContent,
          message.id
        )
      }

      // Record in dm_messages table
      const messageRow: Omit<DmMessageRow, 'id'> = {
        user_id: userId,
        skool_conversation_id: conversation.channelId,
        skool_message_id: message.id,
        ghl_message_id: ghlMessageId,
        skool_user_id: message.senderId,
        direction: isOutbound ? 'outbound' : 'inbound',
        message_text: messageContent,
        status: 'synced',
        created_at: message.sentAt.toISOString(),
        synced_at: new Date().toISOString(),
      }

      const { error: insertError } = await supabase
        .from('dm_messages')
        .insert(messageRow)

      if (insertError) {
        throw new Error(`Failed to record synced message: ${insertError.message}`)
      }

      result.synced++
      skipReasons.push(`msg:${message.id}:SYNCED_${isOutbound ? 'OUTBOUND' : 'INBOUND'}`)
      console.log(`[Sync Engine] Synced ${isOutbound ? 'outbound' : 'inbound'} message ${message.id} -> ${ghlMessageId}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[Sync Engine] Error syncing message ${message.id}:`, errorMessage)
      skipReasons.push(`msg:${message.id}:error:${errorMessage.substring(0, 50)}`)
      result.errors++
      result.errorDetails.push({
        messageId: message.id,
        conversationId: conversation.channelId,
        error: errorMessage,
      })
    }
  }

  // Update debug with skip reasons and message previews
  if (result.debugInfo) {
    const convDebug = result.debugInfo.conversations.find(
      c => c.participantId === conversation.participant.id
    )
    if (convDebug) {
      // Store in local const to avoid TS confusion
      const reasons = skipReasons
      const convDebugAny = convDebug as any
      convDebugAny.skipReasons = reasons
      // Add message content preview for first few messages
      convDebugAny.messagePreview = messages.slice(0, 3).map(m => ({
        id: m.id,
        contentLength: (m.content || '').length,
        contentPreview: (m.content || '').substring(0, 50),
        senderId: m.senderId,
        isOutbound: m.isOutbound,
      }))
    }
  }
}

/**
 * Send pending outbound messages via Skool
 *
 * 1. Query dm_messages where direction='outbound' AND status='pending'
 * 2. For each pending message:
 *    - Get skool_conversation_id (or find/create conversation)
 *    - Send via SkoolDmClient.sendMessage()
 *    - Update status to 'sent'
 *
 * @param userId - The user ID for multi-tenant support
 * @returns Send result with counts
 */
export async function sendPendingMessages(
  userId: string
): Promise<SendPendingResult> {
  const supabase = createServerClient()
  const result: SendPendingResult = {
    sent: 0,
    failed: 0,
    errorDetails: [],
  }

  console.log(`[Sync Engine] Starting outbound send for user: ${userId}`)

  try {
    // Get user's sync config
    const { data: syncConfig, error: configError } = await supabase
      .from('dm_sync_config')
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true)
      .single()

    if (configError || !syncConfig) {
      console.log(`[Sync Engine] No enabled sync config for user: ${userId}`)
      return result
    }

    // Initialize Skool client
    const skoolClient = createSkoolDmClient(syncConfig.skool_community_slug)

    // Get pending outbound messages
    const { data: pendingMessages, error: queryError } = await supabase
      .from('dm_messages')
      .select('*')
      .eq('user_id', userId)
      .eq('direction', 'outbound')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50) // Process up to 50 messages per run

    if (queryError) {
      throw new Error(`Failed to query pending messages: ${queryError.message}`)
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log('[Sync Engine] No pending outbound messages')
      return result
    }

    console.log(`[Sync Engine] Found ${pendingMessages.length} pending messages`)

    // Process each pending message
    for (const message of pendingMessages) {
      try {
        // Get the Skool conversation ID
        let conversationId = message.skool_conversation_id

        // If no conversation ID, try to find/create one
        if (!conversationId && message.skool_user_id) {
          const conversation = await skoolClient.getOrCreateConversation(
            message.skool_user_id
          )
          conversationId = conversation.channelId

          // Update the message with the conversation ID
          await supabase
            .from('dm_messages')
            .update({ skool_conversation_id: conversationId })
            .eq('id', message.id)
        }

        if (!conversationId) {
          throw new Error('No conversation ID and unable to create one')
        }

        // Send the message via Skool
        const sendResult = await skoolClient.sendMessage(
          conversationId,
          message.message_text || ''
        )

        if (!sendResult.success) {
          throw new Error(sendResult.error || 'Failed to send message')
        }

        // Update message status to 'sent'
        const { error: updateError } = await supabase
          .from('dm_messages')
          .update({
            status: 'sent',
            skool_message_id: sendResult.skoolMessageId || message.skool_message_id,
            synced_at: new Date().toISOString(),
          })
          .eq('id', message.id)

        if (updateError) {
          console.error(
            `[Sync Engine] Failed to update message status:`,
            updateError.message
          )
        }

        result.sent++
        console.log(
          `[Sync Engine] Sent message ${message.id} -> ${sendResult.skoolMessageId}`
        )

        // Rate limiting with human-like delay (already in sendMessage, but add extra)
        await delay(REQUEST_DELAY_MS)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(
          `[Sync Engine] Error sending message ${message.id}:`,
          errorMessage
        )

        // Update status to 'failed'
        await supabase
          .from('dm_messages')
          .update({ status: 'failed' })
          .eq('id', message.id)

        result.failed++
        result.errorDetails.push({
          messageId: message.id,
          conversationId: message.skool_conversation_id,
          error: errorMessage,
        })
      }
    }

    console.log(
      `[Sync Engine] Outbound send complete: sent=${result.sent}, failed=${result.failed}`
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Sync Engine] Fatal error during outbound send:', errorMessage)
    result.failed++
    result.errorDetails.push({
      error: `Fatal send error: ${errorMessage}`,
    })
  }

  return result
}

/**
 * Process hand-raiser campaigns for a user
 *
 * 1. Get active campaigns for user
 * 2. For each campaign:
 *    - Parse post URL to get postId
 *    - Fetch comments via Skool API
 *    - Filter by keyword if set
 *    - Skip users already in dm_hand_raiser_sent
 *    - For new users:
 *      a. Find/create GHL contact
 *      b. Queue DM with template (insert into dm_messages)
 *      c. Tag contact in GHL if ghl_tag set
 *      d. Record in dm_hand_raiser_sent
 *
 * @param userId - The user ID for multi-tenant support
 * @returns HandRaiserResult with counts
 */
export async function processHandRaisers(
  userId: string
): Promise<HandRaiserResult> {
  const supabase = createServerClient()
  const result: HandRaiserResult = {
    campaignsProcessed: 0,
    commentsChecked: 0,
    dmsSent: 0,
    errors: 0,
    errorDetails: [],
  }

  console.log(`[Sync Engine] Starting hand-raiser processing for user: ${userId}`)

  try {
    // Get user's sync config for the Skool client
    const { data: syncConfig, error: configError } = await supabase
      .from('dm_sync_config')
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true)
      .single()

    if (configError || !syncConfig) {
      console.log(`[Sync Engine] No enabled sync config for user: ${userId}`)
      return result
    }

    // Get active hand-raiser campaigns for this user
    const { data: campaigns, error: campaignsError } = await supabase
      .from('dm_hand_raiser_campaigns')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (campaignsError) {
      throw new Error(`Failed to fetch campaigns: ${campaignsError.message}`)
    }

    if (!campaigns || campaigns.length === 0) {
      console.log(`[Sync Engine] No active hand-raiser campaigns for user: ${userId}`)
      return result
    }

    console.log(`[Sync Engine] Found ${campaigns.length} active campaigns`)

    // Initialize Skool client
    const skoolClient = createSkoolDmClient(syncConfig.skool_community_slug)

    // Process each campaign
    for (const campaign of campaigns as HandRaiserCampaignRow[]) {
      try {
        const campaignResult = await processHandRaiserCampaign(
          userId,
          campaign,
          syncConfig.ghl_location_id,
          skoolClient,
          supabase
        )

        result.campaignsProcessed++
        result.commentsChecked += campaignResult.commentsChecked
        result.dmsSent += campaignResult.dmsSent
        result.errors += campaignResult.errors

        // Rate limiting between campaigns
        await delay(REQUEST_DELAY_MS)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(
          `[Sync Engine] Error processing campaign ${campaign.id}:`,
          errorMessage
        )
        result.errors++
        result.errorDetails.push({
          campaignId: campaign.id,
          error: errorMessage,
        })
      }
    }

    console.log(
      `[Sync Engine] Hand-raiser processing complete: campaigns=${result.campaignsProcessed}, comments=${result.commentsChecked}, dms=${result.dmsSent}, errors=${result.errors}`
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Sync Engine] Fatal error during hand-raiser processing:', errorMessage)
    result.errors++
    result.errorDetails.push({
      error: `Fatal error: ${errorMessage}`,
    })
  }

  return result
}

/**
 * Process a single hand-raiser campaign
 */
async function processHandRaiserCampaign(
  userId: string,
  campaign: HandRaiserCampaignRow,
  ghlLocationId: string,
  skoolClient: SkoolDmClient,
  supabase: ReturnType<typeof createServerClient>
): Promise<{ commentsChecked: number; dmsSent: number; errors: number }> {
  const result = { commentsChecked: 0, dmsSent: 0, errors: 0 }

  console.log(`[Sync Engine] Processing campaign: ${campaign.id} for post: ${campaign.post_url}`)

  // Parse post URL to get postId and communitySlug
  let postId = campaign.skool_post_id
  let communitySlug: string | undefined

  if (!postId) {
    const parsed = skoolClient.parsePostIdFromUrl(campaign.post_url)
    postId = parsed.postId
    communitySlug = parsed.communitySlug

    // Update campaign with parsed postId for future runs
    await supabase
      .from('dm_hand_raiser_campaigns')
      .update({ skool_post_id: postId })
      .eq('id', campaign.id)
  }

  // Fetch comments for this post
  const comments = await skoolClient.getPostComments(postId, communitySlug)
  result.commentsChecked = comments.length

  console.log(`[Sync Engine] Found ${comments.length} comments on post`)

  if (comments.length === 0) {
    return result
  }

  // Get already-sent user IDs for this campaign
  const { data: sentRecords } = await supabase
    .from('dm_hand_raiser_sent')
    .select('skool_user_id')
    .eq('campaign_id', campaign.id)

  const sentUserIds = new Set((sentRecords || []).map((r) => r.skool_user_id))

  // Filter comments
  const newComments = comments.filter((comment) => {
    // Skip if already sent DM
    if (sentUserIds.has(comment.userId)) {
      return false
    }

    // Filter by keyword if configured
    if (campaign.keyword_filter) {
      const keywords = campaign.keyword_filter
        .split(',')
        .map((k) => k.trim().toLowerCase())
      const commentLower = comment.content.toLowerCase()
      const hasKeyword = keywords.some((keyword) =>
        commentLower.includes(keyword)
      )
      if (!hasKeyword) {
        return false
      }
    }

    return true
  })

  console.log(`[Sync Engine] ${newComments.length} new comments to process (after filtering)`)

  // Process each new commenter
  for (const comment of newComments) {
    try {
      // Find or create GHL contact
      const contactResult = await findOrCreateGhlContact(
        userId,
        comment.userId,
        comment.username,
        comment.displayName
      )

      // Tag contact in GHL if configured
      if (campaign.ghl_tag && contactResult.ghlContactId) {
        await tagGhlContact(contactResult.ghlContactId, campaign.ghl_tag)
      }

      // Prepare DM message from template
      const dmMessage = interpolateTemplate(campaign.dm_template, {
        name: comment.displayName || comment.username,
        username: comment.username,
      })

      // Get or create conversation with the user
      const conversation = await skoolClient.getOrCreateConversation(comment.userId)

      // Queue DM in dm_messages table with status 'pending'
      const messageRow: Omit<DmMessageRow, 'id'> = {
        user_id: userId,
        skool_conversation_id: conversation.channelId,
        skool_message_id: `hr-${campaign.id}-${comment.userId}-${Date.now()}`, // Synthetic ID for hand-raiser
        ghl_message_id: null,
        skool_user_id: comment.userId,
        direction: 'outbound',
        message_text: dmMessage,
        status: 'pending',
        created_at: new Date().toISOString(),
        synced_at: null,
      }

      const { error: insertError } = await supabase
        .from('dm_messages')
        .insert(messageRow)

      if (insertError) {
        throw new Error(`Failed to queue DM: ${insertError.message}`)
      }

      // Record in dm_hand_raiser_sent to prevent duplicates
      const { error: sentError } = await supabase
        .from('dm_hand_raiser_sent')
        .insert({
          campaign_id: campaign.id,
          skool_user_id: comment.userId,
        })

      if (sentError) {
        // Log but don't fail - the DM is already queued
        console.error(
          `[Sync Engine] Failed to record sent status: ${sentError.message}`
        )
      }

      result.dmsSent++
      console.log(
        `[Sync Engine] Queued hand-raiser DM for ${comment.username} (${comment.userId})`
      )

      // Rate limiting
      await delay(REQUEST_DELAY_MS)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(
        `[Sync Engine] Error processing commenter ${comment.userId}:`,
        errorMessage
      )
      result.errors++
    }
  }

  return result
}

/**
 * Tag a GHL contact with a specific tag
 */
async function tagGhlContact(
  contactId: string,
  tag: string
): Promise<void> {
  const GHL_API_BASE = 'https://services.leadconnectorhq.com'
  const apiKey = process.env.GHL_API_KEY

  if (!apiKey) {
    console.warn('[Sync Engine] GHL_API_KEY not set, skipping contact tagging')
    return
  }

  try {
    const response = await fetch(`${GHL_API_BASE}/contacts/${contactId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Version: '2021-07-28',
      },
      body: JSON.stringify({
        tags: [tag],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Sync Engine] Failed to tag contact: ${response.status} - ${errorText}`)
    } else {
      console.log(`[Sync Engine] Tagged contact ${contactId} with "${tag}"`)
    }
  } catch (error) {
    console.error('[Sync Engine] Error tagging contact:', error)
  }
}

/**
 * Interpolate template variables
 *
 * Supports: {{name}}, {{username}}
 */
function interpolateTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || match
  })
}

/**
 * Get all users with active hand-raiser campaigns
 */
export async function getUsersWithActiveHandRaisers(): Promise<
  Array<{ user_id: string }>
> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('dm_hand_raiser_campaigns')
    .select('user_id')
    .eq('is_active', true)

  if (error) {
    console.error('[Sync Engine] Error fetching hand-raiser users:', error.message)
    return []
  }

  // Deduplicate user IDs
  const uniqueUserIds = [...new Set((data || []).map((d) => d.user_id))]
  return uniqueUserIds.map((user_id) => ({ user_id }))
}

/**
 * Get all enabled sync configs for cron processing
 */
export async function getEnabledSyncConfigs(): Promise<
  Array<{ user_id: string; skool_community_slug: string; ghl_location_id: string }>
> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('dm_sync_config')
    .select('user_id, skool_community_slug, ghl_location_id')
    .eq('enabled', true)

  if (error) {
    console.error('[Sync Engine] Error fetching sync configs:', error.message)
    return []
  }

  return data || []
}

// =============================================================================
// SYNC ENGINE CLASS (Legacy - kept for backward compatibility)
// =============================================================================

/**
 * Engine for syncing Skool DMs to GHL conversations
 *
 * @example
 * ```ts
 * const engine = new DmSyncEngine({
 *   config: syncConfig,
 *   skoolCookies: process.env.SKOOL_COOKIES!,
 *   ghlApiKey: process.env.GHL_API_KEY!
 * })
 *
 * const result = await engine.syncInbound()
 * console.log(`Synced ${result.stats.synced} messages`)
 * ```
 */
export class DmSyncEngine {
  private config: DmSyncConfig
  private skoolClient: SkoolDmClient
  private ghlClient: GhlConversationClient
  private contactMapper: ContactMapper

  constructor(engineConfig: SyncEngineConfig) {
    this.config = engineConfig.config

    // Initialize clients
    this.skoolClient = new SkoolDmClient({
      cookies: engineConfig.skoolCookies,
      communitySlug: this.config.skoolCommunitySlug,
    })

    this.ghlClient = new GhlConversationClient({
      apiKey: engineConfig.ghlApiKey,
      locationId: this.config.ghlLocationId,
    })

    this.contactMapper = new ContactMapper({
      userId: this.config.userId,
      ghlLocationId: this.config.ghlLocationId,
      ghlApiKey: engineConfig.ghlApiKey,
    })
  }

  /**
   * Sync inbound messages from Skool to GHL
   */
  async syncInbound(_options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now()
    const result = await syncInboundMessages(this.config.userId)

    return {
      success: result.errors === 0,
      stats: {
        total: result.synced + result.skipped + result.errors,
        synced: result.synced,
        skipped: result.skipped,
        failed: result.errors,
      },
      errors: result.errorDetails,
      duration: Date.now() - startTime,
    }
  }

  /**
   * Sync outbound messages from GHL to Skool
   * (for messages sent in GHL that need to be echoed to Skool)
   */
  async syncOutbound(_options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now()
    const result = await sendPendingMessages(this.config.userId)

    return {
      success: result.failed === 0,
      stats: {
        total: result.sent + result.failed,
        synced: result.sent,
        skipped: 0,
        failed: result.failed,
      },
      errors: result.errorDetails,
      duration: Date.now() - startTime,
    }
  }

  /**
   * Full bidirectional sync
   */
  async sync(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now()
    const errors: SyncError[] = []

    let totalSynced = 0
    let totalSkipped = 0
    let totalFailed = 0
    let totalMessages = 0

    try {
      // Sync inbound messages
      const inboundResult = await this.syncInbound(options)
      totalMessages += inboundResult.stats.total
      totalSynced += inboundResult.stats.synced
      totalSkipped += inboundResult.stats.skipped
      totalFailed += inboundResult.stats.failed
      errors.push(...inboundResult.errors)
    } catch (error) {
      errors.push({
        error: `Inbound sync failed: ${error instanceof Error ? error.message : String(error)}`,
      })
    }

    try {
      // Sync outbound messages
      const outboundResult = await this.syncOutbound(options)
      totalMessages += outboundResult.stats.total
      totalSynced += outboundResult.stats.synced
      totalSkipped += outboundResult.stats.skipped
      totalFailed += outboundResult.stats.failed
      errors.push(...outboundResult.errors)
    } catch (error) {
      errors.push({
        error: `Outbound sync failed: ${error instanceof Error ? error.message : String(error)}`,
      })
    }

    return {
      success: errors.length === 0,
      stats: {
        total: totalMessages,
        synced: totalSynced,
        skipped: totalSkipped,
        failed: totalFailed,
      },
      errors,
      duration: Date.now() - startTime,
    }
  }

  /**
   * Check if a message has already been synced
   */
  async isMessageSynced(skoolMessageId: string): Promise<boolean> {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('dm_messages')
      .select('id')
      .eq('user_id', this.config.userId)
      .eq('skool_message_id', skoolMessageId)
      .single()

    return !!data
  }

  /**
   * Record a synced message
   */
  async recordSyncedMessage(
    skoolMessage: SkoolMessage,
    ghlMessageId: string
  ): Promise<DmMessageRow> {
    const supabase = createServerClient()

    const messageRow: Omit<DmMessageRow, 'id'> = {
      user_id: this.config.userId,
      skool_conversation_id: skoolMessage.conversationId,
      skool_message_id: skoolMessage.id,
      ghl_message_id: ghlMessageId,
      skool_user_id: skoolMessage.senderId,
      direction: skoolMessage.isOutbound ? 'outbound' : 'inbound',
      message_text: skoolMessage.content,
      status: 'synced',
      created_at: skoolMessage.sentAt.toISOString(),
      synced_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('dm_messages')
      .insert(messageRow)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to record synced message: ${error.message}`)
    }

    return data
  }

  /**
   * Get sync stats for the configuration
   */
  async getStats(): Promise<{
    totalConversations: number
    totalMessages: number
    lastSyncAt: Date | null
    pendingMessages: number
    failedMessages: number
  }> {
    const supabase = createServerClient()

    // Get unique conversations
    const { data: conversations } = await supabase
      .from('dm_messages')
      .select('skool_conversation_id')
      .eq('user_id', this.config.userId)

    const uniqueConversations = new Set(
      (conversations || []).map((c) => c.skool_conversation_id)
    )

    // Get message counts by status
    const { data: messages } = await supabase
      .from('dm_messages')
      .select('status, synced_at')
      .eq('user_id', this.config.userId)

    const totalMessages = messages?.length || 0
    const pendingMessages = messages?.filter((m) => m.status === 'pending').length || 0
    const failedMessages = messages?.filter((m) => m.status === 'failed').length || 0

    // Get last sync time
    const syncedMessages = messages?.filter((m) => m.synced_at) || []
    const lastSyncAt =
      syncedMessages.length > 0
        ? new Date(
            Math.max(
              ...syncedMessages.map((m) => new Date(m.synced_at!).getTime())
            )
          )
        : null

    return {
      totalConversations: uniqueConversations.size,
      totalMessages,
      lastSyncAt,
      pendingMessages,
      failedMessages,
    }
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a sync engine from configuration
 */
export function createSyncEngine(config: SyncEngineConfig): DmSyncEngine {
  return new DmSyncEngine(config)
}

/**
 * Create a sync engine from environment and database config
 */
export async function createSyncEngineFromConfig(
  configId: string
): Promise<DmSyncEngine> {
  const supabase = createServerClient()

  const { data: config, error } = await supabase
    .from('dm_sync_config')
    .select('*')
    .eq('id', configId)
    .single()

  if (error || !config) {
    throw new Error(`Sync config not found: ${configId}`)
  }

  return new DmSyncEngine({
    config: {
      id: config.id,
      userId: config.user_id,
      skoolCommunitySlug: config.skool_community_slug,
      ghlLocationId: config.ghl_location_id,
      enabled: config.enabled,
      createdAt: new Date(config.created_at),
      updatedAt: new Date(config.updated_at),
    },
    skoolCookies: process.env.SKOOL_COOKIES!,
    ghlApiKey: process.env.GHL_API_KEY!,
  })
}

// =============================================================================
// SYNC UTILITIES
// =============================================================================

/**
 * Delay helper for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Determine if conversation needs syncing
 */
export function needsSync(
  conversation: SkoolConversation,
  lastSyncAt: Date | null
): boolean {
  if (!lastSyncAt) return true
  if (!conversation.lastMessageAt) return false
  return conversation.lastMessageAt > lastSyncAt
}

/**
 * Calculate sync priority for a conversation
 */
export function calculateSyncPriority(
  conversation: SkoolConversation
): number {
  let priority = 0

  // Higher priority for unread messages
  if (conversation.unreadCount > 0) {
    priority += 100 + Math.min(conversation.unreadCount, 50)
  }

  // Higher priority for recent messages
  if (conversation.lastMessageAt) {
    const hoursSinceLastMessage =
      (Date.now() - conversation.lastMessageAt.getTime()) / (1000 * 60 * 60)
    if (hoursSinceLastMessage < 1) priority += 50
    else if (hoursSinceLastMessage < 24) priority += 25
    else if (hoursSinceLastMessage < 72) priority += 10
  }

  return priority
}

/**
 * Sort conversations by sync priority
 */
export function sortBySyncPriority(
  conversations: SkoolConversation[]
): SkoolConversation[] {
  return [...conversations].sort(
    (a, b) => calculateSyncPriority(b) - calculateSyncPriority(a)
  )
}
