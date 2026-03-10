/**
 * POST /api/installs/patterns/[id]/fix
 *
 * Record a known fix for a failure pattern.
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
    console.error('[Installs Pattern Fix API] TELEMETRY_API_KEY environment variable not set')
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

    const { known_fix, auto_fixable } = body as {
      known_fix?: string
      auto_fixable?: boolean
    }

    if (!known_fix || typeof known_fix !== 'string' || known_fix.trim().length === 0) {
      return NextResponse.json(
        { error: 'known_fix is required and must be a non-empty string' },
        { status: 400, headers: corsHeaders }
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
          { status: 404, headers: corsHeaders }
        )
      }
      console.error('[Installs Pattern Fix API] Update error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: corsHeaders }
      )
    }

    return NextResponse.json(
      { success: true, pattern: data },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('[Installs Pattern Fix API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
