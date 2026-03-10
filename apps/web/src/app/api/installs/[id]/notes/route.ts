/**
 * POST /api/installs/[id]/notes
 *
 * Add a note to an event without changing its status.
 * Auth: Bearer token (TELEMETRY_API_KEY env var)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@0ne/db/server'

export const dynamic = 'force-dynamic'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Validate bearer token
  const authHeader = request.headers.get('authorization')
  const expectedKey = process.env.TELEMETRY_API_KEY

  if (!expectedKey) {
    console.error('[Installs Notes API] TELEMETRY_API_KEY environment variable not set')
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500, headers: corsHeaders }
    )
  }

  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i)
  if (!bearerMatch || bearerMatch[1] !== expectedKey) {
    return NextResponse.json(
      { error: 'Invalid or missing authorization' },
      { status: 401, headers: corsHeaders }
    )
  }

  try {
    const { id } = await params
    const body = await request.json()

    const { note } = body as { note?: string }

    if (!note || typeof note !== 'string' || note.trim().length === 0) {
      return NextResponse.json(
        { error: 'note is required and must be a non-empty string' },
        { status: 400, headers: corsHeaders }
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
        return NextResponse.json(
          { error: 'Event not found' },
          { status: 404, headers: corsHeaders }
        )
      }
      console.error('[Installs Notes API] Fetch error:', fetchError)
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500, headers: corsHeaders }
      )
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
      console.error('[Installs Notes API] Insert error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: corsHeaders }
      )
    }

    return NextResponse.json(
      { success: true, id: data.id },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('[Installs Notes API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
