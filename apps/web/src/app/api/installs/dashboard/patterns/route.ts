/**
 * GET /api/installs/dashboard/patterns
 *
 * Internal (Clerk-auth) list of failure patterns for the dashboard UI.
 * Same data as the external /api/installs/patterns route but uses Clerk session auth.
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
    const category = searchParams.get('category')

    const supabase = createServerClient()

    let query = supabase
      .from('telemetry_failure_patterns')
      .select('*')

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query
      .order('occurrence_count', { ascending: false })

    if (error) {
      console.error('[Installs Dashboard Patterns API] Query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('[Installs Dashboard Patterns API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
