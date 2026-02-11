/**
 * Skool Post Scheduler Cron Endpoint
 *
 * Checks for scheduled posts due to run and publishes them automatically.
 * Handles both recurring schedulers (with variation groups) and one-off posts.
 * Run every 15 minutes via Vercel cron or manually:
 *
 * curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/skool-post-scheduler"
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@0ne/db/server'
import { uploadFileFromUrl, createPost } from '@/features/skool/lib/post-client'
import type {
  SkoolScheduledPost,
  SkoolPostLibraryItem,
  SkoolPostExecutionLogInput,
  SkoolOneOffPost,
} from '@0ne/db'

export const maxDuration = 120 // 2 minutes max

const COOLDOWN_HOURS = 72

interface SchedulerWithVariationGroup extends SkoolScheduledPost {
  variation_group_id: string | null
}

/**
 * GET /api/cron/skool-post-scheduler
 *
 * Checks for scheduled posts due to run and publishes them.
 * Uses America/New_York timezone for all time comparisons.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()

  // Get current time in ET (America/New_York)
  const now = new Date()
  const etFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = etFormatter.formatToParts(now)
  const weekdayPart = parts.find((p) => p.type === 'weekday')?.value || 'Sun'
  const hourPart = parts.find((p) => p.type === 'hour')?.value || '00'
  const minutePart = parts.find((p) => p.type === 'minute')?.value || '00'

  // Map weekday to day_of_week number
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  const dayOfWeek = dayMap[weekdayPart] ?? 0

  // Current time in HH:MM format
  const currentTime = `${hourPart}:${minutePart}`

  // Calculate 15 minutes earlier for window (cron may run slightly late)
  const currentMinutes = parseInt(hourPart) * 60 + parseInt(minutePart)
  const windowStartMinutes = Math.max(0, currentMinutes - 15)
  const windowStartHour = Math.floor(windowStartMinutes / 60)
  const windowStartMin = windowStartMinutes % 60
  const windowStartTime = `${windowStartHour.toString().padStart(2, '0')}:${windowStartMin.toString().padStart(2, '0')}`

  // Get today's date at midnight in ET for last_run_at comparison
  const etDateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const dateParts = etDateFormatter.formatToParts(now)
  const year = dateParts.find((p) => p.type === 'year')?.value || '2026'
  const month = dateParts.find((p) => p.type === 'month')?.value || '01'
  const day = dateParts.find((p) => p.type === 'day')?.value || '01'
  const todayStartISO = `${year}-${month}-${day}T00:00:00.000Z`

  console.log(`[skool-post-scheduler] Current: ${weekdayPart} (${dayOfWeek}), ${currentTime} ET`)
  console.log(`[skool-post-scheduler] Window: ${windowStartTime} to ${currentTime}`)

  const results: Array<{
    type: 'recurring' | 'oneoff'
    id: string
    status: 'success' | 'failed' | 'skipped'
    postId?: string
    postTitle?: string
    reason?: string
    error?: string
    emailBlastSent?: boolean
  }> = []

  // =============================================================================
  // 1. PROCESS RECURRING SCHEDULERS
  // =============================================================================

  const { data: schedulers, error: schedError } = await supabase
    .from('skool_scheduled_posts')
    .select('*')
    .eq('is_active', true)
    .eq('day_of_week', dayOfWeek)
    .gte('time', windowStartTime)
    .lte('time', currentTime)
    .or(`last_run_at.is.null,last_run_at.lt.${todayStartISO}`)

  if (schedError) {
    console.error('[skool-post-scheduler] Error querying schedulers:', schedError)
    return NextResponse.json({ error: schedError.message }, { status: 500 })
  }

  console.log(`[skool-post-scheduler] Found ${schedulers?.length || 0} due recurring schedulers`)

  for (const scheduler of (schedulers || []) as SchedulerWithVariationGroup[]) {
    console.log(
      `[skool-post-scheduler] Processing scheduler ${scheduler.id} (${scheduler.category} @ ${scheduler.time})`
    )

    // Find oldest unused post - prefer variation_group_id if set, else fall back to legacy matching
    // IMPORTANT: Only select approved or active posts (never drafts)
    let postQuery = supabase
      .from('skool_post_library')
      .select('*')
      .eq('is_active', true)
      .in('status', ['approved', 'active']) // Filter out drafts
      .order('last_used_at', { ascending: true, nullsFirst: true })
      .limit(1)

    if (scheduler.variation_group_id) {
      // New matching: by variation group
      postQuery = postQuery.eq('variation_group_id', scheduler.variation_group_id)
      console.log(
        `[skool-post-scheduler] Matching by variation_group_id: ${scheduler.variation_group_id}`
      )
    } else {
      // Legacy matching: category + day_of_week + time
      postQuery = postQuery
        .eq('category', scheduler.category)
        .eq('day_of_week', scheduler.day_of_week)
        .eq('time', scheduler.time)
      console.log(`[skool-post-scheduler] Using legacy matching (category/day/time)`)
    }

    const { data: posts, error: postError } = await postQuery

    if (postError) {
      console.error(`[skool-post-scheduler] Error querying post library:`, postError)
      await logExecution(supabase, {
        scheduler_id: scheduler.id,
        status: 'failed',
        error_message: `Database error: ${postError.message}`,
      })
      results.push({
        type: 'recurring',
        id: scheduler.id,
        status: 'failed',
        error: postError.message,
      })
      continue
    }

    const post = (posts as SkoolPostLibraryItem[] | null)?.[0]

    if (!post) {
      console.log(`[skool-post-scheduler] No approved/active posts available for scheduler ${scheduler.id}`)
      await logExecution(supabase, {
        scheduler_id: scheduler.id,
        status: 'skipped',
        error_message: 'No approved posts available for rotation (drafts are excluded)',
      })
      results.push({
        type: 'recurring',
        id: scheduler.id,
        status: 'skipped',
        reason: 'no approved posts',
      })
      continue
    }

    try {
      const result = await publishPost(
        supabase,
        {
          groupSlug: scheduler.group_slug,
          categoryId: scheduler.category_id || undefined,
          title: post.title,
          body: post.body,
          imageUrl: post.image_url,
          videoUrl: post.video_url,
        },
        { scheduler_id: scheduler.id, post_library_id: post.id }
      )

      if (result.success) {
        // Update post usage
        await supabase
          .from('skool_post_library')
          .update({
            last_used_at: new Date().toISOString(),
            use_count: post.use_count + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', post.id)

        // Update scheduler last run
        await supabase
          .from('skool_scheduled_posts')
          .update({
            last_run_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', scheduler.id)

        results.push({
          type: 'recurring',
          id: scheduler.id,
          status: 'success',
          postId: result.postId,
          postTitle: post.title,
        })
      } else {
        results.push({
          type: 'recurring',
          id: scheduler.id,
          status: 'failed',
          error: result.error,
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[skool-post-scheduler] Exception:`, error)
      await logExecution(supabase, {
        scheduler_id: scheduler.id,
        post_library_id: post.id,
        status: 'failed',
        error_message: errorMessage,
      })
      results.push({
        type: 'recurring',
        id: scheduler.id,
        status: 'failed',
        error: errorMessage,
      })
    }
  }

  // =============================================================================
  // 2. PROCESS ONE-OFF SCHEDULED POSTS
  // =============================================================================

  const { data: oneOffPosts, error: oneOffError } = await supabase
    .from('skool_oneoff_posts')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', now.toISOString())

  if (oneOffError) {
    console.error('[skool-post-scheduler] Error querying one-off posts:', oneOffError)
  } else {
    console.log(`[skool-post-scheduler] Found ${oneOffPosts?.length || 0} due one-off posts`)

    for (const oneOff of (oneOffPosts || []) as SkoolOneOffPost[]) {
      console.log(`[skool-post-scheduler] Processing one-off post ${oneOff.id} ("${oneOff.title}")`)

      // Check email blast availability if requested
      let canSendEmailBlast = false
      if (oneOff.send_email_blast) {
        const { data: settings } = await supabase
          .from('skool_group_settings')
          .select('last_email_blast_at')
          .eq('group_slug', oneOff.group_slug)
          .single()

        if (settings?.last_email_blast_at) {
          const lastBlast = new Date(settings.last_email_blast_at)
          const cooldownEnd = new Date(lastBlast.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000)
          canSendEmailBlast = now >= cooldownEnd
        } else {
          canSendEmailBlast = true
        }

        if (!canSendEmailBlast) {
          console.log(`[skool-post-scheduler] Email blast cooldown active, skipping blast`)
        }
      }

      try {
        const result = await publishPost(
          supabase,
          {
            groupSlug: oneOff.group_slug,
            categoryId: oneOff.category_id || undefined,
            title: oneOff.title,
            body: oneOff.body,
            imageUrl: oneOff.image_url,
            videoUrl: oneOff.video_url,
            sendEmailBlast: oneOff.send_email_blast && canSendEmailBlast,
          },
          { oneoff_post_id: oneOff.id }
        )

        if (result.success) {
          // Update one-off post status
          await supabase
            .from('skool_oneoff_posts')
            .update({
              status: 'published',
              published_at: new Date().toISOString(),
              skool_post_id: result.postId,
              skool_post_url: result.postUrl,
              updated_at: new Date().toISOString(),
            })
            .eq('id', oneOff.id)

          // Record email blast if sent
          if (oneOff.send_email_blast && canSendEmailBlast) {
            await supabase
              .from('skool_group_settings')
              .upsert({
                group_slug: oneOff.group_slug,
                last_email_blast_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
          }

          results.push({
            type: 'oneoff',
            id: oneOff.id,
            status: 'success',
            postId: result.postId,
            postTitle: oneOff.title,
            emailBlastSent: oneOff.send_email_blast && canSendEmailBlast,
          })
        } else {
          // Update one-off post with error
          await supabase
            .from('skool_oneoff_posts')
            .update({
              status: 'failed',
              error_message: result.error,
              updated_at: new Date().toISOString(),
            })
            .eq('id', oneOff.id)

          results.push({
            type: 'oneoff',
            id: oneOff.id,
            status: 'failed',
            error: result.error,
          })
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[skool-post-scheduler] One-off post exception:`, error)

        await supabase
          .from('skool_oneoff_posts')
          .update({
            status: 'failed',
            error_message: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', oneOff.id)

        await logExecution(supabase, {
          oneoff_post_id: oneOff.id,
          status: 'failed',
          error_message: errorMessage,
        })

        results.push({
          type: 'oneoff',
          id: oneOff.id,
          status: 'failed',
          error: errorMessage,
        })
      }
    }
  }

  const summary = {
    success: true,
    timestamp: now.toISOString(),
    timezone: 'America/New_York',
    dayOfWeek,
    currentTime,
    recurringProcessed: schedulers?.length || 0,
    oneOffProcessed: oneOffPosts?.length || 0,
    results,
  }

  console.log(`[skool-post-scheduler] Complete:`, JSON.stringify(summary))

  return NextResponse.json(summary)
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

interface PublishPostInput {
  groupSlug: string
  categoryId?: string
  title: string
  body: string
  imageUrl?: string | null
  videoUrl?: string | null
  sendEmailBlast?: boolean
}

interface PublishPostRefs {
  scheduler_id?: string
  post_library_id?: string
  oneoff_post_id?: string
}

interface PublishPostResult {
  success: boolean
  postId?: string
  postUrl?: string
  error?: string
}

/**
 * Publish a post to Skool
 */
async function publishPost(
  supabase: ReturnType<typeof createServerClient>,
  input: PublishPostInput,
  refs: PublishPostRefs
): Promise<PublishPostResult> {
  try {
    // Upload image if present
    let attachmentIds: string[] = []
    if (input.imageUrl) {
      console.log(`[skool-post-scheduler] Uploading image: ${input.imageUrl}`)
      const upload = await uploadFileFromUrl(input.imageUrl, input.groupSlug)
      if ('fileId' in upload && upload.fileId) {
        attachmentIds = [upload.fileId]
        console.log(`[skool-post-scheduler] Image uploaded: ${upload.fileId}`)
      } else {
        console.log(
          `[skool-post-scheduler] Image upload failed, continuing without image:`,
          'error' in upload ? upload.error : 'Unknown error'
        )
      }
    }

    // Create the post
    console.log(`[skool-post-scheduler] Creating post: "${input.title}" in ${input.groupSlug}`)
    const postResult = await createPost({
      groupSlug: input.groupSlug,
      title: input.title,
      body: input.body,
      categoryId: input.categoryId,
      attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
      videoLinks: input.videoUrl ? [input.videoUrl] : undefined,
      // Note: sendEmailBlast would need to be added to createPost if Skool API supports it
    })

    if (postResult.success) {
      console.log(`[skool-post-scheduler] Post created successfully: ${postResult.postId}`)

      await logExecution(supabase, {
        ...refs,
        status: 'success',
        skool_post_id: postResult.postId,
        skool_post_url: postResult.postUrl,
        email_blast_sent: input.sendEmailBlast || false,
      })

      return {
        success: true,
        postId: postResult.postId,
        postUrl: postResult.postUrl,
      }
    } else {
      console.error(`[skool-post-scheduler] Post creation failed:`, postResult.error)

      await logExecution(supabase, {
        ...refs,
        status: 'failed',
        error_message: postResult.error,
      })

      return {
        success: false,
        error: postResult.error,
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[skool-post-scheduler] Publish exception:`, error)

    await logExecution(supabase, {
      ...refs,
      status: 'failed',
      error_message: errorMessage,
    })

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Insert execution log entry
 */
async function logExecution(
  supabase: ReturnType<typeof createServerClient>,
  log: SkoolPostExecutionLogInput
) {
  const { error } = await supabase.from('skool_post_execution_log').insert({
    ...log,
    executed_at: new Date().toISOString(),
  })

  if (error) {
    console.error('[skool-post-scheduler] Failed to log execution:', error)
  }
}
