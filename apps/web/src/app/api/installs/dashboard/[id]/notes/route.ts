/**
 * POST /api/installs/dashboard/[id]/notes
 *
 * Internal (Clerk-auth) note addition for telemetry events.
 * Browser-callable version of the external /api/installs/[id]/notes route.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@0ne/db/server'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()

    const { note } = body as { note?: string }

    if (!note || typeof note !== 'string' || note.trim().length === 0) {
      return NextResponse.json(
        { error: 'note is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Fetch current status so we can record it in history
    const { data: currentEvent, error: fetchError } = await supabase
      .from('telemetry_events')
      .select('status')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }
      console.error('[Installs Dashboard Notes API] Fetch error:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const currentStatus = currentEvent.status || 'new'

    // Insert note as history entry (status unchanged)
    const { data, error } = await supabase
      .from('telemetry_status_history')
      .insert({
        event_id: id,
        old_status: currentStatus,
        new_status: currentStatus,
        note: note.trim(),
      })
      .select('id')
      .single()

    if (error) {
      console.error('[Installs Dashboard Notes API] Insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data.id })
  } catch (error) {
    console.error('[Installs Dashboard Notes API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
