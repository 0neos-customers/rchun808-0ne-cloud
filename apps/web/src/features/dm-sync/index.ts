/**
 * DM Sync Feature
 *
 * Bidirectional sync between Skool DMs and GHL conversations.
 * Includes contact mapping, message deduplication, and hand-raiser automation.
 *
 * @module dm-sync
 */

// =============================================================================
// TYPES
// =============================================================================

export type {
  // Skool types
  SkoolUser,
  SkoolConversation,
  SkoolMessage,
  SkoolComment,
  // Database row types
  DmSyncConfigRow,
  ContactMappingRow,
  DmMessageRow,
  HandRaiserCampaignRow,
  HandRaiserSentRow,
  StaffUserRow,
  // Domain types
  DmSyncConfig,
  ContactMapping,
  DmMessage,
  HandRaiserCampaign,
  HandRaiserSent,
  StaffUser,
  // Result types
  SyncResult,
  SyncError,
  SendResult,
  MapContactResult,
  HandRaiserResult,
  // Input types
  CreateSyncConfigInput,
  CreateHandRaiserCampaignInput,
  SendDmInput,
  // GHL types
  GhlContact,
  GhlConversation,
  GhlMessage,
  // Inbox conversation types
  InboxConversationParticipant,
  InboxConversationLastMessage,
  InboxConversation,
  InboxConversationsSummary,
  InboxMessage,
  InboxConversationDetail,
} from './types'

// =============================================================================
// CONTACT MAPPER
// =============================================================================

export {
  ContactMapper,
  createContactMapper,
  generateSyntheticEmail,
  isSyntheticEmail,
  normalizeName,
  calculateNameSimilarity,
  // New exports for Phase 3
  findOrCreateGhlContact,
  findGhlContactsForUsers,
  extractMemberEmail,
  extractMemberPhone,
  type ContactMapperConfig,
  type MatchMethod,
  type ContactLookupResult,
} from './lib/contact-mapper'

// =============================================================================
// GHL CONVERSATION CLIENT
// =============================================================================

export {
  // Legacy client (non-marketplace)
  GhlConversationClient,
  createGhlConversationClient,
  createGhlConversationClientFromEnv,
  type GhlConversationClientConfig,
  // Marketplace client (Phase 4)
  GhlConversationProviderClient,
  createGhlConversationProviderClient,
  createGhlConversationProviderClientFromEnv,
  // Marketplace client with DB persistence (recommended)
  createGhlConversationProviderClientWithPersistence,
  type GhlMarketplaceConfig,
  // Webhook utilities
  verifyGhlWebhookSignature,
  type GhlOutboundMessagePayload,
} from './lib/ghl-conversation'

// =============================================================================
// GHL TOKEN STORE
// =============================================================================

export {
  getStoredTokens,
  saveTokens,
  clearTokens,
  tokensNeedRefresh,
  type StoredTokens,
  type TokenUpdate,
} from './lib/ghl-token-store'

// =============================================================================
// SYNC ENGINE
// =============================================================================

export {
  getEnabledSyncConfigs,
  // Extension message sync (Phase 2 - Skool Sync)
  syncExtensionMessages,
  // Hand-raiser functions (Phase 7)
  getUsersWithActiveHandRaisers,
  // Utilities
  needsSync,
  calculateSyncPriority,
  sortBySyncPriority,
  // Types
  type SyncEngineConfig,
  type SyncOptions,
  type ExtensionSyncResult,
} from './lib/sync-engine'

// =============================================================================
// HOOKS
// =============================================================================

export {
  useHandRaisers,
  createHandRaiser,
  updateHandRaiser,
  deleteHandRaiser,
  type HandRaiserCampaignWithStats,
  type CreateHandRaiserInput,
} from './hooks/use-hand-raisers'

export {
  useContactActivity,
  type ContactActivity,
  type ContactActivitySummary,
  type UseContactActivityOptions,
  type UseContactActivityReturn,
} from './hooks/use-contact-activity'

export {
  useRawMessages,
  type RawMessage,
  type RawMessagesSummary,
  type RawMessagesPagination,
  type UseRawMessagesOptions,
  type UseRawMessagesReturn,
} from './hooks/use-raw-messages'

export {
  useConversations,
  type Conversation,
  type ConversationParticipant,
  type ConversationLastMessage,
  type ConversationsSummary,
  type UseConversationsOptions,
  type UseConversationsReturn,
} from './hooks/use-conversations'

export {
  useConversationDetail,
  type ConversationMessage,
  type ConversationDetailParticipant,
  type ConversationDetail as ConversationDetailData,
  type UseConversationDetailReturn,
} from './hooks/use-conversation-detail'

// =============================================================================
// STAFF USERS (Phase 5)
// =============================================================================

export {
  // CRUD operations
  getStaffUsers,
  getActiveStaffUsers,
  getStaffBySkoolId,
  getStaffByGhlUserId,
  getDefaultStaff,
  createStaffUser,
  updateStaffUser,
  deleteStaffUser,
  // Routing logic
  parseStaffOverride,
  resolveOutboundStaff,
  // Message formatting
  formatInboundMessage,
  formatOutboundMessage,
  stripStaffPrefix,
  // Types
  type StaffUserInput,
  type ResolvedStaff,
} from './lib/staff-users'

// =============================================================================
// COMPONENTS
// =============================================================================

export { StaffUsersManager } from './components/StaffUsersManager'
export { ConversationList } from './components/ConversationList'
export { ConversationItem } from './components/ConversationItem'
export { ConversationDetail } from './components/ConversationDetail'
export { MessageBubble } from './components/MessageBubble'
