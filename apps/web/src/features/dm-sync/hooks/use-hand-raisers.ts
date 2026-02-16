'use client'

import useSWR from 'swr'
import type { HandRaiserCampaignRow } from '../types'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

/**
 * Input for creating a hand-raiser campaign (API format - snake_case)
 */
export interface CreateHandRaiserInput {
  post_url: string
  dm_template?: string | null  // Optional - if null, GHL-only mode (no DM sent)
  keyword_filter?: string | null
  ghl_tag?: string | null
  is_active?: boolean
}

/**
 * Hand-raiser campaign with aggregated stats
 */
export interface HandRaiserCampaignWithStats extends HandRaiserCampaignRow {
  stats: {
    sent_count: number
    last_sent_at: string | null
  }
}

export interface UseHandRaisersOptions {
  activeOnly?: boolean
}

export interface UseHandRaisersReturn {
  campaigns: HandRaiserCampaignWithStats[]
  isLoading: boolean
  error: Error | undefined
  refresh: () => void
}

/**
 * Hook for fetching hand-raiser campaigns
 */
export function useHandRaisers(options: UseHandRaisersOptions = {}): UseHandRaisersReturn {
  const params = new URLSearchParams()
  if (options.activeOnly) params.set('active_only', 'true')

  const url = `/api/dm-sync/hand-raisers${params.toString() ? '?' + params.toString() : ''}`

  const { data, error, mutate } = useSWR<{ campaigns: HandRaiserCampaignWithStats[] }>(
    url,
    fetcher
  )

  return {
    campaigns: data?.campaigns || [],
    isLoading: !error && !data,
    error,
    refresh: mutate,
  }
}

/**
 * Create a new hand-raiser campaign
 */
export async function createHandRaiser(
  input: CreateHandRaiserInput
): Promise<{ campaign?: HandRaiserCampaignRow; error?: string }> {
  try {
    const response = await fetch('/api/dm-sync/hand-raisers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const data = await response.json()
    if (!response.ok) {
      return { error: data.error || 'Failed to create hand-raiser campaign' }
    }
    return { campaign: data.campaign }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Update an existing hand-raiser campaign
 */
export async function updateHandRaiser(
  id: string,
  updates: Partial<HandRaiserCampaignRow>
): Promise<{ campaign?: HandRaiserCampaignRow; error?: string }> {
  try {
    const response = await fetch('/api/dm-sync/hand-raisers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    })
    const data = await response.json()
    if (!response.ok) {
      return { error: data.error || 'Failed to update hand-raiser campaign' }
    }
    return { campaign: data.campaign }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Delete a hand-raiser campaign
 */
export async function deleteHandRaiser(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/dm-sync/hand-raisers?id=${id}`, {
      method: 'DELETE',
    })
    const data = await response.json()
    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to delete hand-raiser campaign' }
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
