import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@0ne/db/server'
import type { SkoolPostLibraryItemInput } from '@0ne/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/skool/posts
 * List posts from the library with optional filters
 *
 * Query params:
 * - day_of_week: Filter by day (0-6) (legacy)
 * - time: Filter by time slot (HH:MM) (legacy)
 * - variation_group_id: Filter by variation group (use 'none' for posts with no group)
 * - is_active: Filter by active status (true/false)
 * - status: Filter by status (draft, approved, active)
 * - source: Filter by source (manual, api, import)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const dayOfWeek = searchParams.get('day_of_week')
    const time = searchParams.get('time')
    const variationGroupId = searchParams.get('variation_group_id')
    const isActive = searchParams.get('is_active')
    const status = searchParams.get('status')
    const source = searchParams.get('source')

    let query = supabase
      .from('skool_post_library')
      .select('*, variation_group:skool_variation_groups(id, name, is_active)')

    if (dayOfWeek !== null && dayOfWeek !== '') {
      query = query.eq('day_of_week', parseInt(dayOfWeek, 10))
    }
    if (time) {
      query = query.eq('time', time)
    }
    if (variationGroupId) {
      if (variationGroupId === 'none') {
        query = query.is('variation_group_id', null)
      } else {
        query = query.eq('variation_group_id', variationGroupId)
      }
    }
    if (isActive !== null && isActive !== '') {
      query = query.eq('is_active', isActive === 'true')
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (source) {
      query = query.eq('source', source)
    }

    const { data, error } = await query
      .order('status') // Show drafts first
      .order('last_used_at', { ascending: true, nullsFirst: true })

    if (error) {
      console.error('[Posts API] GET error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ posts: data })
  } catch (error) {
    console.error('[Posts API] GET exception:', error)
    return NextResponse.json(
      { error: 'Failed to fetch posts', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/skool/posts
 * Create a new post in the library
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body: SkoolPostLibraryItemInput = await request.json()

    // Validate required fields (only title and body are truly required now)
    if (!body.title || !body.body) {
      return NextResponse.json(
        { error: 'Missing required fields: title, body' },
        { status: 400 }
      )
    }

    // Validate day_of_week range (0-6) if provided
    if (body.day_of_week !== undefined && body.day_of_week !== null) {
      if (body.day_of_week < 0 || body.day_of_week > 6) {
        return NextResponse.json(
          { error: 'day_of_week must be between 0 (Sunday) and 6 (Saturday)' },
          { status: 400 }
        )
      }
    }

    // Validate time format (HH:MM) if provided
    if (body.time && !/^\d{2}:\d{2}$/.test(body.time)) {
      return NextResponse.json(
        { error: 'time must be in HH:MM format (e.g., "09:00")' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('skool_post_library')
      .insert({
        category: body.category || '',
        day_of_week: body.day_of_week ?? null,
        time: body.time || null,
        variation_group_id: body.variation_group_id || null,
        title: body.title,
        body: body.body,
        image_url: body.image_url || null,
        video_url: body.video_url || null,
        is_active: body.is_active ?? true,
        status: body.status || 'active', // Default to active for manual creation
        source: body.source || 'manual',
      })
      .select('*, variation_group:skool_variation_groups(id, name, is_active)')
      .single()

    if (error) {
      console.error('[Posts API] POST error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ post: data }, { status: 201 })
  } catch (error) {
    console.error('[Posts API] POST exception:', error)
    return NextResponse.json(
      { error: 'Failed to create post', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/skool/posts
 * Update an existing post in the library
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    // Validate day_of_week if provided
    if (updates.day_of_week !== undefined) {
      if (updates.day_of_week < 0 || updates.day_of_week > 6) {
        return NextResponse.json(
          { error: 'day_of_week must be between 0 (Sunday) and 6 (Saturday)' },
          { status: 400 }
        )
      }
    }

    // Validate time format if provided
    if (updates.time && !/^\d{2}:\d{2}$/.test(updates.time)) {
      return NextResponse.json(
        { error: 'time must be in HH:MM format (e.g., "09:00")' },
        { status: 400 }
      )
    }

    // Set approved_at when transitioning to approved status
    const updateData = { ...updates, updated_at: new Date().toISOString() }
    if (updates.status === 'approved' || updates.status === 'active') {
      updateData.approved_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('skool_post_library')
      .update(updateData)
      .eq('id', id)
      .select('*, variation_group:skool_variation_groups(id, name, is_active)')
      .single()

    if (error) {
      console.error('[Posts API] PUT error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    return NextResponse.json({ post: data })
  } catch (error) {
    console.error('[Posts API] PUT exception:', error)
    return NextResponse.json(
      { error: 'Failed to update post', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/skool/posts?id=xxx
 * Delete a post from the library
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing id query parameter' }, { status: 400 })
    }

    const { error } = await supabase
      .from('skool_post_library')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[Posts API] DELETE error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Posts API] DELETE exception:', error)
    return NextResponse.json(
      { error: 'Failed to delete post', details: String(error) },
      { status: 500 }
    )
  }
}
