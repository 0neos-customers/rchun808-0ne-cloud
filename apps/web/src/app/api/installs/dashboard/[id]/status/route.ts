/**
 * PATCH /api/installs/dashboard/[id]/status
 *
 * Internal (Clerk-auth) status update for telemetry events.
 * Browser-callable version of the external /api/installs/[id]/status route.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@0ne/db/server'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['triaged', 'fixed', 'deployed'] as const
type ValidStatus = (typeof VALID_STATUSES)[number]

// Map status to its timestamp column
const STATUS_TIMESTAMP_MAP: Record<ValidStatus, string> = {
  triaged: 'triaged_at',
  fixed: 'fixed_at',
  deployed: 'deployed_at',
}

export async function PATCH(
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

    const { status, note, fix_commit, fix_notes } = body as {
      status?: string
      note?: string
      fix_commit?: string
      fix_notes?: string
    }

    // Validate status
    if (!status || !VALID_STATUSES.includes(status as ValidStatus)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Fetch current event to get old status
    const { data: currentEvent, error: fetchError } = await supabase
      .from('telemetry_events')
      .select('status')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }
      console.error('[Installs Dashboard Status API] Fetch error:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const oldStatus = currentEvent.status || 'new'

    // Build update payload
    const timestampCol = STATUS_TIMESTAMP_MAP[status as ValidStatus]
    const updatePayload: Record<string, unknown> = {
      status,
      [timestampCol]: new Date().toISOString(),
    }

    if (fix_commit !== undefined) {
      updatePayload.fix_commit = fix_commit
    }
    if (fix_notes !== undefined) {
      updatePayload.fix_notes = fix_notes
    }

    // Update event and insert history in parallel
    const [updateResult, historyResult] = await Promise.all([
      supabase
        .from('telemetry_events')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single(),

      supabase
        .from('telemetry_status_history')
        .insert({
          event_id: id,
          old_status: oldStatus,
          new_status: status,
          note: note || null,
        }),
    ])

    if (updateResult.error) {
      console.error('[Installs Dashboard Status API] Update error:', updateResult.error)
      return NextResponse.json({ error: updateResult.error.message }, { status: 500 })
    }

    if (historyResult.error) {
      console.error('[Installs Dashboard Status API] History insert error (non-fatal):', historyResult.error)
    }

    return NextResponse.json({ success: true, event: updateResult.data })
  } catch (error) {
    console.error('[Installs Dashboard Status API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
