/**
 * Skool Integration Feature
 *
 * Exports for Skool metrics, KPI data, and automated post scheduling.
 * Skool API calls are handled by the Chrome extension; this module
 * provides DB-read functions and UI components.
 */

// Types (excluding SkoolCategory to avoid conflict with hooks)
export type {
  SkoolSurveyAnswer,
  SkoolApiMember,
  SkoolApiChatChannel,
  SkoolApiMessage,
  SkoolApiGroup,
  SkoolMemberRow,
  SkoolConversationRow,
  SkoolMessageRow,
  SkoolHandRaiserCampaignRow,
  SkoolHandRaiserSentRow,
  MemberSyncResult,
  DMSyncResult,
  MemberMatchResult,
  SkoolMemberDisplay,
  SkoolConversationDisplay,
  SkoolMessageDisplay,
  CreatePostParams,
  CreatePostResult,
  UploadResult,
  UploadError,
} from './types'
// Export SkoolCategory from types with alias to avoid conflict
export type { SkoolCategory as SkoolApiCategory } from './types'

// Lib
export * from './lib/config'
export * from './lib/metrics-sync'

// Hooks (Post Scheduler)
export * from './hooks'

// Components (Post Scheduler)
export * from './components'
