/**
 * Cron Registry
 *
 * Central registry of all scheduled sync jobs with metadata.
 * Used by the Schedules tab to display and trigger sync jobs.
 */

import type { SyncType } from '@/lib/sync-log'

// =============================================================================
// TYPES
// =============================================================================

export interface CronJob {
  /** Unique identifier for the cron job (used for API calls) */
  id: string
  /** Human-readable name */
  name: string
  /** Description of what this sync does */
  description: string
  /** Human-readable schedule (e.g., "Daily at 5:00 AM") */
  schedule: string
  /** Standard 5-part cron expression (minute hour dayOfMonth month dayOfWeek) */
  cronExpression: string
  /** API endpoint to trigger the sync */
  endpoint: string
  /** Corresponding sync_type in the activity log */
  syncType: SyncType
}

export interface CronJobWithStatus extends CronJob {
  /** Last run information from sync_activity_log */
  lastRun: {
    startedAt: string
    status: 'running' | 'completed' | 'failed'
    recordsSynced: number
    durationSeconds: number | null
    errorMessage: string | null
  } | null
}

// =============================================================================
// REGISTRY
// =============================================================================

/**
 * All registered cron jobs in the system
 */
export const CRON_REGISTRY: CronJob[] = [
  {
    id: 'sync-ghl',
    name: 'GHL Contacts',
    description: 'Sync contacts from GoHighLevel CRM',
    schedule: 'Daily at 5:00 AM',
    cronExpression: '0 5 * * *',
    endpoint: '/api/cron/sync-ghl',
    syncType: 'ghl_contacts',
  },
  {
    id: 'sync-ghl-payments',
    name: 'GHL Payments',
    description: 'Sync payment transactions from GoHighLevel',
    schedule: 'Daily at 6:00 AM',
    cronExpression: '0 6 * * *',
    endpoint: '/api/cron/sync-ghl-payments',
    syncType: 'ghl_payments',
  },
  {
    id: 'sync-meta',
    name: 'Meta Ads',
    description: 'Sync Facebook/Instagram ad metrics',
    schedule: 'Daily at 2:00 AM',
    cronExpression: '0 2 * * *',
    endpoint: '/api/cron/sync-meta',
    syncType: 'meta',
  },
  {
    id: 'sync-skool-dms',
    name: 'Skool DMs (Inbound)',
    description: 'Sync inbound Skool messages to GHL inbox',
    schedule: 'Every 5 minutes',
    cronExpression: '*/5 * * * *',
    endpoint: '/api/cron/sync-skool-dms',
    syncType: 'skool_dms',
  },
  {
    id: 'aggregate',
    name: 'Daily Aggregation',
    description: 'Aggregate daily KPI metrics and funnel data',
    schedule: 'Daily at 7:00 AM',
    cronExpression: '0 7 * * *',
    endpoint: '/api/cron/aggregate',
    syncType: 'aggregate',
  },
  {
    id: 'send-daily-snapshot',
    name: 'Daily Snapshot',
    description: 'Send daily email snapshot to subscribers',
    schedule: 'Daily at 8:00 AM',
    cronExpression: '0 8 * * *',
    endpoint: '/api/cron/send-daily-snapshot',
    syncType: 'daily_snapshot',
  },
]

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get a cron job by its ID
 */
export function getCronById(id: string): CronJob | undefined {
  return CRON_REGISTRY.find((cron) => cron.id === id)
}

/**
 * Get a cron job by its sync type
 */
export function getCronBySyncType(syncType: SyncType): CronJob | undefined {
  return CRON_REGISTRY.find((cron) => cron.syncType === syncType)
}

/**
 * Check if a cron ID is valid
 */
export function isValidCronId(id: string): boolean {
  return CRON_REGISTRY.some((cron) => cron.id === id)
}

/**
 * Get all cron IDs
 */
export function getAllCronIds(): string[] {
  return CRON_REGISTRY.map((cron) => cron.id)
}
