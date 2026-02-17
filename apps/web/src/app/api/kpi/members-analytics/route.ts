import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@0ne/db/server'
import { sanitizeForPostgrestFilter } from '@/lib/postgrest-utils'

// Type for the Supabase client
type SupabaseClient = ReturnType<typeof createServerClient>

/**
 * Query skool_members directly when filtering by attribution source.
 * Calculates daily new member counts by grouping on member_since date.
 */
async function getFilteredBySource(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string,
  sources: string[],
  range: string
): Promise<NextResponse> {
  // Handle null sources: if sources includes 'unknown', we need to include NULL attribution_source
  const includesUnknown = sources.includes('unknown') || sources.includes('null')
  const regularSources = sources.filter(s => s !== 'unknown' && s !== 'null')
  const safeRegularSources = regularSources.map(sanitizeForPostgrestFilter)

  // Build query for members with join date in range
  // We need to get all members who joined in the date range and match the source filter
  let query = supabase
    .from('skool_members')
    .select('member_since, attribution_source')
    .eq('group_slug', 'fruitful')
    .gte('member_since', `${startDate}T00:00:00Z`)
    .lte('member_since', `${endDate}T23:59:59Z`)

  // Apply source filter
  if (includesUnknown && safeRegularSources.length > 0) {
    // Need both null AND specific sources - use OR filter
    query = query.or(`attribution_source.in.(${safeRegularSources.join(',')}),attribution_source.is.null`)
  } else if (includesUnknown) {
    // Only unknown/null sources
    query = query.is('attribution_source', null)
  } else {
    // Only regular sources
    query = query.in('attribution_source', safeRegularSources)
  }

  const { data: members, error } = await query

  if (error) {
    console.error('[Members Analytics] Source filter error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch filtered members data' },
      { status: 500 }
    )
  }

  console.log(`[Members Analytics] Found ${members?.length || 0} members matching sources: ${sources.join(', ')}`)

  // Aggregate by date
  const dailyMap = new Map<string, number>()

  // Initialize all dates in range with 0
  const currentDate = new Date(startDate)
  const endDateObj = new Date(endDate)
  while (currentDate <= endDateObj) {
    dailyMap.set(currentDate.toISOString().split('T')[0], 0)
    currentDate.setDate(currentDate.getDate() + 1)
  }

  // Count new members per day
  ;(members || []).forEach((member) => {
    if (member.member_since) {
      const joinDate = new Date(member.member_since).toISOString().split('T')[0]
      if (dailyMap.has(joinDate)) {
        dailyMap.set(joinDate, (dailyMap.get(joinDate) || 0) + 1)
      }
    }
  })

  // Build daily array with cumulative totals
  const sortedDates = Array.from(dailyMap.keys()).sort()
  let runningTotal = 0

  // Get count of members who joined BEFORE the start date (for cumulative count)
  let beforeQuery = supabase
    .from('skool_members')
    .select('id', { count: 'exact', head: true })
    .eq('group_slug', 'fruitful')
    .lt('member_since', `${startDate}T00:00:00Z`)

  if (includesUnknown && safeRegularSources.length > 0) {
    beforeQuery = beforeQuery.or(`attribution_source.in.(${safeRegularSources.join(',')}),attribution_source.is.null`)
  } else if (includesUnknown) {
    beforeQuery = beforeQuery.is('attribution_source', null)
  } else {
    beforeQuery = beforeQuery.in('attribution_source', safeRegularSources)
  }

  const { count: beforeCount } = await beforeQuery
  runningTotal = beforeCount || 0

  const daily = sortedDates.map((date) => {
    const newMembers = dailyMap.get(date) || 0
    runningTotal += newMembers
    return {
      date,
      totalMembers: runningTotal,
      activeMembers: 0, // Not available when filtering by source
      newMembers,
      source: sources.join(','),
    }
  })

  // Calculate monthly aggregates
  const monthlyMap = new Map<string, {
    month: string
    totalMembers: number
    newMembers: number
    count: number
  }>()

  daily.forEach((row) => {
    const month = row.date.substring(0, 7)
    const existing = monthlyMap.get(month)
    if (existing) {
      existing.totalMembers = row.totalMembers
      existing.newMembers += row.newMembers
      existing.count++
    } else {
      monthlyMap.set(month, {
        month,
        totalMembers: row.totalMembers,
        newMembers: row.newMembers,
        count: 1,
      })
    }
  })

  const monthly = Array.from(monthlyMap.values()).map((m) => ({
    date: `${m.month}-01`,
    month: m.month,
    totalMembers: m.totalMembers,
    newMembers: m.newMembers,
  }))

  // Calculate totals
  const latestCount = daily.length > 0 ? daily[daily.length - 1].totalMembers : 0
  const earliestCount = daily.length > 0 ? daily[0].totalMembers - daily[0].newMembers : 0
  const totalNewMembers = daily.reduce((sum, d) => sum + d.newMembers, 0)
  const avgDailyMembers = daily.length > 0
    ? Math.round(daily.reduce((sum, d) => sum + d.totalMembers, 0) / daily.length)
    : 0

  return NextResponse.json({
    daily,
    monthly,
    totals: {
      currentMembers: latestCount,
      startMembers: earliestCount,
      newMembersInPeriod: totalNewMembers,
      avgDailyMembers,
      growth: earliestCount > 0 ? ((latestCount - earliestCount) / earliestCount * 100).toFixed(1) : 0,
    },
    period: {
      range,
      startDate,
      endDate,
    },
    sources,
  })
}

/**
 * GET /api/kpi/members-analytics
 *
 * Returns member count history from skool_members_daily table,
 * or filtered counts from skool_members when sources are specified.
 *
 * Query params:
 *   - startDate: Start of date range (YYYY-MM-DD)
 *   - endDate: End of date range (YYYY-MM-DD)
 *   - range: Preset range ('30d' or '1y') - used if no explicit dates
 *   - sources: Comma-separated list of attribution sources to filter by
 */
export async function GET(request: NextRequest) {
  const supabase = createServerClient()

  try {
    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const range = searchParams.get('range') || '30d'
    const sourcesParam = searchParams.get('sources')
    const sources = sourcesParam ? sourcesParam.split(',').filter(Boolean) : []

    // Calculate date range
    let startDate: string
    let endDate: string

    if (startDateParam && endDateParam) {
      startDate = startDateParam
      endDate = endDateParam
    } else {
      const now = new Date()
      endDate = now.toISOString().split('T')[0]

      if (range === '1y') {
        const oneYearAgo = new Date(now)
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
        startDate = oneYearAgo.toISOString().split('T')[0]
      } else {
        const thirtyDaysAgo = new Date(now)
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        startDate = thirtyDaysAgo.toISOString().split('T')[0]
      }
    }

    console.log(`[Members Analytics] sources=${sources.length > 0 ? sources.join(',') : 'all'}, ${startDate} to ${endDate}`)

    // If sources are specified, query skool_members directly and aggregate by date
    if (sources.length > 0) {
      return await getFilteredBySource(supabase, startDate, endDate, sources, range)
    }

    // No source filter - use pre-aggregated skool_members_daily data
    const { data: dailyData, error } = await supabase
      .from('skool_members_daily')
      .select('date, total_members, active_members, new_members, source')
      .eq('group_slug', 'fruitful')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })

    if (error) {
      console.error('[Members Analytics API] Error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch members data' },
        { status: 500 }
      )
    }

    // Transform data
    const daily = (dailyData || []).map((row) => ({
      date: row.date,
      totalMembers: row.total_members,
      activeMembers: row.active_members,
      newMembers: row.new_members || 0,
      source: row.source,
    }))

    // Calculate monthly aggregates for long date ranges
    const monthlyMap = new Map<string, {
      month: string
      totalMembers: number
      newMembers: number
      count: number
    }>()

    daily.forEach((row) => {
      const month = row.date.substring(0, 7) // YYYY-MM
      const existing = monthlyMap.get(month)
      if (existing) {
        existing.totalMembers = row.totalMembers // Use last value of month
        existing.newMembers += row.newMembers
        existing.count++
      } else {
        monthlyMap.set(month, {
          month,
          totalMembers: row.totalMembers,
          newMembers: row.newMembers,
          count: 1,
        })
      }
    })

    const monthly = Array.from(monthlyMap.values()).map((m) => ({
      date: `${m.month}-01`, // First day of month for chart compatibility
      month: m.month,
      totalMembers: m.totalMembers,
      newMembers: m.newMembers,
    }))

    // Calculate totals
    const latestCount = daily.length > 0 ? daily[daily.length - 1].totalMembers : 0
    const earliestCount = daily.length > 0 ? daily[0].totalMembers : 0
    const totalNewMembers = daily.reduce((sum, d) => sum + d.newMembers, 0)
    const avgDailyMembers = daily.length > 0
      ? Math.round(daily.reduce((sum, d) => sum + d.totalMembers, 0) / daily.length)
      : 0

    return NextResponse.json({
      daily,
      monthly,
      totals: {
        currentMembers: latestCount,
        startMembers: earliestCount,
        newMembersInPeriod: totalNewMembers,
        avgDailyMembers,
        growth: earliestCount > 0 ? ((latestCount - earliestCount) / earliestCount * 100).toFixed(1) : 0,
      },
      period: {
        range,
        startDate,
        endDate,
      },
    })
  } catch (error) {
    console.error('[Members Analytics API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
