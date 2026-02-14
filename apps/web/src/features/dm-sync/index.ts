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
} from './types'

// =============================================================================
// SKOOL DM CLIENT
// =============================================================================

export {
  SkoolDmClient,
  createSkoolDmClient,
  type SkoolDmClientConfig,
} from './lib/skool-dm-client'

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
  // Standalone sync functions (Phase 5)
  syncInboundMessages,
  sendPendingMessages,
  getEnabledSyncConfigs,
  // Extension message sync (Phase 2 - Skool Sync)
  syncExtensionMessages,
  // Hand-raiser functions (Phase 7)
  processHandRaisers,
  getUsersWithActiveHandRaisers,
  // Legacy class
  DmSyncEngine,
  createSyncEngine,
  createSyncEngineFromConfig,
  // Utilities
  needsSync,
  calculateSyncPriority,
  sortBySyncPriority,
  // Types
  type SyncEngineConfig,
  type SyncOptions,
  type InboundSyncResult,
  type InboundSyncOptions,
  type SendPendingResult,
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
