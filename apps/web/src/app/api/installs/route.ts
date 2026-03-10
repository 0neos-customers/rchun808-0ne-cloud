/**
 * GET /api/installs
 *
 * Paginated list of telemetry events with filtering.
 * Auth: Bearer token (TELEMETRY_API_KEY env var)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@0ne/db/server'

export const dynamic = 'force-dynamic'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

export async function GET(request: NextRequest) {
  // Validate bearer token
  const authHeader = request.headers.get('authorization')
  const expectedKey = process.env.TELEMETRY_API_KEY

  if (!expectedKey) {
    console.error('[Installs API] TELEMETRY_API_KEY environment variable not set')
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
    const { searchParams } = request.nextUrl
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') || '25', 10)))
    const eventType = searchParams.get('event_type')
    const platform = searchParams.get('platform')
    const status = searchParams.get('status')
    const principalName = searchParams.get('principal_name')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    const supabase = createServerClient()

    // Build query with filters
    let query = supabase
      .from('telemetry_events')
      .select('*', { count: 'exact' })

    if (eventType) {
      query = query.eq('event_type', eventType)
    }
    if (platform) {
      query = query.eq('platform', platform)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (principalName) {
      query = query.ilike('principal_name', `%${principalName}%`)
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo)
    }

    // Pagination
    const from = (page - 1) * perPage
    const to = from + perPage - 1

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('[Installs API] Query error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: corsHeaders }
      )
    }

    return NextResponse.json(
      {
        data: data || [],
        total: count || 0,
        page,
        per_page: perPage,
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('[Installs API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
