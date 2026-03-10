/**
 * GET /api/installs/dashboard/stats
 *
 * Internal (Clerk-auth) aggregate statistics for telemetry events.
 * Same data as the external /api/installs/stats route but uses Clerk session auth.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@0ne/db/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServerClient()

    // Run all aggregate queries in parallel
    const [installsResult, doctorResult, allEventsResult, fixEventsResult] = await Promise.all([
      // Count installs
      supabase
        .from('telemetry_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'install'),

      // Count doctor runs
      supabase
        .from('telemetry_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'doctor'),

      // Fetch all events with summary for success rate + avg issues calculation
      supabase
        .from('telemetry_events')
        .select('summary'),

      // Fetch events with fix_summary for total fixes count
      supabase
        .from('telemetry_events')
        .select('fix_summary')
        .not('fix_summary', 'is', null),
    ])

    if (installsResult.error || doctorResult.error || allEventsResult.error || fixEventsResult.error) {
      const err = installsResult.error || doctorResult.error || allEventsResult.error || fixEventsResult.error
      console.error('[Installs Dashboard Stats API] Query error:', err)
      return NextResponse.json({ error: err!.message }, { status: 500 })
    }

    const totalInstalls = installsResult.count || 0
    const totalDoctorRuns = doctorResult.count || 0

    // Calculate success rate and average issues from summary data
    const events = allEventsResult.data || []
    let successCount = 0
    let totalFails = 0
    let eventsWithSummary = 0

    for (const event of events) {
      if (event.summary && typeof event.summary === 'object') {
        const summary = event.summary as Record<string, unknown>
        const failCount = parseInt(String(summary.fail || '0'), 10)
        if (!isNaN(failCount)) {
          eventsWithSummary++
          totalFails += failCount
          if (failCount === 0) {
            successCount++
          }
        }
      }
    }

    const successRate = eventsWithSummary > 0
      ? Math.round((successCount / eventsWithSummary) * 10000) / 100
      : 0
    const avgIssues = eventsWithSummary > 0
      ? Math.round((totalFails / eventsWithSummary) * 100) / 100
      : 0

    // Sum total successful fixes from fix_summary JSONB
    const fixEvents = fixEventsResult.data || []
    let totalFixes = 0
    for (const event of fixEvents) {
      if (event.fix_summary && typeof event.fix_summary === 'object') {
        const fs = event.fix_summary as Record<string, unknown>
        const succeeded = parseInt(String(fs.fixes_succeeded || '0'), 10)
        if (!isNaN(succeeded)) {
          totalFixes += succeeded
        }
      }
    }

    return NextResponse.json({
      total_installs: totalInstalls,
      total_doctor_runs: totalDoctorRuns,
      success_rate: successRate,
      avg_issues: avgIssues,
      total_fixes: totalFixes,
    })
  } catch (error) {
    console.error('[Installs Dashboard Stats API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
