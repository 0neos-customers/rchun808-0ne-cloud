'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { cn } from '@0ne/ui'
import { AppShell } from '@/components/shell'
import {
  Download,
  Stethoscope,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Apple,
  Terminal,
  Wrench,
} from 'lucide-react'
import {
  useInstallsStats,
  useInstallsEvents,
  type InstallsFilters,
  type TelemetryEvent,
} from '@/features/installs/hooks/use-installs-data'

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  triaged: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  fixed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  deployed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
}

const TYPE_COLORS: Record<string, string> = {
  doctor: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  install: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
}

const PLATFORM_ICONS: Record<string, typeof Monitor> = {
  darwin: Apple,
  win32: Monitor,
  linux: Terminal,
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function StatCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string
  value: string
  icon: typeof Download
  description?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-border bg-card p-5',
        'shadow-[0_1px_2px_rgba(34,32,29,0.05)]',
        'transition-shadow hover:shadow-[0_2px_8px_rgba(34,32,29,0.08)]'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {description && (
          <div className="text-xs text-muted-foreground">{description}</div>
        )}
      </div>
    </div>
  )
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        className
      )}
    >
      {children}
    </span>
  )
}

function ResultCounts({ summary }: { summary: TelemetryEvent['summary'] }) {
  if (!summary) return <span className="text-xs text-muted-foreground">--</span>

  const { pass = 0, fail = 0, warn = 0 } = summary

  return (
    <div className="flex items-center gap-2">
      {pass > 0 && (
        <span className="flex items-center gap-0.5 text-xs text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-3 w-3" />
          {pass}
        </span>
      )}
      {fail > 0 && (
        <span className="flex items-center gap-0.5 text-xs text-red-500 dark:text-red-400">
          <AlertTriangle className="h-3 w-3" />
          {fail}
        </span>
      )}
      {warn > 0 && (
        <span className="flex items-center gap-0.5 text-xs text-amber-500 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3" />
          {warn}
        </span>
      )}
      {pass === 0 && fail === 0 && warn === 0 && (
        <span className="text-xs text-muted-foreground">No results</span>
      )}
    </div>
  )
}

function PlatformLabel({ platform }: { platform: string | null }) {
  if (!platform) return <span className="text-xs text-muted-foreground">--</span>

  const Icon = PLATFORM_ICONS[platform] || Monitor
  const label = platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : platform === 'linux' ? 'Linux' : platform

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

// =============================================================================
// FILTER COMPONENTS
// =============================================================================

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-9 rounded-md border border-border bg-background px-3 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-9 rounded-md border border-border bg-background px-3 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
        )}
      />
    </div>
  )
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function InstallsPage() {
  // Filter state
  const [eventType, setEventType] = useState('')
  const [platform, setPlatform] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const perPage = 25

  // Build filters object (memoized to avoid unnecessary re-fetches)
  const filters: InstallsFilters = useMemo(
    () => ({
      event_type: eventType || undefined,
      platform: platform || undefined,
      status: status || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
    [eventType, platform, status, dateFrom, dateTo]
  )

  // Reset to page 1 when filters change
  const filtersKey = JSON.stringify(filters)
  const [prevFiltersKey, setPrevFiltersKey] = useState(filtersKey)
  if (filtersKey !== prevFiltersKey) {
    setPrevFiltersKey(filtersKey)
    setPage(1)
  }

  // Fetch data
  const { data: stats, isLoading: isStatsLoading } = useInstallsStats()
  const { data: events, isLoading: isEventsLoading, error } = useInstallsEvents(filters, page, perPage)

  const totalPages = events ? Math.ceil(events.total / events.per_page) : 0

  // Loading state
  if (isStatsLoading && isEventsLoading) {
    return (
      <AppShell title="Installs">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    )
  }

  // Error state
  if (error) {
    return (
      <AppShell title="Installs">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-destructive font-medium">Failed to load telemetry data</p>
            <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Installs">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Installs</h1>
            <p className="text-sm text-muted-foreground">
              Telemetry from 0ne Doctor and Install Wizard runs
            </p>
          </div>
          <Link
            href="/installs/patterns"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              'border border-border bg-background text-muted-foreground',
              'hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Failure Patterns
          </Link>
        </div>

        {/* Stats Bar */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Total Installs"
            value={stats?.total_installs?.toLocaleString() ?? '--'}
            icon={Download}
            description="Install wizard runs"
          />
          <StatCard
            title="Doctor Runs"
            value={stats?.total_doctor_runs?.toLocaleString() ?? '--'}
            icon={Stethoscope}
            description="Health check runs"
          />
          <StatCard
            title="Success Rate"
            value={stats?.success_rate != null ? `${stats.success_rate}%` : '--'}
            icon={CheckCircle2}
            description="Events with zero failures"
          />
          <StatCard
            title="Avg Issues"
            value={stats?.avg_issues != null ? stats.avg_issues.toFixed(1) : '--'}
            icon={AlertTriangle}
            description="Average failures per event"
          />
          <StatCard
            title="Fixes Applied"
            value={stats?.total_fixes?.toLocaleString() ?? '--'}
            icon={Wrench}
            description="Auto-fix resolutions"
          />
        </div>

        {/* Filters Row */}
        <div
          className={cn(
            'flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4',
            'shadow-[0_1px_2px_rgba(34,32,29,0.05)]'
          )}
        >
          <FilterSelect
            label="Event Type"
            value={eventType}
            onChange={setEventType}
            options={[
              { value: '', label: 'All Types' },
              { value: 'doctor', label: 'Doctor' },
              { value: 'install', label: 'Install' },
            ]}
          />
          <FilterSelect
            label="Platform"
            value={platform}
            onChange={setPlatform}
            options={[
              { value: '', label: 'All Platforms' },
              { value: 'darwin', label: 'macOS' },
              { value: 'win32', label: 'Windows' },
              { value: 'linux', label: 'Linux' },
            ]}
          />
          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'new', label: 'New' },
              { value: 'triaged', label: 'Triaged' },
              { value: 'fixed', label: 'Fixed' },
              { value: 'deployed', label: 'Deployed' },
            ]}
          />
          <DateInput label="From" value={dateFrom} onChange={setDateFrom} />
          <DateInput label="To" value={dateTo} onChange={setDateTo} />

          {(eventType || platform || status || dateFrom || dateTo) && (
            <button
              onClick={() => {
                setEventType('')
                setPlatform('')
                setStatus('')
                setDateFrom('')
                setDateTo('')
              }}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Events Table */}
        <div
          className={cn(
            'rounded-lg border border-border bg-card overflow-hidden',
            'shadow-[0_1px_2px_rgba(34,32,29,0.05)]'
          )}
        >
          {isEventsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : events && events.data.length > 0 ? (
            <>
              {/* Table Header */}
              <div className="grid grid-cols-[100px_80px_1fr_100px_140px_70px_90px] gap-4 border-b border-border px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <div>Date</div>
                <div>Type</div>
                <div>Principal</div>
                <div>Platform</div>
                <div>Results</div>
                <div>Fixes</div>
                <div>Status</div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-border">
                {events.data.map((event) => {
                  const fixSummary = event.fix_summary
                  let fixesLabel = '\u2014'
                  let fixesColor = 'text-muted-foreground'
                  if (fixSummary && fixSummary.fixes_attempted > 0) {
                    fixesLabel = `${fixSummary.fixes_succeeded}/${fixSummary.fixes_attempted}`
                    if (fixSummary.fixes_succeeded === fixSummary.fixes_attempted) {
                      fixesColor = 'text-green-600 dark:text-green-400'
                    } else if (fixSummary.fixes_succeeded > 0) {
                      fixesColor = 'text-amber-600 dark:text-amber-400'
                    } else {
                      fixesColor = 'text-muted-foreground'
                    }
                  }

                  return (
                    <Link
                      key={event.id}
                      href={`/installs/${event.id}`}
                      className="grid grid-cols-[100px_80px_1fr_100px_140px_70px_90px] gap-4 px-5 py-3 items-center hover:bg-accent/50 transition-colors cursor-pointer"
                    >
                      <div className="text-sm text-muted-foreground">
                        {formatDate(event.created_at)}
                      </div>
                      <div>
                        <Badge className={TYPE_COLORS[event.event_type] || 'bg-gray-100 text-gray-700'}>
                          {event.event_type}
                        </Badge>
                      </div>
                      <div className="text-sm font-medium truncate">
                        {event.principal_name || '--'}
                      </div>
                      <div>
                        <PlatformLabel platform={event.platform} />
                      </div>
                      <div>
                        <ResultCounts summary={event.summary} />
                      </div>
                      <div className={cn('text-sm font-medium tabular-nums', fixesColor)}>
                        {fixesLabel}
                      </div>
                      <div>
                        <Badge className={STATUS_COLORS[event.status] || 'bg-gray-100 text-gray-700'}>
                          {event.status}
                        </Badge>
                      </div>
                    </Link>
                  )
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-5 py-3">
                  <p className="text-sm text-muted-foreground">
                    Showing {((page - 1) * perPage) + 1}--{Math.min(page * perPage, events.total)} of {events.total} events
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className={cn(
                        'flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm transition-colors',
                        page <= 1
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-accent hover:text-accent-foreground'
                      )}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </button>
                    <span className="text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className={cn(
                        'flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm transition-colors',
                        page >= totalPages
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-accent hover:text-accent-foreground'
                      )}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <Stethoscope className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-base font-medium text-muted-foreground mb-1">
                No telemetry events yet
              </p>
              <p className="text-sm text-muted-foreground/70 text-center max-w-md">
                Events will appear here when 0ne Doctor or the Install Wizard are run with telemetry enabled.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
