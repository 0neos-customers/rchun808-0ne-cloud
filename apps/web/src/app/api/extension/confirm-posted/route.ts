import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@0ne/db/server'
import { corsHeaders, validateExtensionApiKey } from '@/lib/extension-auth'

export { OPTIONS } from '@/lib/extension-auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/extension/confirm-posted
 *
 * Called by the extension after successfully publishing a post to Skool.
 * Updates the database with the posted status and Skool post ID.
 *
 * Request body:
 *   - postId: The scheduled post ID (UUID or "recurring:scheduleId:libraryId")
 *   - skoolPostId: The Skool post ID returned after publishing
 *   - skoolPostUrl: The full URL to the published post
 *   - success: Whether the post was published successfully
 *   - error: Error message if failed
 */

// =============================================
// Types
// =============================================

interface ConfirmPostedRequest {
  postId: string
  skoolPostId?: string
  skoolPostUrl?: string
  success: boolean
  error?: string
  emailBlastSent?: boolean
}

interface ConfirmPostedResponse {
  success: boolean
  message: string
  error?: string
}

// =============================================
// POST Handler
// =============================================

export async function POST(request: NextRequest) {
  // Validate API key
  const authError = validateExtensionApiKey(request)
  if (authError) return authError

  try {
    const body: ConfirmPostedRequest = await request.json()

    // Validate request
    if (!body.postId) {
      return NextResponse.json(
        { success: false, message: '', error: 'Missing required field: postId' },
        { status: 400, headers: corsHeaders }
      )
    }

    const supabase = createServerClient()
    const now = new Date().toISOString()

    console.log(
      `[Extension API] Confirm posted: postId=${body.postId}, success=${body.success}, skoolPostId=${body.skoolPostId || 'N/A'}`
    )

    // Check if this is a recurring post
    if (body.postId.startsWith('recurring:')) {
      // Parse recurring post ID format: "recurring:scheduleId:libraryId"
      const parts = body.postId.split(':')
      if (parts.length !== 3) {
        return NextResponse.json(
          { success: false, message: '', error: 'Invalid recurring post ID format' },
          { status: 400, headers: corsHeaders }
        )
      }

      const [, scheduleId, libraryId] = parts

      if (body.success) {
        // Update the schedule's last_run_at
        const { error: scheduleError } = await supabase
          .from('skool_scheduled_posts')
          .update({ last_run_at: now, updated_at: now })
          .eq('id', scheduleId)

        if (scheduleError) {
          console.error('[Extension API] Error updating schedule:', scheduleError)
        }

        // Update the library post's usage stats
        const { error: libraryError } = await supabase
          .from('skool_post_library')
          .update({
            last_used_at: now,
            use_count: supabase.rpc('increment_use_count', { row_id: libraryId }),
            updated_at: now,
          })
          .eq('id', libraryId)

        if (libraryError) {
          // Try a simpler update without RPC
          await supabase.rpc('mark_post_used', { p_post_id: libraryId })
        }

        // Log the execution
        const { error: logError } = await supabase.from('skool_post_execution_log').insert({
          scheduler_id: scheduleId,
          post_library_id: libraryId,
          executed_at: now,
          status: 'success',
          skool_post_id: body.skoolPostId || null,
          skool_post_url: body.skoolPostUrl || null,
          email_blast_sent: body.emailBlastSent || false,
        })

        if (logError) {
          console.error('[Extension API] Error logging execution:', logError)
        }

        return NextResponse.json(
          { success: true, message: 'Recurring post confirmed' } as ConfirmPostedResponse,
          { headers: corsHeaders }
        )
      } else {
        // Log the failure
        await supabase.from('skool_post_execution_log').insert({
          scheduler_id: scheduleId,
          post_library_id: libraryId,
          executed_at: now,
          status: 'failed',
          error_message: body.error || 'Unknown error',
        })

        return NextResponse.json(
          { success: true, message: 'Failure logged for recurring post' } as ConfirmPostedResponse,
          { headers: corsHeaders }
        )
      }
    }

    // Handle one-off posts
    if (body.success) {
      // Update the one-off post as published
      const { error: updateError } = await supabase
        .from('skool_oneoff_posts')
        .update({
          status: 'published',
          published_at: now,
          skool_post_id: body.skoolPostId || null,
          skool_post_url: body.skoolPostUrl || null,
          updated_at: now,
        })
        .eq('id', body.postId)

      if (updateError) {
        console.error('[Extension API] Error updating one-off post:', updateError)
        return NextResponse.json(
          { success: false, message: '', error: updateError.message },
          { status: 500, headers: corsHeaders }
        )
      }

      // If email blast was sent, record it
      if (body.emailBlastSent) {
        // Get the group_slug from the post
        const { data: post } = await supabase
          .from('skool_oneoff_posts')
          .select('group_slug')
          .eq('id', body.postId)
          .single()

        if (post?.group_slug) {
          await supabase.rpc('record_email_blast', { p_group_slug: post.group_slug })
        }
      }

      console.log(`[Extension API] One-off post ${body.postId} marked as published`)

      return NextResponse.json(
        { success: true, message: 'Post confirmed as published' } as ConfirmPostedResponse,
        { headers: corsHeaders }
      )
    } else {
      // Mark as failed
      const { error: updateError } = await supabase
        .from('skool_oneoff_posts')
        .update({
          status: 'failed',
          error_message: body.error || 'Unknown error',
          updated_at: now,
        })
        .eq('id', body.postId)

      if (updateError) {
        console.error('[Extension API] Error marking post as failed:', updateError)
      }

      console.log(`[Extension API] One-off post ${body.postId} marked as failed: ${body.error}`)

      return NextResponse.json(
        { success: true, message: 'Post failure recorded' } as ConfirmPostedResponse,
        { headers: corsHeaders }
      )
    }
  } catch (error) {
    console.error('[Extension API] POST exception:', error)
    return NextResponse.json(
      {
        success: false,
        message: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      } as ConfirmPostedResponse,
      { status: 500, headers: corsHeaders }
    )
  }
}
