/**
 * POST /api/skool/oneoff-posts/post-now
 *
 * Queues a one-off post for immediate publishing by the Chrome extension.
 * Instead of calling Skool API server-side (blocked by AWS WAF), this sets
 * `status = 'approved'` and `scheduled_at = NOW()` so the extension's
 * get-scheduled-posts poll (every 60s) picks it up and publishes it.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@0ne/db/server'
import type { SkoolOneOffPost } from '@0ne/db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Missing post id' }, { status: 400 })
    }

    // Get the post
    const { data: post, error: fetchError } = await supabase
      .from('skool_oneoff_posts')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const oneOff = post as SkoolOneOffPost

    // Check if post is in an editable status
    const editableStatuses = ['draft', 'approved', 'pending']
    if (!editableStatuses.includes(oneOff.status)) {
      return NextResponse.json(
        { error: `Cannot post: status is "${oneOff.status}". Only draft, approved, or scheduled posts can be posted.` },
        { status: 400 }
      )
    }

    console.log(`[Post Now] Queuing "${oneOff.title}" for extension publishing`)

    // Queue for extension: set status to 'approved' and scheduled_at to NOW
    // The extension polls get-scheduled-posts every 60s and will pick this up
    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('skool_oneoff_posts')
      .update({
        status: 'approved',
        scheduled_at: now,
        updated_at: now,
      })
      .eq('id', id)

    if (updateError) {
      console.error(`[Post Now] Failed to queue post:`, updateError)
      return NextResponse.json(
        { error: 'Failed to queue post for publishing' },
        { status: 500 }
      )
    }

    console.log(`[Post Now] Post queued successfully — extension will publish within ~60s`)

    return NextResponse.json({
      success: true,
      queued: true,
      message: 'Post queued for extension publishing. It will be published within ~60 seconds.',
    })
  } catch (error) {
    console.error('[Post Now] Exception:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
