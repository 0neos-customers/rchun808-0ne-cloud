'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { cn } from '@0ne/ui'
import { AppShell } from '@/components/shell'
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Fingerprint,
  X,
} from 'lucide-react'
import {
  useFailurePatterns,
  type FailurePattern,
} from '@/features/installs/hooks/use-installs-data'

// =============================================================================
// CONSTANTS
// =============================================================================

const CATEGORY_COLORS: Record<string, string> = {
  structure: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  config: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  symlink: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  services: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  skills: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  memory: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  environment: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  cli: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  hooks: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  dependencies: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
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
  icon: typeof Fingerprint
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
// DOCUMENT FIX FORM (inline per row)
// =============================================================================

function DocumentFixForm({
  pattern,
  onSave,
  onCancel,
}: {
  pattern: FailurePattern
  onSave: (patternId: string, knownFix: string, autoFixable: boolean) => Promise<void>
  onCancel: () => void
}) {
  const [knownFix, setKnownFix] = useState(pattern.known_fix || '')
  const [autoFixable, setAutoFixable] = useState(pattern.auto_fixable)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!knownFix.trim()) return
    setIsSaving(true)
    try {
      await onSave(pattern.id, knownFix.trim(), autoFixable)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="px-5 pb-4 pt-1 bg-accent/20 border-t border-border">
      <div className="flex flex-col gap-3 max-w-xl">
        <label className="text-xs font-medium text-muted-foreground">
          Known Fix
        </label>
        <textarea
          value={knownFix}
          onChange={(e) => setKnownFix(e.target.value)}
          placeholder="Describe how to fix this issue..."
          rows={3}
          className={cn(
            'rounded-md border border-border bg-background px-3 py-2 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'resize-none'
          )}
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={autoFixable}
            onChange={(e) => setAutoFixable(e.target.checked)}
            className="rounded border-border"
          />
          Auto-fixable (doctor --fix can resolve this)
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving || !knownFix.trim()}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              'bg-foreground text-background hover:bg-foreground/90',
              (isSaving || !knownFix.trim()) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </button>
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// CATEGORY BREAKDOWN
// =============================================================================

function CategoryBreakdown({ patterns }: { patterns: FailurePattern[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of patterns) {
      const cat = p.category || 'uncategorized'
      map.set(cat, (map.get(cat) || 0) + 1)
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [patterns])

  if (grouped.length <= 1) return null

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-5',
        'shadow-[0_1px_2px_rgba(34,32,29,0.05)]'
      )}
    >
      <h2 className="text-sm font-medium text-muted-foreground mb-3">By Category</h2>
      <div className="flex flex-wrap gap-3">
        {grouped.map(([category, count]) => (
          <div
            key={category}
            className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
          >
            <Badge className={CATEGORY_COLORS[category] || 'bg-slate-100 text-slate-500'}>
              {category}
            </Badge>
            <span className="text-sm font-medium">{count}</span>
            <span className="text-xs text-muted-foreground">
              {count === 1 ? 'pattern' : 'patterns'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function PatternsPage() {
  const { data: patterns, isLoading, error, refetch } = useFailurePatterns()
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const stats = useMemo(() => {
    if (!patterns) return { total: 0, withFix: 0, autoFixable: 0 }
    return {
      total: patterns.length,
      withFix: patterns.filter((p) => p.known_fix).length,
      autoFixable: patterns.filter((p) => p.auto_fixable).length,
    }
  }, [patterns])

  const handleSaveFix = useCallback(async (patternId: string, knownFix: string, autoFixable: boolean) => {
    const response = await fetch(`/api/installs/dashboard/patterns/${patternId}/fix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ known_fix: knownFix, auto_fixable: autoFixable }),
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || 'Failed to save fix')
    }
    setExpandedRow(null)
    await refetch()
  }, [refetch])

  // Loading state
  if (isLoading) {
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
            <p className="text-destructive font-medium">Failed to load failure patterns</p>
            <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Installs">
      <div className="space-y-6">
        {/* Back link */}
        <Link
          href="/installs"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Installs
        </Link>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Failure Patterns</h1>
          <p className="text-sm text-muted-foreground">
            Common failures across all installs and doctor runs
          </p>
        </div>

        {/* Stats Bar */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title="Total Patterns"
            value={stats.total.toLocaleString()}
            icon={Fingerprint}
            description="Unique failure patterns detected"
          />
          <StatCard
            title="With Known Fix"
            value={stats.withFix.toLocaleString()}
            icon={Wrench}
            description="Patterns with documented fixes"
          />
          <StatCard
            title="Auto-Fixable"
            value={stats.autoFixable.toLocaleString()}
            icon={CheckCircle2}
            description="Can be resolved by doctor --fix"
          />
        </div>

        {/* Category Breakdown */}
        {patterns && patterns.length > 0 && (
          <CategoryBreakdown patterns={patterns} />
        )}

        {/* Patterns Table */}
        <div
          className={cn(
            'rounded-lg border border-border bg-card overflow-hidden',
            'shadow-[0_1px_2px_rgba(34,32,29,0.05)]'
          )}
        >
          {patterns && patterns.length > 0 ? (
            <>
              {/* Table Header */}
              <div className="grid grid-cols-[1fr_100px_90px_90px_90px_2fr_80px_100px] gap-4 border-b border-border px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <div>Failure Name</div>
                <div>Category</div>
                <div className="text-right">Occurrences</div>
                <div>First Seen</div>
                <div>Last Seen</div>
                <div>Known Fix</div>
                <div className="text-center">Auto-Fix</div>
                <div>Actions</div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-border">
                {patterns.map((pattern) => (
                  <div key={pattern.id}>
                    <div className="grid grid-cols-[1fr_100px_90px_90px_90px_2fr_80px_100px] gap-4 px-5 py-3 items-center">
                      {/* Failure Name */}
                      <div className="text-sm font-medium truncate" title={pattern.failure_name}>
                        {pattern.failure_name}
                      </div>

                      {/* Category */}
                      <div>
                        {pattern.category ? (
                          <Badge
                            className={
                              CATEGORY_COLORS[pattern.category] ||
                              'bg-slate-100 text-slate-500'
                            }
                          >
                            {pattern.category}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">--</span>
                        )}
                      </div>

                      {/* Occurrences */}
                      <div className="text-right">
                        <span className="text-sm font-semibold tabular-nums">
                          {pattern.occurrence_count}
                        </span>
                      </div>

                      {/* First Seen */}
                      <div className="text-xs text-muted-foreground">
                        {formatDate(pattern.first_seen)}
                      </div>

                      {/* Last Seen */}
                      <div className="text-xs text-muted-foreground">
                        {formatDate(pattern.last_seen)}
                      </div>

                      {/* Known Fix */}
                      <div className="text-sm text-muted-foreground" title={pattern.known_fix || undefined}>
                        {pattern.known_fix ? (
                          <div className="space-y-1">
                            <div className="truncate">{pattern.known_fix}</div>
                            <span className="inline-flex items-center rounded-full bg-sky-50 dark:bg-sky-950/30 px-1.5 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-400">
                              Auto-learned
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs">--</span>
                        )}
                      </div>

                      {/* Auto-Fixable */}
                      <div className="text-center">
                        {pattern.auto_fixable ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                        )}
                      </div>

                      {/* Actions */}
                      <div>
                        <button
                          onClick={() =>
                            setExpandedRow(
                              expandedRow === pattern.id ? null : pattern.id
                            )
                          }
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                            'border border-border bg-background text-muted-foreground',
                            'hover:bg-accent hover:text-accent-foreground',
                            expandedRow === pattern.id && 'bg-accent text-accent-foreground'
                          )}
                        >
                          <Wrench className="h-3 w-3" />
                          {pattern.known_fix ? 'Edit Fix' : 'Document Fix'}
                        </button>
                      </div>
                    </div>

                    {/* Inline fix form */}
                    {expandedRow === pattern.id && (
                      <DocumentFixForm
                        pattern={pattern}
                        onSave={handleSaveFix}
                        onCancel={() => setExpandedRow(null)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <AlertTriangle className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-base font-medium text-muted-foreground mb-1">
                No failure patterns detected yet
              </p>
              <p className="text-sm text-muted-foreground/70 text-center max-w-md">
                Patterns will appear here as 0ne Doctor and Install Wizard runs report
                common failures across installs.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
