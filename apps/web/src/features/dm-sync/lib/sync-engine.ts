/**
 * DM Sync Engine
 *
 * Syncs extension-captured Skool DMs to GHL conversations.
 * Server-side Skool API calls are no longer used (AWS WAF blocks them).
 * The Chrome extension captures messages and pushes them to this app.
 *
 * @module dm-sync/lib/sync-engine
 */

import { createServerClient } from '@0ne/db/server'
import type {
  DmSyncConfig,
  SkoolConversation,
  DmMessageRow,
} from '../types'
import { findOrCreateGhlContact } from './contact-mapper'
import {
  GhlConversationProviderClient,
  createGhlConversationProviderClientWithPersistence,
} from './ghl-conversation'
import { getStoredTokens } from './ghl-token-store'
import {
  getStaffBySkoolId,
  formatInboundMessage,
  formatOutboundMessage,
} from './staff-users'

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Rate limit delay between API requests (ms) */
const REQUEST_DELAY_MS = 200

// =============================================================================
// RESULT TYPES
// =============================================================================

/**
 * Result from extension message sync operation
 */
export interface ExtensionSyncResult {
  synced: number
  skipped: number
  errors: number
  errorDetails: Array<{
    messageId?: string
    conversationId?: string
    error: string
  }>
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
// EXTENSION MESSAGE SYNC
// =============================================================================

/**
 * Group array items by a key
 */
function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce(
    (result, item) => {
      const groupKey = String(item[key])
      if (!result[groupKey]) {
        result[groupKey] = []
      }
      result[groupKey].push(item)
      return result
    },
    {} as Record<string, T[]>
  )
}

/**
 * Sync extension-captured messages to GHL
 *
 * Processes messages in dm_messages that have ghl_message_id = NULL
 * These are messages captured by the Chrome extension that haven't
 * been pushed to GHL yet.
 *
 * @param userId - The user ID for multi-tenant support
 * @returns ExtensionSyncResult with counts
 */
export async function syncExtensionMessages(
  userId: string
): Promise<ExtensionSyncResult> {
  const supabase = createServerClient()
  const result: ExtensionSyncResult = {
    synced: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
  }

  console.log(`[Sync Engine] Starting extension message sync for user: ${userId}`)

  try {
    // 1. Get user's sync config
    const { data: syncConfig, error: configError } = await supabase
      .from('dm_sync_config')
      .select('*')
      .eq('clerk_user_id', userId)
      .eq('enabled', true)
      .single()

    if (configError || !syncConfig) {
      console.log(`[Sync Engine] No enabled sync config for user: ${userId}`)
      return result
    }

    // 2. Get stored GHL tokens
    const storedTokens = await getStoredTokens(userId)

    // 3. Create GHL client with persistence
    const ghlClient = await createGhlConversationProviderClientWithPersistence(
      userId,
      syncConfig.ghl_location_id,
      process.env.GHL_CONVERSATION_PROVIDER_ID?.trim(),
      storedTokens
        ? {
            refreshToken: storedTokens.refreshToken,
            accessToken: storedTokens.accessToken,
            expiresAt: storedTokens.expiresAt,
          }
        : undefined
    )

    // 4. Query messages with ghl_message_id IS NULL AND status = 'pending'
    // These are extension-captured messages that need to be synced to GHL
    const { data: pendingMessages, error: queryError } = await supabase
      .from('dm_messages')
      .select('*')
      .eq('clerk_user_id', userId)
      .eq('status', 'pending')
      .is('ghl_message_id', null)
      .order('created_at', { ascending: true })
      .limit(100) // Process up to 100 messages per run

    if (queryError) {
      throw new Error(`Failed to query pending messages: ${queryError.message}`)
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log('[Sync Engine] No extension messages to sync')
      return result
    }

    console.log(
      `[Sync Engine] Found ${pendingMessages.length} extension messages to sync`
    )

    // 5. Group by conversation for efficient contact lookup
    const messagesByConversation = groupBy(
      pendingMessages as DmMessageRow[],
      'skool_conversation_id'
    )

    // 6. Process each conversation
    for (const [conversationId, messages] of Object.entries(messagesByConversation)) {
      // Get the first message to extract skool_user_id for contact lookup
      const firstMessage = messages[0]
      const skoolUserId = firstMessage.skool_user_id

      try {
        // Find/create GHL contact for this Skool user
        const contactResult = await findOrCreateGhlContact(
          userId,
          skoolUserId,
          '', // We don't have username from the message
          ''  // We don't have displayName from the message
        )

        if (!contactResult.ghlContactId) {
          console.log(
            `[Sync Engine] Could not find/create GHL contact for Skool user ${skoolUserId}, skipping conversation`
          )
          result.skipped += messages.length
          continue
        }

        const ghlContactId = contactResult.ghlContactId

        // Process each message in this conversation
        for (const message of messages) {
          try {
            // Skip messages with no content
            const messageContent = message.message_text || ''
            if (!messageContent.trim()) {
              console.log(
                `[Sync Engine] Skipping empty extension message ${message.id}`
              )
              result.skipped++
              continue
            }

            // Phase 5: Get staff info for message attribution
            let formattedContent = messageContent
            let staffInfo: { skoolUserId: string; displayName: string } | null = null

            // Check if message already has staff attribution
            if (message.staff_skool_id && message.staff_display_name) {
              staffInfo = {
                skoolUserId: message.staff_skool_id,
                displayName: message.staff_display_name,
              }
            } else {
              // Try to look up staff by the sender's Skool ID
              const staffUser = await getStaffBySkoolId(
                message.direction === 'outbound' ? userId : message.skool_user_id
              )
              if (staffUser) {
                staffInfo = {
                  skoolUserId: staffUser.skool_user_id,
                  displayName: staffUser.display_name,
                }
              }
            }

            // Format message with staff prefix
            if (staffInfo) {
              if (message.direction === 'outbound') {
                formattedContent = formatOutboundMessage(
                  staffInfo.displayName,
                  messageContent
                )
              } else {
                // For inbound, use sender_name if available
                const senderName = message.sender_name || 'Contact'
                formattedContent = formatInboundMessage(
                  senderName,
                  staffInfo.displayName,
                  messageContent
                )
              }
            }

            // Push to GHL using appropriate endpoint based on direction
            let ghlMessageId: string

            if (message.direction === 'outbound') {
              // Outbound message (from Jimmy to contact) - appears on RIGHT side in GHL
              console.log(
                `[Sync Engine] Syncing extension outbound: ${message.id} (staff: ${staffInfo?.displayName || 'none'})`
              )
              ghlMessageId = await ghlClient.pushOutboundMessage(
                syncConfig.ghl_location_id,
                ghlContactId,
                skoolUserId,
                formattedContent,
                message.skool_message_id
              )
            } else {
              // Inbound message (from contact to Jimmy) - appears on LEFT side in GHL
              console.log(
                `[Sync Engine] Syncing extension inbound: ${message.id} (staff: ${staffInfo?.displayName || 'none'})`
              )
              ghlMessageId = await ghlClient.pushInboundMessage(
                syncConfig.ghl_location_id,
                ghlContactId,
                skoolUserId,
                formattedContent,
                message.skool_message_id
              )
            }

            // Update row with ghl_message_id, status='synced', synced_at, and staff info
            const { error: updateError } = await supabase
              .from('dm_messages')
              .update({
                ghl_message_id: ghlMessageId,
                status: 'synced',
                synced_at: new Date().toISOString(),
                // Phase 5: Update staff attribution if we resolved it
                ...(staffInfo && !message.staff_skool_id
                  ? {
                      staff_skool_id: staffInfo.skoolUserId,
                      staff_display_name: staffInfo.displayName,
                    }
                  : {}),
              })
              .eq('id', message.id)

            if (updateError) {
              throw new Error(
                `Failed to update message status: ${updateError.message}`
              )
            }

            result.synced++
            console.log(
              `[Sync Engine] Synced extension message ${message.id} -> ${ghlMessageId}`
            )

            // Rate limiting
            await delay(REQUEST_DELAY_MS)
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error)
            console.error(
              `[Sync Engine] Error syncing extension message ${message.id}:`,
              errorMessage
            )
            result.errors++
            result.errorDetails.push({
              messageId: message.id,
              conversationId,
              error: errorMessage,
            })

            // Mark message as failed
            await supabase
              .from('dm_messages')
              .update({ status: 'failed' })
              .eq('id', message.id)
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(
          `[Sync Engine] Error processing extension conversation ${conversationId}:`,
          errorMessage
        )
        result.errors += messages.length
        result.errorDetails.push({
          conversationId,
          error: errorMessage,
        })
      }
    }

    console.log(
      `[Sync Engine] Extension sync complete: synced=${result.synced}, skipped=${result.skipped}, errors=${result.errors}`
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(
      '[Sync Engine] Fatal error during extension sync:',
      errorMessage
    )
    result.errors++
    result.errorDetails.push({
      error: `Fatal sync error: ${errorMessage}`,
    })
  }

  return result
}

// =============================================================================
// QUERY HELPERS
// =============================================================================

/**
 * Get all users with active hand-raiser campaigns
 */
export async function getUsersWithActiveHandRaisers(): Promise<
  Array<{ clerk_user_id: string }>
> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('dm_hand_raiser_campaigns')
    .select('clerk_user_id')
    .eq('is_active', true)

  if (error) {
    console.error('[Sync Engine] Error fetching hand-raiser users:', error.message)
    return []
  }

  // Deduplicate user IDs
  const uniqueUserIds = [...new Set((data || []).map((d) => d.clerk_user_id))]
  return uniqueUserIds.map((clerk_user_id) => ({ clerk_user_id }))
}

/**
 * Get all enabled sync configs for cron processing
 */
export async function getEnabledSyncConfigs(): Promise<
  Array<{ clerk_user_id: string; skool_community_slug: string; ghl_location_id: string }>
> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('dm_sync_config')
    .select('clerk_user_id, skool_community_slug, ghl_location_id')
    .eq('enabled', true)

  if (error) {
    console.error('[Sync Engine] Error fetching sync configs:', error.message)
    return []
  }

  return data || []
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
