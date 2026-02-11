import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@0ne/db/server'
import { validateExternalApiKey } from '../../auth'
import type { PostLibraryStatus } from '@0ne/db'

export const dynamic = 'force-dynamic'

/**
 * External API for creating Skool posts as drafts
 * Used by One (Claude) and other external systems to stage posts for review
 */

interface ExternalPostInput {
  title: string
  body: string
  category?: string
  variation_group_id?: string
  image_url?: string
  video_url?: string
}

interface CreatePostsRequest {
  posts: ExternalPostInput[]
  campaign_name?: string // Optional metadata for tracking
}

/**
 * POST /api/external/skool/posts
 * Create new posts with status='draft', source='api'
 *
 * Headers:
 * - X-API-Key: Your external API key
 *
 * Body:
 * {
 *   "posts": [
 *     { "title": "...", "body": "...", "category": "...", "variation_group_id": "..." }
 *   ],
 *   "campaign_name": "Optional campaign name for tracking"
 * }
 */
export async function POST(request: NextRequest) {
  // Validate API key
  const authError = validateExternalApiKey(request)
  if (authError) return authError

  try {
    const supabase = createServerClient()
    const body: CreatePostsRequest = await request.json()

    // Validate request structure
    if (!body.posts || !Array.isArray(body.posts) || body.posts.length === 0) {
      return NextResponse.json(
        { error: 'Request must include a non-empty "posts" array' },
        { status: 400 }
      )
    }

    // Validate each post
    const validationErrors: string[] = []
    body.posts.forEach((post, index) => {
      if (!post.title?.trim()) {
        validationErrors.push(`Post ${index + 1}: missing required field "title"`)
      }
      if (!post.body?.trim()) {
        validationErrors.push(`Post ${index + 1}: missing required field "body"`)
      }
    })

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationErrors },
        { status: 400 }
      )
    }

    // Prepare posts for insertion
    const postsToInsert = body.posts.map((post) => ({
      title: post.title.trim(),
      body: post.body.trim(),
      category: post.category?.trim() || 'Uncategorized', // Default to Uncategorized
      variation_group_id: post.variation_group_id || null,
      image_url: post.image_url || null,
      video_url: post.video_url || null,
      day_of_week: null, // Not used for API-created posts
      time: null, // Not used for API-created posts
      is_active: true,
      status: 'draft' as const,
      source: 'api' as const,
    }))

    // Insert all posts
    const { data, error } = await supabase
      .from('skool_post_library')
      .insert(postsToInsert)
      .select('id')

    if (error) {
      console.error('[External Posts API] Insert error:', error)
      return NextResponse.json(
        { error: 'Failed to create posts', details: error.message },
        { status: 500 }
      )
    }

    const postIds = data?.map((p) => p.id) || []

    console.log(
      `[External Posts API] Created ${postIds.length} draft posts` +
        (body.campaign_name ? ` for campaign: ${body.campaign_name}` : '')
    )

    return NextResponse.json(
      {
        success: true,
        created: postIds.length,
        post_ids: postIds,
        message: `${postIds.length} posts created as drafts. Review at /skool/posts?status=draft`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[External Posts API] POST exception:', error)
    return NextResponse.json(
      { error: 'Failed to create posts', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/external/skool/posts
 * List posts by status (for verification)
 *
 * Headers:
 * - X-API-Key: Your external API key
 *
 * Query params:
 * - status: Filter by status (draft, approved, active)
 * - limit: Max number of posts to return (default 50)
 */
export async function GET(request: NextRequest) {
  // Validate API key
  const authError = validateExternalApiKey(request)
  if (authError) return authError

  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as PostLibraryStatus | null
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    let query = supabase
      .from('skool_post_library')
      .select('id, title, category, status, source, created_at, variation_group_id')
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100)) // Cap at 100

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('[External Posts API] GET error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch posts', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      posts: data,
      count: data?.length || 0,
    })
  } catch (error) {
    console.error('[External Posts API] GET exception:', error)
    return NextResponse.json(
      { error: 'Failed to fetch posts', details: String(error) },
      { status: 500 }
    )
  }
}
