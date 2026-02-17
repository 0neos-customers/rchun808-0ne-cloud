import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@0ne/db/server'
import { DEFAULT_GROUP } from '@/features/skool/lib/config'

export const dynamic = 'force-dynamic'

// Response types for our API
export interface DailyDataPoint {
  date: string
  visitors: number
  conversionRate: number
}

export interface MonthlyDataPoint {
  month: string
  visitors: number
  conversionRate: number
}

export interface AboutAnalyticsResponse {
  daily: DailyDataPoint[]
  monthly: MonthlyDataPoint[]
  totals: {
    totalVisitors: number
    totalNewMembers: number
    avgConversionRate: number
    avgDailyVisitors: number
  }
  period: {
    range: '30d' | '1y'
    startDate: string
    endDate: string
  }
  source: 'db'
  /**
   * About page visits are aggregate data from Skool's analytics.
   * Source filtering is NOT available for this data because attribution
   * happens AFTER a visitor becomes a member (visitors are tracked before joining).
   * The attribution_source is recorded on the member, not the visitor.
   */
  sourceFilteringNote?: string
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

/**
 * Get daily data from our database
 * Joins about page visits with new members to calculate conversion rate
 */
async function getFromDatabase(
  startDate: string,
  endDate: string
): Promise<DailyDataPoint[]> {
  const supabase = createServerClient()

  // Get about page visits
  const { data: aboutData, error: aboutError } = await supabase
    .from('skool_about_page_daily')
    .select('date, visitors, conversion_rate')
    .eq('group_slug', DEFAULT_GROUP.slug)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })

  if (aboutError) {
    console.error('[About Analytics] DB read error:', aboutError)
    return []
  }

  // Get new members data to calculate actual conversion rate
  const { data: membersData } = await supabase
    .from('skool_members_daily')
    .select('date, new_members')
    .eq('group_slug', DEFAULT_GROUP.slug)
    .gte('date', startDate)
    .lte('date', endDate)

  // Create a map of date -> new_members
  const newMembersMap = new Map<string, number>()
  membersData?.forEach((row) => {
    newMembersMap.set(row.date, row.new_members || 0)
  })

  return (aboutData || []).map((row) => {
    const visitors = row.visitors || 0
    const newMembers = newMembersMap.get(row.date) || 0
    // Calculate conversion rate from visitors to new members
    const conversionRate = visitors > 0 ? (newMembers / visitors) * 100 : 0

    return {
      date: row.date,
      visitors,
      conversionRate: Math.round(conversionRate * 10) / 10,
    }
  })
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Aggregate daily data into monthly data
 */
function aggregateMonthly(daily: DailyDataPoint[]): MonthlyDataPoint[] {
  const monthlyMap = new Map<string, { visitors: number; rates: number[]; count: number }>()

  daily.forEach((day) => {
    const month = day.date.substring(0, 7) // YYYY-MM

    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, { visitors: 0, rates: [], count: 0 })
    }

    const monthData = monthlyMap.get(month)!
    monthData.visitors += day.visitors
    if (day.conversionRate > 0) {
      monthData.rates.push(day.conversionRate)
    }
    monthData.count++
  })

  const monthly: MonthlyDataPoint[] = []
  monthlyMap.forEach((data, month) => {
    const avgRate = data.rates.length > 0
      ? data.rates.reduce((a, b) => a + b, 0) / data.rates.length
      : 0

    monthly.push({
      month,
      visitors: data.visitors,
      conversionRate: Math.round(avgRate * 10) / 10,
    })
  })

  return monthly.sort((a, b) => a.month.localeCompare(b.month))
}

/**
 * Get date range for query
 */
function getDateRange(range: '30d' | '1y'): { startDate: string; endDate: string } {
  const now = new Date()
  const endDate = now.toISOString().split('T')[0]

  let startDate: Date
  if (range === '1y') {
    startDate = new Date(now)
    startDate.setFullYear(startDate.getFullYear() - 1)
  } else {
    startDate = new Date(now)
    startDate.setDate(startDate.getDate() - 30)
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate,
  }
}

// =============================================================================
// EMPTY RESPONSE HELPER
// =============================================================================

function emptyResponse(
  range: '30d' | '1y',
  startDate: string,
  endDate: string,
  sourceFilteringNote?: string
): AboutAnalyticsResponse {
  return {
    daily: [],
    monthly: [],
    totals: {
      totalVisitors: 0,
      totalNewMembers: 0,
      avgConversionRate: 0,
      avgDailyVisitors: 0,
    },
    period: { range, startDate, endDate },
    source: 'db',
    sourceFilteringNote,
  }
}

// =============================================================================
// API HANDLER
// =============================================================================

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const range = (searchParams.get('range') || '30d') as '30d' | '1y'

    // Support explicit date range filtering (from page-level filter)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    // Sources parameter - note: about page data is NOT filterable by source
    // This is aggregate visitor data from before they became members
    const sourcesParam = searchParams.get('sources')
    const sources = sourcesParam ? sourcesParam.split(',').filter(Boolean) : []
    const sourceFilteringNote = sources.length > 0
      ? 'About page visits cannot be filtered by attribution source. Attribution is recorded when visitors become members, but visit tracking happens before membership.'
      : undefined

    console.log(`[About Analytics] Request: range=${range}, startDate=${startDateParam}, endDate=${endDateParam}${sources.length > 0 ? ` (sources ignored: ${sources.join(',')})` : ''}`)

    // Use explicit dates if provided, otherwise use range preset
    const { startDate, endDate } = (startDateParam && endDateParam)
      ? { startDate: startDateParam, endDate: endDateParam }
      : getDateRange(range)

    console.log(`[About Analytics] Using date range: ${startDate} to ${endDate}`)

    // DB-only: fetch data from database (populated by the Chrome extension)
    const daily = await getFromDatabase(startDate, endDate)
    console.log(`[About Analytics] Got ${daily.length} rows from DB`)

    if (daily.length === 0) {
      return NextResponse.json(emptyResponse(range, startDate, endDate, sourceFilteringNote))
    }

    const monthly = aggregateMonthly(daily)

    const totalVisitors = daily.reduce((sum, d) => sum + d.visitors, 0)
    const avgDailyVisitors = daily.length > 0 ? totalVisitors / daily.length : 0

    // Get total new members for the period to calculate overall conversion rate
    const supabase = createServerClient()
    const { data: membersTotal } = await supabase
      .from('skool_members_daily')
      .select('new_members')
      .eq('group_slug', DEFAULT_GROUP.slug)
      .gte('date', startDate)
      .lte('date', endDate)

    const totalNewMembers = membersTotal?.reduce((sum, row) => sum + (row.new_members || 0), 0) || 0
    // Calculate overall conversion rate: total new members / total visitors
    const avgConversionRate = totalVisitors > 0
      ? (totalNewMembers / totalVisitors) * 100
      : 0

    console.log(`[About Analytics] Totals: ${totalVisitors} visitors, ${totalNewMembers} new members, ${avgConversionRate.toFixed(1)}% conversion`)

    const response: AboutAnalyticsResponse = {
      daily,
      monthly,
      totals: {
        totalVisitors,
        totalNewMembers,
        avgConversionRate: Math.round(avgConversionRate * 10) / 10,
        avgDailyVisitors: Math.round(avgDailyVisitors),
      },
      period: {
        range,
        startDate: daily[0]?.date || startDate,
        endDate: daily[daily.length - 1]?.date || endDate,
      },
      source: 'db',
      sourceFilteringNote,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[About Analytics] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch about page analytics', details: String(error) },
      { status: 500 }
    )
  }
}
