/**
 * GET /api/installs/dashboard/[id]
 *
 * Internal (Clerk-auth) single telemetry event with full details and status history.
 * Browser-callable version of the external /api/installs/[id] route.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@0ne/db/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const supabase = createServerClient()

    // Fetch event and status history in parallel
    const [eventResult, historyResult] = await Promise.all([
      supabase
        .from('telemetry_events')
        .select('*')
        .eq('id', id)
        .single(),

      supabase
        .from('telemetry_status_history')
        .select('*')
        .eq('event_id', id)
        .order('created_at', { ascending: false }),
    ])

    if (eventResult.error) {
      if (eventResult.error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }
      console.error('[Installs Dashboard Detail API] Query error:', eventResult.error)
      return NextResponse.json({ error: eventResult.error.message }, { status: 500 })
    }

    if (historyResult.error) {
      console.error('[Installs Dashboard Detail API] History query error:', historyResult.error)
      // Non-fatal — return event without history
    }

    return NextResponse.json({
      event: eventResult.data,
      status_history: historyResult.data || [],
    })
  } catch (error) {
    console.error('[Installs Dashboard Detail API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
