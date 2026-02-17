/**
 * Skool Metrics — DB Read Functions
 *
 * Reads Skool group KPI snapshots from the skool_metrics table.
 * Metrics are now written by the Chrome extension via /api/extension/* endpoints.
 */

import { createServerClient } from '@0ne/db/server'
import { DEFAULT_GROUP } from './config'

// =============================================================================
// TYPES
// =============================================================================

export interface SkoolMetricsSnapshot {
  group_slug: string
  snapshot_date: string
  members_total: number | null
  members_active: number | null
  community_activity: number | null
  category: string | null
  category_rank: number | null
  about_page_visits: number | null
  conversion_rate: number | null
}

/**
 * Get latest metrics for a group
 */
export async function getLatestMetrics(
  groupSlug: string = DEFAULT_GROUP.slug
): Promise<SkoolMetricsSnapshot | null> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('skool_metrics')
    .select('*')
    .eq('group_slug', groupSlug)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  return data as SkoolMetricsSnapshot
}

/**
 * Get metrics history for a group
 */
export async function getMetricsHistory(
  groupSlug: string = DEFAULT_GROUP.slug,
  days: number = 30
): Promise<SkoolMetricsSnapshot[]> {
  const supabase = createServerClient()

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data, error } = await supabase
    .from('skool_metrics')
    .select('*')
    .eq('group_slug', groupSlug)
    .gte('snapshot_date', startDate.toISOString().split('T')[0])
    .order('snapshot_date', { ascending: true })

  if (error || !data) {
    return []
  }

  return data as SkoolMetricsSnapshot[]
}
