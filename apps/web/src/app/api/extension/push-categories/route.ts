/**
 * POST /api/extension/push-categories
 *
 * Receives category data fetched by the Chrome extension from Skool
 * and upserts them into the skool_categories cache table.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@0ne/db/server'
import { corsHeaders, validateExtensionAuth } from '@/lib/extension-auth'

export { OPTIONS } from '@/lib/extension-auth'

export const dynamic = 'force-dynamic'

// =============================================
// Types
// =============================================

interface PushCategoriesRequest {
  groupSlug: string
  categories: Array<{
    id: string
    name: string
    position: number
  }>
}

interface PushCategoriesResponse {
  success: boolean
  count: number
  error?: string
}

// =============================================
// POST /api/extension/push-categories
// =============================================

export async function POST(request: NextRequest) {
  // Validate auth (supports both Clerk and API key)
  const authResult = await validateExtensionAuth(request)
  if (!authResult.valid) {
    return NextResponse.json(
      { error: authResult.error },
      { status: 401, headers: corsHeaders }
    )
  }

  try {
    const body: PushCategoriesRequest = await request.json()

    // Validate request
    if (!body.groupSlug?.trim()) {
      return NextResponse.json(
        { error: 'Missing required field: groupSlug' },
        { status: 400, headers: corsHeaders }
      )
    }

    if (!Array.isArray(body.categories) || body.categories.length === 0) {
      return NextResponse.json(
        { error: 'categories must be a non-empty array' },
        { status: 400, headers: corsHeaders }
      )
    }

    console.log(
      `[Extension API] Received ${body.categories.length} categories for group "${body.groupSlug}"`
    )

    const supabase = createServerClient()
    const now = new Date().toISOString()

    // Delete existing categories for this group, then insert fresh
    const { error: deleteError } = await supabase
      .from('skool_categories')
      .delete()
      .eq('group_slug', body.groupSlug)

    if (deleteError) {
      console.error('[Extension API] Failed to clear old categories:', deleteError)
    }

    // Insert new categories
    const rows = body.categories.map((c, index) => ({
      group_slug: body.groupSlug,
      skool_id: c.id,
      name: c.name,
      position: c.position ?? index,
      fetched_at: now,
    }))

    const { error: insertError } = await supabase
      .from('skool_categories')
      .insert(rows)

    if (insertError) {
      console.error('[Extension API] Failed to insert categories:', insertError)
      return NextResponse.json(
        { success: false, count: 0, error: insertError.message } as PushCategoriesResponse,
        { status: 500, headers: corsHeaders }
      )
    }

    console.log(
      `[Extension API] Saved ${body.categories.length} categories for "${body.groupSlug}"`
    )

    const response: PushCategoriesResponse = {
      success: true,
      count: body.categories.length,
    }

    return NextResponse.json(response, { headers: corsHeaders })
  } catch (error) {
    console.error('[Extension API] POST push-categories exception:', error)
    return NextResponse.json(
      {
        success: false,
        count: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      } as PushCategoriesResponse,
      { status: 500, headers: corsHeaders }
    )
  }
}
