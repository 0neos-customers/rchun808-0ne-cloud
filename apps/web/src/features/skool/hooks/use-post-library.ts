'use client'

import useSWR from 'swr'
import type { SkoolPostLibraryItem, PostLibraryStatus, PostLibrarySource } from '@0ne/db'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export interface PostLibraryFilters {
  day_of_week?: number
  time?: string
  is_active?: boolean
  variationGroupId?: string // 'none' for posts with no group
  status?: PostLibraryStatus
  source?: PostLibrarySource
}

export interface UsePostLibraryReturn {
  posts: SkoolPostLibraryItem[]
  isLoading: boolean
  error: Error | undefined
  refresh: () => void
}

/**
 * Hook for fetching and managing Skool post library items
 */
export function usePostLibrary(filters?: PostLibraryFilters): UsePostLibraryReturn {
  const params = new URLSearchParams()
  if (filters?.day_of_week !== undefined) params.set('day_of_week', String(filters.day_of_week))
  if (filters?.time) params.set('time', filters.time)
  if (filters?.is_active !== undefined) params.set('is_active', String(filters.is_active))
  if (filters?.variationGroupId) params.set('variation_group_id', filters.variationGroupId) // 'none' for null filter
  if (filters?.status) params.set('status', filters.status)
  if (filters?.source) params.set('source', filters.source)

  const url = `/api/skool/posts${params.toString() ? '?' + params.toString() : ''}`

  const { data, error, mutate } = useSWR<{ posts: SkoolPostLibraryItem[] }>(url, fetcher)

  return {
    posts: data?.posts || [],
    isLoading: !error && !data,
    error,
    refresh: mutate,
  }
}

/**
 * Create a new post in the library
 */
export async function createPost(
  input: Omit<SkoolPostLibraryItem, 'id' | 'created_at' | 'updated_at' | 'last_used_at' | 'use_count'>
): Promise<{ post?: SkoolPostLibraryItem; error?: string }> {
  try {
    const response = await fetch('/api/skool/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const data = await response.json()
    if (!response.ok) {
      return { error: data.error || 'Failed to create post' }
    }
    return { post: data.post }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Update an existing post in the library
 */
export async function updatePost(
  id: string,
  updates: Partial<SkoolPostLibraryItem>
): Promise<{ post?: SkoolPostLibraryItem; error?: string }> {
  try {
    const response = await fetch('/api/skool/posts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    })
    const data = await response.json()
    if (!response.ok) {
      return { error: data.error || 'Failed to update post' }
    }
    return { post: data.post }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Delete a post from the library
 */
export async function deletePost(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/skool/posts?id=${id}`, {
      method: 'DELETE',
    })
    const data = await response.json()
    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to delete post' }
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Approve a draft post (change status from draft to approved)
 */
export async function approvePost(id: string): Promise<{ post?: SkoolPostLibraryItem; error?: string }> {
  return updatePost(id, { status: 'approved' })
}

/**
 * Bulk approve multiple draft posts
 */
export async function bulkApprovePosts(ids: string[]): Promise<{
  success: number
  failed: number
  errors: string[]
}> {
  const results = await Promise.all(ids.map((id) => approvePost(id)))

  const success = results.filter((r) => r.post).length
  const failed = results.filter((r) => r.error).length
  const errors = results.filter((r) => r.error).map((r) => r.error!)

  return { success, failed, errors }
}
