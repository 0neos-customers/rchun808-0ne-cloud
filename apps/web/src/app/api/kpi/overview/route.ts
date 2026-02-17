import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@0ne/db/server'
import {
  FUNNEL_STAGE_ORDER,
  STAGE_LABELS,
  STAGE_COLORS,
  type FunnelStage,
} from '@/features/kpi/lib/config'
import { getLatestMetrics } from '@/features/skool/lib/metrics-sync'
import { getLatestRevenueSnapshot } from '@/features/skool/lib/revenue-sync'
import { sanitizeForPostgrestFilter } from '@/lib/postgrest-utils'

export const dynamic = 'force-dynamic'

interface DateRangeResult {
  startDate: string
  endDate: string
}

function getDateRangeFromPeriod(period: string): DateRangeResult {
  const now = new Date()
  const endDate = now.toISOString().split('T')[0]
  let startDate: Date

  switch (period) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      break
    case 'mtd': {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    }
    case 'lastMonth': {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      return {
        startDate: lastMonth.toISOString().split('T')[0],
        endDate: new Date(thisMonth.getTime() - 1).toISOString().split('T')[0],
      }
    }
    case 'ytd':
      startDate = new Date(now.getFullYear(), 0, 1)
      break
    case 'lifetime':
      // Use a very early date to capture all data
      startDate = new Date('2020-01-01')
      break
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate,
  }
}

/**
 * Parse date range from request params
 * Priority: explicit startDate/endDate > period preset
 */
function parseDateRange(searchParams: URLSearchParams): DateRangeResult {
  const startDateParam = searchParams.get('startDate')
  const endDateParam = searchParams.get('endDate')

  // If explicit dates provided, use them
  if (startDateParam && endDateParam) {
    return { startDate: startDateParam, endDate: endDateParam }
  }

  // Fall back to period preset
  const period = searchParams.get('period') || 'mtd'
  return getDateRangeFromPeriod(period)
}

function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'mtd'
    const source = searchParams.get('source') || null
    // Support multiple sources via comma-separated string
    const sourcesParam = searchParams.get('sources')
    const sources = sourcesParam ? sourcesParam.split(',').filter(Boolean) : []
    const campaign = searchParams.get('campaign') || null

    const { startDate, endDate } = parseDateRange(searchParams)
    const previousPeriodLength = new Date(endDate).getTime() - new Date(startDate).getTime()
    const previousStartDate = new Date(new Date(startDate).getTime() - previousPeriodLength)
      .toISOString()
      .split('T')[0]

    const supabase = createServerClient()

    // Get current period aggregates
    // When no campaign/source filter, get the aggregate row (null values)
    // When filter is applied, get the specific row
    const currentQuery = supabase
      .from('daily_aggregates')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)

    // Apply filters or get null rows
    if (campaign) {
      currentQuery.eq('campaign_id', campaign)
    } else {
      currentQuery.is('campaign_id', null)
    }
    // Handle source filtering: single source, multiple sources, or all (null)
    if (source) {
      currentQuery.eq('source', source)
    } else if (sources.length > 0) {
      currentQuery.in('source', sources)
    } else {
      currentQuery.is('source', null)
    }

    const { data: currentAggregates } = await currentQuery

    // Get previous period aggregates
    const previousQuery = supabase
      .from('daily_aggregates')
      .select('*')
      .gte('date', previousStartDate)
      .lt('date', startDate)

    if (campaign) {
      previousQuery.eq('campaign_id', campaign)
    } else {
      previousQuery.is('campaign_id', null)
    }
    if (source) {
      previousQuery.eq('source', source)
    } else if (sources.length > 0) {
      previousQuery.in('source', sources)
    } else {
      previousQuery.is('source', null)
    }

    const { data: previousAggregates } = await previousQuery

    // Get contact counts by stage using aggregate query (no row limit issues)
    // Use RPC call for GROUP BY which returns aggregated counts directly
    const { data: stageCounts, error: stageError } = await supabase
      .rpc('get_stage_counts')

    // Fallback: if RPC doesn't exist, use raw SQL via REST
    let stageCountsMap: Record<string, number> = {}

    if (stageError || !stageCounts) {
      // Fallback: fetch all contacts (with pagination if needed)
      const startTime = Date.now()
      console.log('RPC not available, falling back to direct query')

      // Get total count first
      const { count: totalCount } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })

      console.log('Total contacts in DB:', totalCount, `(${Date.now() - startTime}ms)`)

      // Fetch in batches - run in parallel for speed
      const batchSize = 1000
      const batches = Math.ceil((totalCount || 0) / batchSize)

      const batchPromises = Array.from({ length: batches }, (_, i) =>
        supabase
          .from('contacts')
          .select('stages') // Use stages array, not current_stage
          .range(i * batchSize, (i + 1) * batchSize - 1)
      )

      const batchResults = await Promise.all(batchPromises)
      const allContacts = batchResults.flatMap((result) => result.data || [])

      console.log('Fetched contacts:', allContacts.length, `(${Date.now() - startTime}ms total)`)

      // Count by stage - contacts can be in MULTIPLE stages (tags accumulate)
      allContacts.forEach((contact) => {
        const stages = contact.stages as string[] || []
        // Count this contact for EACH stage they have a tag for
        stages.forEach((stage) => {
          if (stage) {
            stageCountsMap[stage] = (stageCountsMap[stage] || 0) + 1
          }
        })
      })
    } else {
      // RPC returned counts directly
      stageCounts.forEach((row: { current_stage: string; count: number }) => {
        stageCountsMap[row.current_stage] = row.count
      })
    }

    // Fetch Skool metrics (source of truth for members) and revenue snapshot
    const [skoolMetrics, revenueSnapshot] = await Promise.all([
      getLatestMetrics(),
      getLatestRevenueSnapshot(),
    ])
    console.log('[KPI Overview] Skool metrics:', skoolMetrics)
    console.log('[KPI Overview] Revenue snapshot:', revenueSnapshot)

    // Fetch date-filtered about page visits from skool_about_page_daily
    const { data: aboutPageDaily } = await supabase
      .from('skool_about_page_daily')
      .select('visitors, conversion_rate')
      .gte('date', startDate)
      .lte('date', endDate)

    const filteredAboutVisits = aboutPageDaily?.reduce((sum, row) => sum + (row.visitors || 0), 0) || 0
    const filteredConversionRate = aboutPageDaily && aboutPageDaily.length > 0
      ? aboutPageDaily.reduce((sum, row) => sum + (row.conversion_rate || 0), 0) / aboutPageDaily.length
      : skoolMetrics?.conversion_rate || 0

    console.log(`[KPI Overview] About visits for ${startDate} to ${endDate}: ${filteredAboutVisits} (${aboutPageDaily?.length || 0} days)`)

    // Fetch date-filtered member counts for current and previous periods
    // When sources are provided, query skool_members directly
    // Otherwise use pre-aggregated skool_members_daily
    let filteredMemberCount = 0
    let newMembersInPeriod = 0
    let previousPeriodMemberCount = 0
    let previousPeriodNewMembers = 0

    if (sources.length > 0) {
      // Source filtering - query skool_members directly
      const includesUnknown = sources.includes('unknown') || sources.includes('null')
      const regularSources = sources.filter(s => s !== 'unknown' && s !== 'null')
      const safeRegularSources = regularSources.map(sanitizeForPostgrestFilter)

      // Get new members in period with source filter
      let newMembersQuery = supabase
        .from('skool_members')
        .select('id', { count: 'exact', head: true })
        .eq('group_slug', 'fruitful')
        .gte('member_since', `${startDate}T00:00:00Z`)
        .lte('member_since', `${endDate}T23:59:59Z`)

      // Apply source filter
      if (includesUnknown && regularSources.length > 0) {
        newMembersQuery = newMembersQuery.or(`attribution_source.in.(${safeRegularSources.join(',')}),attribution_source.is.null`)
      } else if (includesUnknown) {
        newMembersQuery = newMembersQuery.is('attribution_source', null)
      } else {
        newMembersQuery = newMembersQuery.in('attribution_source', safeRegularSources)
      }

      const { count: newCount } = await newMembersQuery
      newMembersInPeriod = newCount || 0

      // Get total members with source filter (all time up to endDate)
      let totalMembersQuery = supabase
        .from('skool_members')
        .select('id', { count: 'exact', head: true })
        .eq('group_slug', 'fruitful')
        .lte('member_since', `${endDate}T23:59:59Z`)

      if (includesUnknown && regularSources.length > 0) {
        totalMembersQuery = totalMembersQuery.or(`attribution_source.in.(${safeRegularSources.join(',')}),attribution_source.is.null`)
      } else if (includesUnknown) {
        totalMembersQuery = totalMembersQuery.is('attribution_source', null)
      } else {
        totalMembersQuery = totalMembersQuery.in('attribution_source', safeRegularSources)
      }

      const { count: totalCount } = await totalMembersQuery
      filteredMemberCount = totalCount || 0

      console.log(`[KPI Overview] Members for ${startDate} to ${endDate} (sources: ${sources.join(',')}): ${filteredMemberCount} total, ${newMembersInPeriod} new`)

      // Get previous period data for comparison
      let prevNewMembersQuery = supabase
        .from('skool_members')
        .select('id', { count: 'exact', head: true })
        .eq('group_slug', 'fruitful')
        .gte('member_since', `${previousStartDate}T00:00:00Z`)
        .lt('member_since', `${startDate}T00:00:00Z`)

      if (includesUnknown && regularSources.length > 0) {
        prevNewMembersQuery = prevNewMembersQuery.or(`attribution_source.in.(${safeRegularSources.join(',')}),attribution_source.is.null`)
      } else if (includesUnknown) {
        prevNewMembersQuery = prevNewMembersQuery.is('attribution_source', null)
      } else {
        prevNewMembersQuery = prevNewMembersQuery.in('attribution_source', safeRegularSources)
      }

      const { count: prevNewCount } = await prevNewMembersQuery
      previousPeriodNewMembers = prevNewCount || 0

      // Get member count at start of current period (= end of previous period)
      let prevTotalQuery = supabase
        .from('skool_members')
        .select('id', { count: 'exact', head: true })
        .eq('group_slug', 'fruitful')
        .lt('member_since', `${startDate}T00:00:00Z`)

      if (includesUnknown && regularSources.length > 0) {
        prevTotalQuery = prevTotalQuery.or(`attribution_source.in.(${safeRegularSources.join(',')}),attribution_source.is.null`)
      } else if (includesUnknown) {
        prevTotalQuery = prevTotalQuery.is('attribution_source', null)
      } else {
        prevTotalQuery = prevTotalQuery.in('attribution_source', safeRegularSources)
      }

      const { count: prevTotalCount } = await prevTotalQuery
      previousPeriodMemberCount = prevTotalCount || 0
    } else {
      // No source filter - use pre-aggregated skool_members_daily
      const { data: membersDailyData } = await supabase
        .from('skool_members_daily')
        .select('date, total_members, new_members')
        .eq('group_slug', 'fruitful')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })

      // Get member count at end of period (or latest available)
      filteredMemberCount = membersDailyData && membersDailyData.length > 0
        ? membersDailyData[membersDailyData.length - 1].total_members
        : skoolMetrics?.members_total || 0

      // Calculate new members in period
      newMembersInPeriod = membersDailyData?.reduce((sum, row) => sum + (row.new_members || 0), 0) || 0

      console.log(`[KPI Overview] Members for ${startDate} to ${endDate}: ${filteredMemberCount} (${newMembersInPeriod} new)`)

      // Get previous period member data from skool_members_daily
      const { data: prevMembersDailyData } = await supabase
        .from('skool_members_daily')
        .select('date, total_members, new_members')
        .eq('group_slug', 'fruitful')
        .gte('date', previousStartDate)
        .lt('date', startDate)
        .order('date', { ascending: true })

      // Previous period member count at end of period
      previousPeriodMemberCount = prevMembersDailyData && prevMembersDailyData.length > 0
        ? prevMembersDailyData[prevMembersDailyData.length - 1].total_members
        : 0

      // New members in previous period
      previousPeriodNewMembers = prevMembersDailyData?.reduce((sum, row) => sum + (row.new_members || 0), 0) || 0

      console.log(`[KPI Overview] Previous period (${previousStartDate} to ${startDate}): ${previousPeriodMemberCount} total, ${previousPeriodNewMembers} new`)
    }

    // Calculate conversion rate from about visits to new members for this period
    const calculatedConversionRate = filteredAboutVisits > 0
      ? (newMembersInPeriod / filteredAboutVisits) * 100
      : 0
    console.log(`[KPI Overview] Calculated conversion rate: ${calculatedConversionRate.toFixed(1)}% (${newMembersInPeriod} new / ${filteredAboutVisits} visits)`)

    // Calculate metrics
    const sumField = (data: typeof currentAggregates, field: string) =>
      data?.reduce((sum, row) => sum + (Number(row[field]) || 0), 0) || 0

    const currentRevenue = sumField(currentAggregates, 'total_revenue')
    const previousRevenue = sumField(previousAggregates, 'total_revenue')
    const currentLeads = sumField(currentAggregates, 'new_leads')
    const previousLeads = sumField(previousAggregates, 'new_leads')
    const currentClients = sumField(currentAggregates, 'new_vip') + sumField(currentAggregates, 'new_premium')
    const previousClients = sumField(previousAggregates, 'new_vip') + sumField(previousAggregates, 'new_premium')
    const currentFunded = sumField(currentAggregates, 'total_funded_amount')
    const previousFunded = sumField(previousAggregates, 'total_funded_amount')
    const currentAdSpend = sumField(currentAggregates, 'ad_spend')
    const previousAdSpend = sumField(previousAggregates, 'ad_spend')

    // Build sparkline data (last 7 data points)
    const sparklineData = currentAggregates
      ?.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-7) || []

    // Build funnel stages - use the counts from our aggregate query
    const finalStageCounts: Record<FunnelStage, number> = Object.fromEntries(
      FUNNEL_STAGE_ORDER.map((stage) => [stage, stageCountsMap[stage] || 0])
    ) as Record<FunnelStage, number>

    const totalContacts = Object.values(finalStageCounts).reduce((a, b) => a + b, 0)
    console.log('Stage counts:', finalStageCounts, 'Total:', totalContacts)
    const funnelStages = [...FUNNEL_STAGE_ORDER].reverse().map((stageId, index, arr) => {
      const count = finalStageCounts[stageId]
      const previousStageCount = index > 0 ? finalStageCounts[arr[index - 1]] : null
      const conversionRate = previousStageCount
        ? ((count / previousStageCount) * 100)
        : null

      return {
        id: stageId,
        name: STAGE_LABELS[stageId],
        count,
        color: STAGE_COLORS[stageId],
        conversionRate: conversionRate ? Number(conversionRate.toFixed(1)) : null,
      }
    })

    // Build weekly trends
    const weeklyTrends = currentAggregates
      ?.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((row) => ({
        date: row.date,
        leads: row.new_leads || 0,
        handRaisers: row.new_hand_raisers || 0,
        qualified: row.new_qualified || 0,
        clients: (row.new_vip || 0) + (row.new_premium || 0),
        revenue: row.total_revenue || 0,
      })) || []

    const response = {
      metrics: {
        revenue: {
          current: currentRevenue,
          previous: previousRevenue,
          change: Number(calculateChange(currentRevenue, previousRevenue).toFixed(1)),
          trend: currentRevenue >= previousRevenue ? 'up' : 'down',
          sparkline: sparklineData.map((d) => d.total_revenue || 0),
        },
        leads: {
          current: currentLeads,
          previous: previousLeads,
          change: Number(calculateChange(currentLeads, previousLeads).toFixed(1)),
          trend: currentLeads >= previousLeads ? 'up' : 'down',
          sparkline: sparklineData.map((d) => d.new_leads || 0),
        },
        clients: {
          current: currentClients,
          previous: previousClients,
          change: Number(calculateChange(currentClients, previousClients).toFixed(1)),
          trend: currentClients >= previousClients ? 'up' : 'down',
          sparkline: sparklineData.map((d) => (d.new_vip || 0) + (d.new_premium || 0)),
        },
        fundedAmount: {
          current: currentFunded,
          previous: previousFunded,
          change: Number(calculateChange(currentFunded, previousFunded).toFixed(1)),
          trend: currentFunded >= previousFunded ? 'up' : 'down',
          sparkline: sparklineData.map((d) => d.total_funded_amount || 0),
        },
        costPerLead: {
          current: currentLeads > 0 ? Number((currentAdSpend / currentLeads).toFixed(2)) : 0,
          previous: previousLeads > 0 ? Number((previousAdSpend / previousLeads).toFixed(2)) : 0,
          change: currentLeads > 0 && previousLeads > 0
            ? Number(calculateChange(currentAdSpend / currentLeads, previousAdSpend / previousLeads).toFixed(1))
            : 0,
          trend: currentLeads > 0 && previousLeads > 0
            ? (currentAdSpend / currentLeads <= previousAdSpend / previousLeads ? 'up' : 'down')
            : 'neutral',
          sparkline: sparklineData.map((d) =>
            d.new_leads > 0 ? Number(((d.ad_spend || 0) / d.new_leads).toFixed(2)) : 0
          ),
        },
        costPerClient: {
          current: currentClients > 0 ? Number((currentAdSpend / currentClients).toFixed(2)) : 0,
          previous: previousClients > 0 ? Number((previousAdSpend / previousClients).toFixed(2)) : 0,
          change: currentClients > 0 && previousClients > 0
            ? Number(calculateChange(currentAdSpend / currentClients, previousAdSpend / previousClients).toFixed(1))
            : 0,
          trend: currentClients > 0 && previousClients > 0
            ? (currentAdSpend / currentClients <= previousAdSpend / previousClients ? 'up' : 'down')
            : 'neutral',
          sparkline: sparklineData.map((d) => {
            const clients = (d.new_vip || 0) + (d.new_premium || 0)
            return clients > 0 ? Number(((d.ad_spend || 0) / clients).toFixed(2)) : 0
          }),
        },
      },
      funnel: {
        stages: funnelStages,
        overallConversion: finalStageCounts.member > 0
          ? Number((((finalStageCounts.vip + finalStageCounts.premium) / finalStageCounts.member) * 100).toFixed(2))
          : 0,
      },
      trends: {
        weekly: weeklyTrends,
      },
      period: {
        startDate,
        endDate,
        label: period,
      },
      // Skool metrics - source of truth for community stats
      // For funnel flow: use newMembersInPeriod (not cumulative total)
      // conversionRate calculated from aboutVisits -> newMembers for this period
      skool: skoolMetrics
        ? {
            // Total members at end of period (for display in cards)
            totalMembers: filteredMemberCount || skoolMetrics.members_total || 0,
            // Previous period member count for comparison
            previousTotalMembers: previousPeriodMemberCount,
            // Member change percentage (total members growth)
            totalMembersChange: Number(calculateChange(
              filteredMemberCount || skoolMetrics.members_total || 0,
              previousPeriodMemberCount
            ).toFixed(1)),
            // New members during the period (for funnel flow)
            members: newMembersInPeriod,
            newMembersInPeriod,
            // Previous period new members for comparison
            previousNewMembers: previousPeriodNewMembers,
            // New members change percentage
            newMembersChange: Number(calculateChange(newMembersInPeriod, previousPeriodNewMembers).toFixed(1)),
            activeMembers: skoolMetrics.members_active || 0,
            aboutPageVisits: filteredAboutVisits || skoolMetrics.about_page_visits || 0,
            // Use calculated conversion rate (new members / about visits)
            conversionRate: Number(calculatedConversionRate.toFixed(1)),
            communityActivity: skoolMetrics.community_activity || 0,
            categoryRank: skoolMetrics.category_rank || null,
            category: skoolMetrics.category || null,
            snapshotDate: skoolMetrics.snapshot_date,
            // MRR data from analytics-overview API
            mrr: revenueSnapshot?.mrr || 0,
            mrrRetention: revenueSnapshot?.retention_rate || 0,
            paidMembers: revenueSnapshot?.paying_members || 0,
          }
        : null,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('KPI Overview error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch KPI data', details: String(error) },
      { status: 500 }
    )
  }
}
