'use client'

import { AppShell } from '@/components/shell'
import { MetricCard } from '@/features/kpi/components/MetricCard'
import { FilterBar } from '@/features/kpi/components/FilterBar'
import { AboutPageAnalytics } from '@/features/kpi/components/AboutPageAnalytics'
import { DiscoveryRankAnalytics } from '@/features/kpi/components/DiscoveryRankAnalytics'
import { MembersAnalytics } from '@/features/kpi/components/MembersAnalytics'
import { CommunityActivityAnalytics } from '@/features/kpi/components/CommunityActivityAnalytics'
import { useSkoolMetrics, useCommunityActivityAnalytics, useMembersAnalytics, useAboutPageAnalytics } from '@/features/kpi/hooks/use-kpi-data'
import { usePersistedFilters } from '@/features/kpi/hooks/use-persisted-filters'
import { Activity, Award, Loader2, Target, Users, UserCheck } from 'lucide-react'

export default function SkoolKpiPage() {
  // Use persisted filters (shared across all KPI pages)
  const {
    period,
    dateRange,
    sources,
    isLoaded,
    hasActiveFilters,
    setPeriod,
    setDateRange,
    setSources,
    resetFilters,
  } = usePersistedFilters()

  const { data, isLoading, error } = useSkoolMetrics()

  // Get date-filtered data from various hooks (with source filtering where applicable)
  const { data: activityData } = useCommunityActivityAnalytics({ dateRange })
  const { data: membersData } = useMembersAnalytics({ dateRange, sources })
  const { data: aboutData } = useAboutPageAnalytics({ dateRange })

  if (!isLoaded || isLoading) {
    return (
      <AppShell title="KPI Dashboard" appId="kpi">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    )
  }

  if (error) {
    return (
      <AppShell title="KPI Dashboard" appId="kpi">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-destructive font-medium">Failed to load Skool metrics</p>
            <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
          </div>
        </div>
      </AppShell>
    )
  }

  // Use date-filtered data from hooks, fallback to static snapshot
  const totalMembers = membersData?.totals?.currentMembers ?? data?.membersTotal
  const newMembersInPeriod = membersData?.totals?.newMembersInPeriod ?? 0
  const aboutVisits = aboutData?.totals?.totalVisitors ?? data?.aboutPageVisits ?? 0
  // Calculate conversion rate from about visits to new members
  const conversionRate = aboutVisits > 0
    ? (newMembersInPeriod / aboutVisits) * 100
    : data?.conversionRate ?? 0
  const categoryRank = data?.categoryRank
  const category = data?.category || 'Uncategorized'
  const snapshotDate = data?.snapshotDate

  return (
    <AppShell title="KPI Dashboard" appId="kpi">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Skool KPIs</h1>
            <p className="text-sm text-muted-foreground">
              Community performance and engagement metrics
            </p>
            {snapshotDate && (
              <p className="text-xs text-muted-foreground mt-1">
                Latest snapshot: {snapshotDate}
              </p>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <FilterBar
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          onPeriodChange={setPeriod}
          period={period}
          sources={sources}
          onSourcesChange={setSources}
          showSourceFilter
          showCampaignFilter={false}
          hasActiveFilters={hasActiveFilters}
          onReset={resetFilters}
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Members"
            value={totalMembers !== null && totalMembers !== undefined
              ? totalMembers.toLocaleString()
              : '—'}
            description={newMembersInPeriod ? `+${newMembersInPeriod} in period` : undefined}
            icon={Users}
          />
          <MetricCard
            title="New Members"
            value={newMembersInPeriod !== null && newMembersInPeriod !== undefined
              ? newMembersInPeriod.toLocaleString()
              : '—'}
            description="In selected period"
            icon={UserCheck}
          />
          <MetricCard
            title="About Page Visits"
            value={aboutVisits !== null && aboutVisits !== undefined
              ? aboutVisits.toLocaleString()
              : '—'}
            description={aboutData?.totals?.avgDailyVisitors ? `Avg: ${Math.round(aboutData.totals.avgDailyVisitors)}/day` : undefined}
            icon={Target}
          />
          <MetricCard
            title="Conversion Rate"
            value={conversionRate !== null && conversionRate !== undefined
              ? `${conversionRate.toFixed(1)}%`
              : '—'}
            description="Avg for period"
            icon={Activity}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          <MetricCard
            title="Community Activity"
            value={activityData?.totals?.totalActivity !== null && activityData?.totals?.totalActivity !== undefined
              ? activityData.totals.totalActivity.toLocaleString()
              : '—'}
            description={activityData?.totals?.avgDailyActivity ? `Avg: ${activityData.totals.avgDailyActivity}/day` : undefined}
            icon={Activity}
          />
          <MetricCard
            title="Category Rank"
            value={categoryRank ? `#${categoryRank}` : '—'}
            description={`Category: ${category}`}
            icon={Award}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <AboutPageAnalytics dateRange={dateRange} />
          <DiscoveryRankAnalytics dateRange={dateRange} />
        </div>

        {/* Members and Community Activity Charts - Side by Side */}
        <div className="grid gap-4 lg:grid-cols-2">
          <MembersAnalytics dateRange={dateRange} sources={sources} />
          <CommunityActivityAnalytics dateRange={dateRange} />
        </div>
      </div>
    </AppShell>
  )
}
