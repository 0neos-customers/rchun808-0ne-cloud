/**
 * Daily Snapshot Cron Job
 *
 * Runs hourly and sends daily snapshot notifications to users
 * whose delivery_time matches the current hour.
 *
 * Security: Protected by CRON_SECRET bearer token
 * Schedule: 0 * * * * (every hour at minute 0)
 */

import { NextResponse } from 'next/server'
import { db } from '@0ne/db/server'
import { syncActivityLog } from '@0ne/db/server'
import { sendScheduledSnapshots } from '@/features/notifications/lib/send-notification'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('[cron/send-daily-snapshot] Unauthorized request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const currentHour = new Date().getUTCHours()

  console.log(`[cron/send-daily-snapshot] Starting - Hour ${currentHour} UTC`)

  try {
    // Send snapshots to all eligible users
    const results = await sendScheduledSnapshots(currentHour)

    // Calculate stats
    const totalUsers = results.length
    const successCount = results.filter((r) => r.success).length
    const failedCount = totalUsers - successCount

    // Log to sync_activity_log
    try {
      await db.insert(syncActivityLog).values({
        syncType: 'daily_snapshot',
        status: failedCount === 0 ? 'success' : 'partial',
        recordsSynced: successCount,
        errorMessage: failedCount > 0 ? `${failedCount} failed` : null,
        metadata: {
          hour: currentHour,
          recordsProcessed: totalUsers,
          errorCount: failedCount,
          results: results.map((r) => ({
            userId: r.userId,
            success: r.success,
            error: r.error,
          })),
        },
        startedAt: new Date(startTime),
        completedAt: new Date(),
      })
    } catch (logError) {
      // Log table might not exist, that's okay
      console.log('[cron/send-daily-snapshot] Could not log to sync_activity_log:', logError)
    }

    const duration = Date.now() - startTime

    console.log(
      `[cron/send-daily-snapshot] Completed - ${successCount}/${totalUsers} sent in ${duration}ms`
    )

    return NextResponse.json({
      success: true,
      hour: currentHour,
      users: {
        total: totalUsers,
        success: successCount,
        failed: failedCount,
      },
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[cron/send-daily-snapshot] Fatal error:', error)

    // Log error to sync_activity_log
    try {
      await db.insert(syncActivityLog).values({
        syncType: 'daily_snapshot',
        status: 'error',
        recordsSynced: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          hour: currentHour,
          recordsProcessed: 0,
          errorCount: 1,
        },
        startedAt: new Date(startTime),
        completedAt: new Date(),
      })
    } catch {
      // Ignore logging errors
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        hour: currentHour,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
