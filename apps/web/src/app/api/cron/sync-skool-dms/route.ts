/**
 * Sync Skool DMs Cron Endpoint
 *
 * Syncs inbound Skool DMs to GHL inbox.
 * Runs every 5 minutes via Vercel Cron.
 *
 * Manual invocation:
 * curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/sync-skool-dms"
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  syncInboundMessages,
  syncExtensionMessages,
  getEnabledSyncConfigs,
  type InboundSyncResult,
} from '@/features/dm-sync'
import { SyncLogger } from '@/lib/sync-log'

export const maxDuration = 300 // 5 minutes max for sync

/**
 * GET /api/cron/sync-skool-dms
 *
 * Syncs inbound Skool DMs to GHL inbox for all enabled users.
 *
 * Query params:
 * - user_id: Optional - sync only for specific user
 * - backfill: Optional - enable full history backfill mode (true/false)
 * - max_messages: Optional - max messages per conversation in backfill mode (default: 200)
 * - skool_user_id: Optional - sync only for specific Skool user (by their Skool ID)
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (allow localhost bypass for development)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isLocalhost = request.headers.get('host')?.includes('localhost')
  const bypassAuth = isLocalhost && request.nextUrl.searchParams.get('dev') === 'true'

  if (!bypassAuth && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const specificUserId = searchParams.get('user_id')
  const backfillMode = searchParams.get('backfill') === 'true'
  const maxMessages = parseInt(searchParams.get('max_messages') || '200', 10)
  const filterSkoolUserId = searchParams.get('skool_user_id')

  const startTime = Date.now()
  console.log('[sync-skool-dms] Starting inbound sync')

  const syncLogger = new SyncLogger('skool_dms')
  await syncLogger.start({ source: 'cron' })

  try {
    // Get enabled sync configs
    const configs = await getEnabledSyncConfigs()

    if (configs.length === 0) {
      console.log('[sync-skool-dms] No enabled sync configs found')
      await syncLogger.complete(0, { message: 'No enabled sync configs' })
      return NextResponse.json({
        success: true,
        message: 'No enabled sync configs',
        duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      })
    }

    // Filter to specific user if requested
    const targetConfigs = specificUserId
      ? configs.filter((c) => c.user_id === specificUserId)
      : configs

    if (targetConfigs.length === 0) {
      await syncLogger.complete(0, { message: 'No matching sync configs' })
      return NextResponse.json({
        success: true,
        message: 'No matching sync configs',
        duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      })
    }

    console.log(`[sync-skool-dms] Processing ${targetConfigs.length} users`)

    // Process each user's sync
    const results: Array<{
      userId: string
      result: InboundSyncResult
    }> = []

    for (const config of targetConfigs) {
      try {
        console.log(`[sync-skool-dms] Syncing user: ${config.user_id}${backfillMode ? ' (BACKFILL MODE)' : ''}`)
        const result = await syncInboundMessages(config.user_id, {
          backfill: backfillMode,
          maxMessagesPerConversation: maxMessages,
          filterUserId: filterSkoolUserId || undefined,
        })
        results.push({
          userId: config.user_id,
          result,
        })
      } catch (error) {
        console.error(
          `[sync-skool-dms] Error syncing user ${config.user_id}:`,
          error instanceof Error ? error.message : error
        )
        results.push({
          userId: config.user_id,
          result: {
            synced: 0,
            skipped: 0,
            errors: 1,
            errorDetails: [
              {
                error: error instanceof Error ? error.message : String(error),
              },
            ],
          },
        })
      }
    }

    // Also sync extension-captured messages to GHL
    for (const config of targetConfigs) {
      try {
        const extResult = await syncExtensionMessages(config.user_id)
        console.log(`[sync-skool-dms] Extension sync for ${config.user_id}: synced=${extResult.synced}, skipped=${extResult.skipped}, errors=${extResult.errors}`)
        // Add extension results to the user's results
        const userResult = results.find((r) => r.userId === config.user_id)
        if (userResult) {
          userResult.result.synced += extResult.synced
          userResult.result.skipped += extResult.skipped
          userResult.result.errors += extResult.errors
        }
      } catch (error) {
        console.error(`[sync-skool-dms] Extension sync error for ${config.user_id}:`, error)
      }
    }

    // Aggregate results
    const totals = results.reduce(
      (acc, r) => ({
        synced: acc.synced + r.result.synced,
        skipped: acc.skipped + r.result.skipped,
        errors: acc.errors + r.result.errors,
      }),
      { synced: 0, skipped: 0, errors: 0 }
    )

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(
      `[sync-skool-dms] Completed in ${duration}s: synced=${totals.synced}, skipped=${totals.skipped}, errors=${totals.errors}`
    )

    if (totals.errors === 0) {
      await syncLogger.complete(totals.synced, { skipped: totals.skipped })
    } else {
      await syncLogger.fail(`${totals.errors} user syncs failed`, totals.synced)
    }

    return NextResponse.json({
      success: totals.errors === 0,
      duration: `${duration}s`,
      totals,
      users: results.map((r) => ({
        userId: r.userId,
        synced: r.result.synced,
        skipped: r.result.skipped,
        errors: r.result.errors,
        errorDetails: r.result.errorDetails,
        debugInfo: bypassAuth ? r.result.debugInfo : undefined,
      })),
    })
  } catch (error) {
    console.error('[sync-skool-dms] Fatal error:', error)
    await syncLogger.fail(error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      },
      { status: 500 }
    )
  }
}
