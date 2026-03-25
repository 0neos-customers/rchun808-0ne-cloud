import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db, eq, gte, lte, asc, desc, and } from '@0ne/db/server'
import { dailyAggregates as dailyAggregatesTable, dimensionSources, dimensionStages as dimensionStagesTable, dimensionCampaigns, dimensionExpenseCategories, weeklyTrends as weeklyTrendsTable, dailyExpensesByCategory, contacts as contactsTable } from '@0ne/db/server'
import {
  FUNNEL_STAGE_ORDER,
  STAGE_LABELS,
  STAGE_COLORS,
  type FunnelStage,
} from '@/features/kpi/lib/config'
import { getLatestMetrics } from '@/features/skool/lib/metrics-sync'
import { getLatestRevenueSnapshot } from '@/features/skool/lib/revenue-sync'

export const dynamic = 'force-dynamic'

/**
 * KPI Dataset Endpoint
 *
 * Returns all pre-aggregated data needed for instant client-side filtering.
 * Load once per session, then filter in-memory on the client.
 *
 * Response shape:
 * {
 *   aggregates: { daily, bySource, byCampaign, bySourceAndCampaign }
 *   dimensions: { sources, campaigns, stages, expenseCategories }
 *   weeklyTrends: [...]
 *   skool: { latest metrics }
 *   expenses: { byCategory, byDate }
 *   meta: { generatedAt, periodStart, periodEnd }
 * }
 */

interface DailyAggregate {
  id: string
  date: string
  campaign_id: string | null
  source: string | null
  new_members: number
  new_hand_raisers: number
  new_qualified_premium: number
  new_qualified_vip: number
  new_offer_made: number
  new_offer_seen: number
  new_vip: number
  new_premium: number
  total_revenue: number
  vip_revenue: number
  premium_revenue: number
  success_fee_revenue: number
  ad_spend: number
  expenses: number
  total_funded_amount: number
  funded_count: number
}

interface DimensionSource {
  source: string
  display_name: string
  contact_count: number
  last_seen_date: string | null
  is_active: boolean
}

interface DimensionStage {
  stage: string
  display_name: string
  color: string
  sort_order: number
  contact_count: number
}

interface DimensionCampaign {
  campaign_id: string
  campaign_name: string
  contact_count: number
  is_active: boolean
}

interface DimensionExpenseCategory {
  category: string
  display_name: string | null
  color: string | null
  expense_count: number
  total_amount: number
  is_system: boolean
}

interface WeeklyTrend {
  week_start: string
  week_number: string
  source: string | null
  campaign_id: string | null
  new_leads: number
  new_hand_raisers: number
  new_qualified: number
  new_clients: number
  total_revenue: number
  ad_spend: number
  cost_per_lead: number | null
  cost_per_client: number | null
}

interface DailyExpenseByCategory {
  date: string
  category: string
  amount: number
  is_system: boolean
  expense_count: number
}

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const daysBack = parseInt(searchParams.get('days') || '365', 10) // Default to 1 year of data

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000)
    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    // Parallel fetch all data
    const [
      aggregatesData,
      dimensionSourcesData,
      dimensionStagesData,
      dimensionCampaignsData,
      dimensionExpenseCategoriesData,
      weeklyTrendsData,
      dailyExpensesData,
      skoolMetrics,
      revenueSnapshot,
      contactStageCountsData,
    ] = await Promise.all([
      // 1. Daily aggregates for the period
      db.select().from(dailyAggregatesTable)
        .where(and(gte(dailyAggregatesTable.date, startDateStr), lte(dailyAggregatesTable.date, endDateStr)))
        .orderBy(asc(dailyAggregatesTable.date)),

      // 2. Dimension tables
      db.select({
        source: dimensionSources.source,
        displayName: dimensionSources.displayName,
        contactCount: dimensionSources.contactCount,
        lastSeenDate: dimensionSources.lastSeenDate,
        isActive: dimensionSources.isActive,
      }).from(dimensionSources)
        .where(eq(dimensionSources.isActive, true))
        .orderBy(desc(dimensionSources.contactCount)),

      db.select({
        stage: dimensionStagesTable.stage,
        displayName: dimensionStagesTable.displayName,
        color: dimensionStagesTable.color,
        sortOrder: dimensionStagesTable.sortOrder,
        contactCount: dimensionStagesTable.contactCount,
      }).from(dimensionStagesTable)
        .orderBy(asc(dimensionStagesTable.sortOrder)),

      db.select({
        campaignId: dimensionCampaigns.campaignId,
        campaignName: dimensionCampaigns.campaignName,
        contactCount: dimensionCampaigns.contactCount,
        isActive: dimensionCampaigns.isActive,
      }).from(dimensionCampaigns)
        .where(eq(dimensionCampaigns.isActive, true))
        .orderBy(desc(dimensionCampaigns.contactCount)),

      db.select({
        category: dimensionExpenseCategories.category,
        displayName: dimensionExpenseCategories.displayName,
        color: dimensionExpenseCategories.color,
        expenseCount: dimensionExpenseCategories.expenseCount,
        totalAmount: dimensionExpenseCategories.totalAmount,
        isSystem: dimensionExpenseCategories.isSystem,
      }).from(dimensionExpenseCategories)
        .orderBy(desc(dimensionExpenseCategories.totalAmount)),

      // 3. Weekly trends
      db.select().from(weeklyTrendsTable)
        .where(and(gte(weeklyTrendsTable.weekStart, startDateStr), lte(weeklyTrendsTable.weekStart, endDateStr)))
        .orderBy(asc(weeklyTrendsTable.weekStart)),

      // 4. Daily expenses by category
      db.select({
        date: dailyExpensesByCategory.date,
        category: dailyExpensesByCategory.category,
        amount: dailyExpensesByCategory.amount,
        isSystem: dailyExpensesByCategory.isSystem,
        expenseCount: dailyExpensesByCategory.expenseCount,
      }).from(dailyExpensesByCategory)
        .where(and(gte(dailyExpensesByCategory.date, startDateStr), lte(dailyExpensesByCategory.date, endDateStr)))
        .orderBy(asc(dailyExpensesByCategory.date)),

      // 5. Skool metrics (latest snapshot)
      getLatestMetrics(),

      // 6. Revenue snapshot
      getLatestRevenueSnapshot(),

      // 7. Contact stage counts (for funnel - uses stages array)
      db.select({ stages: contactsTable.stages }).from(contactsTable),
    ])

    const aggregates = aggregatesData as unknown as DailyAggregate[]

    // Calculate stage counts from contacts' stages arrays (tags accumulate)
    const stageCountsMap: Record<string, number> = {}
    const contactsData = contactStageCountsData
    contactsData.forEach((contact) => {
      const stages = (contact.stages as string[]) || []
      stages.forEach((stage) => {
        if (stage) {
          stageCountsMap[stage] = (stageCountsMap[stage] || 0) + 1
        }
      })
    })

    // Build dimension stages with live counts
    const dimensionStagesWithCounts = dimensionStagesData.map((stage) => ({
      ...stage,
      contact_count: stageCountsMap[stage.stage!] || stage.contactCount || 0,
    }))

    // Organize aggregates by dimension for easy client-side slicing
    const dailyAggregates: DailyAggregate[] = []
    const bySourceAggregates: Record<string, DailyAggregate[]> = {}
    const byCampaignAggregates: Record<string, DailyAggregate[]> = {}

    for (const agg of aggregates) {
      // Overall aggregates (no campaign, no source filter)
      if (!agg.campaign_id && !agg.source) {
        dailyAggregates.push(agg)
      }

      // By source aggregates
      if (agg.source && !agg.campaign_id) {
        if (!bySourceAggregates[agg.source]) {
          bySourceAggregates[agg.source] = []
        }
        bySourceAggregates[agg.source].push(agg)
      }

      // By campaign aggregates
      if (agg.campaign_id && !agg.source) {
        if (!byCampaignAggregates[agg.campaign_id]) {
          byCampaignAggregates[agg.campaign_id] = []
        }
        byCampaignAggregates[agg.campaign_id].push(agg)
      }
    }

    // Build funnel stages with colors and labels for immediate UI use
    const funnelStages = FUNNEL_STAGE_ORDER.map((stageId) => ({
      id: stageId,
      name: STAGE_LABELS[stageId],
      color: STAGE_COLORS[stageId],
      count: stageCountsMap[stageId] || 0,
    }))

    // Organize weekly trends
    const weeklyTrendsBySource: Record<string, WeeklyTrend[]> = {}
    const overallWeeklyTrends: WeeklyTrend[] = []

    for (const trend of weeklyTrendsData as unknown as WeeklyTrend[]) {
      if (!trend.source && !trend.campaign_id) {
        overallWeeklyTrends.push(trend)
      } else if (trend.source && !trend.campaign_id) {
        if (!weeklyTrendsBySource[trend.source]) {
          weeklyTrendsBySource[trend.source] = []
        }
        weeklyTrendsBySource[trend.source].push(trend)
      }
    }

    // Organize expenses
    const expensesByCategory: Record<string, DailyExpenseByCategory[]> = {}
    const dailyExpensesTotal: { date: string; amount: number }[] = []
    const dailyExpensesMap = new Map<string, number>()

    for (const expense of dailyExpensesData as unknown as DailyExpenseByCategory[]) {
      if (!expensesByCategory[expense.category]) {
        expensesByCategory[expense.category] = []
      }
      expensesByCategory[expense.category].push(expense)

      // Sum by date
      const current = dailyExpensesMap.get(expense.date) || 0
      dailyExpensesMap.set(expense.date, current + expense.amount)
    }

    // Convert to sorted array
    for (const [date, amount] of dailyExpensesMap) {
      dailyExpensesTotal.push({ date, amount })
    }
    dailyExpensesTotal.sort((a, b) => a.date.localeCompare(b.date))

    const response = {
      aggregates: {
        // Daily aggregates with no filters (overall)
        daily: dailyAggregates,
        // Aggregates pre-grouped by source
        bySource: bySourceAggregates,
        // Aggregates pre-grouped by campaign
        byCampaign: byCampaignAggregates,
        // All aggregates for complex multi-filter scenarios
        all: aggregates,
      },
      dimensions: {
        sources: dimensionSourcesData as unknown as DimensionSource[],
        stages: dimensionStagesWithCounts as unknown as DimensionStage[],
        campaigns: dimensionCampaignsData as unknown as DimensionCampaign[],
        expenseCategories: dimensionExpenseCategoriesData as unknown as DimensionExpenseCategory[],
      },
      funnel: {
        stages: funnelStages,
        totalContacts: Object.values(stageCountsMap).reduce((a, b) => a + b, 0),
        overallConversion: stageCountsMap['member'] > 0
          ? ((stageCountsMap['vip'] || 0) + (stageCountsMap['premium'] || 0)) / stageCountsMap['member'] * 100
          : 0,
      },
      weeklyTrends: {
        overall: overallWeeklyTrends,
        bySource: weeklyTrendsBySource,
      },
      expenses: {
        byCategory: expensesByCategory,
        dailyTotal: dailyExpensesTotal,
        categories: dimensionExpenseCategoriesData as unknown as DimensionExpenseCategory[],
      },
      skool: skoolMetrics
        ? {
            totalMembers: skoolMetrics.membersTotal || 0,
            activeMembers: skoolMetrics.membersActive || 0,
            communityActivity: skoolMetrics.communityActivity || 0,
            categoryRank: skoolMetrics.categoryRank || null,
            category: skoolMetrics.category || null,
            aboutPageVisits: skoolMetrics.aboutPageVisits || 0,
            conversionRate: skoolMetrics.conversionRate || 0,
            snapshotDate: skoolMetrics.snapshotDate,
            mrr: revenueSnapshot?.mrr || 0,
            mrrRetention: revenueSnapshot?.retentionRate || 0,
            paidMembers: revenueSnapshot?.payingMembers || 0,
          }
        : null,
      meta: {
        generatedAt: new Date().toISOString(),
        periodStart: startDateStr,
        periodEnd: endDateStr,
        daysIncluded: daysBack,
        aggregateCount: aggregates.length,
        contactCount: contactsData.length,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('KPI Dataset error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch KPI dataset', details: String(error) },
      { status: 500 }
    )
  }
}
