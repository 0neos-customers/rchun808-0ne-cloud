/**
 * POST /api/installs/dashboard/patterns/[id]/fix
 *
 * Internal (Clerk-auth) endpoint to document a known fix for a failure pattern.
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

    const { known_fix, auto_fixable } = body as {
      known_fix?: string
      auto_fixable?: boolean
    }

    if (!known_fix || typeof known_fix !== 'string' || known_fix.trim().length === 0) {
      return NextResponse.json(
        { error: 'known_fix is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    const updatePayload: Record<string, unknown> = {
      known_fix: known_fix.trim(),
      updated_at: new Date().toISOString(),
    }

    if (typeof auto_fixable === 'boolean') {
      updatePayload.auto_fixable = auto_fixable
    }

    const { data, error } = await supabase
      .from('telemetry_failure_patterns')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Pattern not found' },
          { status: 404 }
        )
      }
      console.error('[Installs Dashboard Pattern Fix API] Update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, pattern: data })
  } catch (error) {
    console.error('[Installs Dashboard Pattern Fix API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
