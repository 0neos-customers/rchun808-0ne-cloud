'use client'

import { useState, useEffect, useCallback } from 'react'

// =============================================================================
// TYPES
// =============================================================================

export interface FixAction {
  check_name: string
  category: string
  before_status: string
  before_detail: string
  action_taken: string
  after_status: string
  after_detail: string
  success: boolean
  error?: string
}

export interface FixSummary {
  fixes_attempted: number
  fixes_succeeded: number
  fixes_failed: number
}

export interface TelemetryEvent {
  id: string
  event_type: 'doctor' | 'install'
  principal_name: string | null
  platform: string | null
  arch: string | null
  os_version: string | null
  bun_version: string | null
  one_version: string | null
  summary: {
    pass?: number
    fail?: number
    warn?: number
    skip?: number
    total?: number
  } | null
  results: Record<string, unknown>[] | null
  system_info: Record<string, unknown> | null
  fix_actions: FixAction[] | null
  fix_summary: FixSummary | null
  status: 'new' | 'triaged' | 'fixed' | 'deployed'
  fix_notes: string | null
  fix_commit: string | null
  triaged_at: string | null
  fixed_at: string | null
  deployed_at: string | null
  created_at: string
}

export interface StatusHistoryEntry {
  id: string
  event_id: string
  old_status: string | null
  new_status: string
  note: string | null
  created_at: string
}

export interface TelemetryEventDetail {
  event: TelemetryEvent
  status_history: StatusHistoryEntry[]
}

export interface TelemetryStats {
  total_installs: number
  total_doctor_runs: number
  success_rate: number
  avg_issues: number
  total_fixes: number
}

export interface InstallsFilters {
  event_type?: string
  platform?: string
  status?: string
  principal_name?: string
  date_from?: string
  date_to?: string
}

export interface PaginatedResponse {
  data: TelemetryEvent[]
  total: number
  page: number
  per_page: number
}

export interface FailurePattern {
  id: string
  pattern_key: string
  failure_name: string
  category: string | null
  occurrence_count: number
  first_seen: string
  last_seen: string
  known_fix: string | null
  auto_fixable: boolean
  updated_at: string
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook for fetching installs stats (aggregate metrics)
 */
export function useInstallsStats() {
  const [data, setData] = useState<TelemetryStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchStats() {
      setIsLoading(true)
      try {
        const response = await fetch('/api/installs/dashboard/stats')
        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || 'Failed to fetch stats')
        }
        const result = await response.json()
        if (!cancelled) {
          setData(result)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Unknown error'))
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchStats()
    return () => { cancelled = true }
  }, [])

  return { data, isLoading, error }
}

/**
 * Hook for fetching paginated installs events with filters
 */
export function useInstallsEvents(filters: InstallsFilters = {}, page = 1, perPage = 25) {
  const [data, setData] = useState<PaginatedResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchEvents = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('per_page', String(perPage))

      if (filters.event_type) params.set('event_type', filters.event_type)
      if (filters.platform) params.set('platform', filters.platform)
      if (filters.status) params.set('status', filters.status)
      if (filters.principal_name) params.set('principal_name', filters.principal_name)
      if (filters.date_from) params.set('date_from', filters.date_from)
      if (filters.date_to) params.set('date_to', filters.date_to)

      const response = await fetch(`/api/installs/dashboard?${params.toString()}`)
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to fetch events')
      }
      const result: PaginatedResponse = await response.json()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [page, perPage, filters.event_type, filters.platform, filters.status, filters.principal_name, filters.date_from, filters.date_to])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  return { data, isLoading, error, refetch: fetchEvents }
}

// =============================================================================
// DETAIL HOOKS
// =============================================================================

/**
 * Hook for fetching a single telemetry event with status history
 */
export function useInstallEvent(id: string) {
  const [data, setData] = useState<TelemetryEventDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchEvent = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/installs/dashboard/${id}`)
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to fetch event')
      }
      const result: TelemetryEventDetail = await response.json()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id) fetchEvent()
  }, [id, fetchEvent])

  return { data, isLoading, error, refetch: fetchEvent }
}

/**
 * Hook for updating event status (triage, fix, deploy)
 */
export function useUpdateStatus(id: string) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const updateStatus = useCallback(async (payload: {
    status: 'triaged' | 'fixed' | 'deployed'
    note?: string
    fix_commit?: string
    fix_notes?: string
  }) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/installs/dashboard/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to update status')
      }
      const result = await response.json()
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [id])

  return { updateStatus, isLoading, error }
}

/**
 * Hook for adding a note to an event
 */
export function useAddNote(id: string) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const addNote = useCallback(async (note: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/installs/dashboard/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to add note')
      }
      const result = await response.json()
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [id])

  return { addNote, isLoading, error }
}

// =============================================================================
// PATTERN HOOKS
// =============================================================================

/**
 * Hook for fetching failure patterns
 */
export function useFailurePatterns(category?: string) {
  const [data, setData] = useState<FailurePattern[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchPatterns = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (category) params.set('category', category)

      const url = `/api/installs/dashboard/patterns${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url)
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to fetch patterns')
      }
      const result = await response.json()
      setData(result.data || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [category])

  useEffect(() => {
    fetchPatterns()
  }, [fetchPatterns])

  return { data, isLoading, error, refetch: fetchPatterns }
}

/**
 * Hook for documenting a known fix for a failure pattern
 */
export function useDocumentFix(id: string) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const documentFix = useCallback(async (payload: {
    known_fix: string
    auto_fixable?: boolean
  }) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/installs/dashboard/patterns/${id}/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to document fix')
      }
      const result = await response.json()
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [id])

  return { documentFix, isLoading, error }
}
