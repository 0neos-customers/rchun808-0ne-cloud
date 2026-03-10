/**
 * GET /api/installs/dashboard
 *
 * Internal (Clerk-auth) paginated list of telemetry events for the dashboard UI.
 * Same data as the external /api/installs route but uses Clerk session auth
 * instead of Bearer token so the browser can call it directly.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@0ne/db/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      console.error('[Installs Dashboard API] Query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      page,
      per_page: perPage,
    })
  } catch (error) {
    console.error('[Installs Dashboard API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
