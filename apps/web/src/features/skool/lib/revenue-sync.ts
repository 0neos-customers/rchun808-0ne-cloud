/**
 * Skool Revenue — DB Read Functions
 *
 * Reads MRR and revenue snapshots from skool_revenue_daily table.
 * Revenue data is now written by the Chrome extension via /api/extension/* endpoints.
 */

import { createClient } from '@supabase/supabase-js'

// =============================================================================
// SUPABASE CLIENT
// =============================================================================

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase credentials')
  }

  return createClient(url, key)
}

/**
 * Get the latest revenue snapshot for a group
 */
export async function getLatestRevenueSnapshot(groupSlug: string = 'fruitful') {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('skool_revenue_daily')
    .select('*')
    .eq('group_slug', groupSlug)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    console.error('[revenue-sync] Error fetching latest snapshot:', error)
    return null
  }

  return data
}

/**
 * Get revenue history for a date range
 */
export async function getRevenueHistory(
  groupSlug: string = 'fruitful',
  startDate: string,
  endDate: string
) {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('skool_revenue_daily')
    .select('*')
    .eq('group_slug', groupSlug)
    .gte('snapshot_date', startDate)
    .lte('snapshot_date', endDate)
    .order('snapshot_date', { ascending: true })

  if (error) {
    console.error('[revenue-sync] Error fetching revenue history:', error)
    return []
  }

  return data || []
}

/**
 * Get MRR change between two dates
 */
export async function getMrrChange(
  groupSlug: string = 'fruitful',
  startDate: string,
  endDate: string
): Promise<{
  startMrr: number
  endMrr: number
  change: number
  changePercent: number | null
}> {
  const supabase = getSupabaseClient()

  // Get MRR at start
  const { data: startData } = await supabase
    .from('skool_revenue_daily')
    .select('mrr')
    .eq('group_slug', groupSlug)
    .lte('snapshot_date', startDate)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single()

  // Get MRR at end
  const { data: endData } = await supabase
    .from('skool_revenue_daily')
    .select('mrr')
    .eq('group_slug', groupSlug)
    .lte('snapshot_date', endDate)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single()

  const startMrr = startData?.mrr || 0
  const endMrr = endData?.mrr || 0
  const change = endMrr - startMrr
  const changePercent = startMrr > 0 ? ((change / startMrr) * 100) : null

  return { startMrr, endMrr, change, changePercent }
}
