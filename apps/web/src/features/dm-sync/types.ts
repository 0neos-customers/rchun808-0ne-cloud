/**
 * DM Sync Feature Types
 *
 * Type definitions for Skool → GHL DM synchronization,
 * contact mapping, and hand-raiser campaigns.
 */

// =============================================================================
// SKOOL DM TYPES (from Skool API)
// =============================================================================

/**
 * Skool user profile data
 */
export interface SkoolUser {
  id: string
  username: string
  displayName: string
  profileImage: string | null
  email?: string
}

/**
 * Skool conversation (DM thread)
 */
export interface SkoolConversation {
  id: string
  channelId: string
  participant: SkoolUser
  lastMessageAt: Date | null
  lastMessagePreview: string | null
  unreadCount: number
}

/**
 * Skool message within a conversation
 */
export interface SkoolMessage {
  id: string
  conversationId: string
  senderId: string
  content: string
  sentAt: Date
  isOutbound: boolean
}

// =============================================================================
// DATABASE ROW TYPES (match 027-dm-sync.sql + 035-rename-user-id-columns.sql)
// =============================================================================

/**
 * Database row for dm_sync_config table
 */
export interface DmSyncConfigRow {
  id: string
  clerk_user_id: string
  skool_community_slug: string
  ghl_location_id: string
  enabled: boolean
  created_at: string
  updated_at: string
}

/**
 * Database row for dm_contact_mappings table
 */
export interface ContactMappingRow {
  id: string
  clerk_user_id: string
  skool_user_id: string
  skool_username: string | null
  skool_display_name: string | null
  ghl_contact_id: string
  match_method: 'skool_id' | 'email' | 'name' | 'synthetic' | null
  created_at: string
}

/**
 * Database row for dm_messages table
 */
export interface DmMessageRow {
  id: string
  clerk_user_id: string
  skool_conversation_id: string
  skool_message_id: string
  ghl_message_id: string | null
  skool_user_id: string
  direction: 'inbound' | 'outbound'
  message_text: string | null
  status: 'synced' | 'pending' | 'failed'
  created_at: string
  synced_at: string | null
  sender_name?: string | null
  // Phase 5: Multi-staff support
  staff_skool_id?: string | null
  staff_display_name?: string | null
  ghl_user_id?: string | null
  // Hand-raiser extension routing
  source?: 'ghl' | 'hand-raiser' | 'manual'
}

/**
 * Database row for staff_users table
 */
export interface StaffUserRow {
  id: string
  clerk_user_id: string
  skool_user_id: string
  skool_username: string | null
  display_name: string
  ghl_user_id: string | null
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Database row for dm_hand_raiser_campaigns table
 */
export interface HandRaiserCampaignRow {
  id: string
  clerk_user_id: string
  post_url: string
  skool_post_id: string | null
  keyword_filter: string | null
  dm_template: string | null  // Now optional - if null, only tags GHL (no DM sent)
  ghl_tag: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Database row for dm_hand_raiser_sent table
 */
export interface HandRaiserSentRow {
  id: string
  campaign_id: string
  skool_user_id: string
  sent_at: string
}

// =============================================================================
// DOMAIN TYPES (for business logic)
// =============================================================================

/**
 * DM sync configuration
 */
export interface DmSyncConfig {
  id: string
  userId: string
  skoolCommunitySlug: string
  ghlLocationId: string
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Contact mapping between Skool and GHL
 */
export interface ContactMapping {
  id: string
  userId: string
  skoolUserId: string
  skoolUsername: string | null
  skoolDisplayName: string | null
  ghlContactId: string
  matchMethod: 'skool_id' | 'email' | 'name' | 'synthetic' | null
  createdAt: Date
}

/**
 * Staff user for multi-staff DM attribution
 */
export interface StaffUser {
  id: string
  userId: string
  skoolUserId: string
  skoolUsername: string | null
  displayName: string
  ghlUserId: string | null
  isDefault: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Synced DM message
 */
export interface DmMessage {
  id: string
  userId: string
  skoolConversationId: string
  skoolMessageId: string
  ghlMessageId: string | null
  skoolUserId: string
  direction: 'inbound' | 'outbound'
  messageText: string | null
  status: 'synced' | 'pending' | 'failed'
  createdAt: Date
  syncedAt: Date | null
}

/**
 * Hand-raiser campaign configuration
 */
export interface HandRaiserCampaign {
  id: string
  userId: string
  postUrl: string
  skoolPostId: string | null
  keywordFilter: string | null
  dmTemplate: string
  ghlTag: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Record of sent hand-raiser DM
 */
export interface HandRaiserSent {
  id: string
  campaignId: string
  skoolUserId: string
  sentAt: Date
}

// =============================================================================
// OPERATION RESULT TYPES
// =============================================================================

/**
 * Result from sync operations
 */
export interface SyncResult {
  success: boolean
  stats: {
    total: number
    synced: number
    skipped: number
    failed: number
  }
  errors: SyncError[]
  duration: number // milliseconds
}

/**
 * Individual sync error
 */
export interface SyncError {
  messageId?: string
  conversationId?: string
  error: string
  code?: string
}

/**
 * Result from sending a DM
 */
export interface SendResult {
  success: boolean
  skoolMessageId?: string
  ghlMessageId?: string
  error?: string
}

/**
 * Result from contact mapping operation
 */
export interface MapContactResult {
  success: boolean
  mapping?: ContactMapping
  matchMethod?: 'skool_id' | 'email' | 'name' | 'synthetic'
  error?: string
}

// =============================================================================
// INPUT TYPES (for function parameters)
// =============================================================================

/**
 * Input for creating a sync config
 */
export interface CreateSyncConfigInput {
  userId: string
  skoolCommunitySlug: string
  ghlLocationId: string
  enabled?: boolean
}

/**
 * Input for creating a hand-raiser campaign
 */
export interface CreateHandRaiserCampaignInput {
  userId: string
  postUrl: string
  dmTemplate: string
  keywordFilter?: string
  ghlTag?: string
}

/**
 * Input for sending a DM through sync
 */
export interface SendDmInput {
  userId: string
  skoolUserId: string
  message: string
  conversationId?: string
}

// =============================================================================
// GHL TYPES (for GHL Conversations API)
// =============================================================================

/**
 * GHL contact for conversation creation
 */
export interface GhlContact {
  id: string
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  name?: string
}

/**
 * GHL conversation
 */
export interface GhlConversation {
  id: string
  contactId: string
  locationId: string
  type: string
}

/**
 * GHL message
 */
export interface GhlMessage {
  id: string
  conversationId: string
  body: string
  direction: 'inbound' | 'outbound'
  dateAdded: string
}

// =============================================================================
// HAND-RAISER TYPES (Phase 7)
// =============================================================================

/**
 * Comment on a Skool post
 */
export interface SkoolComment {
  id: string
  userId: string
  username: string
  displayName: string
  content: string
  createdAt: string
}

/**
 * Result from hand-raiser processing
 */
export interface HandRaiserResult {
  campaignsProcessed: number
  commentsChecked: number
  dmsSent: number
  errors: number
  errorDetails: Array<{ campaignId?: string; error: string }>
}

// =============================================================================
// INBOX CONVERSATION TYPES (for Skool Inbox UI)
// =============================================================================

/**
 * Participant info for a conversation
 */
export interface InboxConversationParticipant {
  skool_user_id: string
  display_name: string | null
  username: string | null
  ghl_contact_id?: string | null
}

/**
 * Last message preview for a conversation
 */
export interface InboxConversationLastMessage {
  text: string | null
  direction: 'inbound' | 'outbound'
  created_at: string
}

/**
 * Conversation summary for list view
 */
export interface InboxConversation {
  conversation_id: string
  participant: InboxConversationParticipant
  last_message: InboxConversationLastMessage
  message_count: number
  pending_count: number
  synced_count: number
}

/**
 * Summary statistics for all conversations
 */
export interface InboxConversationsSummary {
  total_conversations: number
  total_pending: number
}

/**
 * Message in a conversation thread
 */
export interface InboxMessage {
  id: string
  direction: 'inbound' | 'outbound'
  message_text: string | null
  sender_name: string | null
  status: 'synced' | 'pending' | 'failed'
  created_at: string
}

/**
 * Full conversation detail
 */
export interface InboxConversationDetail {
  id: string
  participant: InboxConversationParticipant
  message_count: number
}
