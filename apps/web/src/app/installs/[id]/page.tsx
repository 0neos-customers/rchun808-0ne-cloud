'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@0ne/ui'
import { AppShell } from '@/components/shell'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  SkipForward,
  Loader2,
  Monitor,
  Apple,
  Terminal,
  Stethoscope,
  Download,
  MessageSquarePlus,
  ChevronDown,
  ChevronRight,
  Wrench,
  Clock,
  Circle,
} from 'lucide-react'
import {
  useInstallEvent,
  useUpdateStatus,
  useAddNote,
  type TelemetryEvent,
  type StatusHistoryEntry,
  type FixAction,
  type FixSummary,
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

const TYPE_ICONS: Record<string, typeof Stethoscope> = {
  doctor: Stethoscope,
  install: Download,
}

const PLATFORM_ICONS: Record<string, typeof Monitor> = {
  darwin: Apple,
  win32: Monitor,
  linux: Terminal,
}

const RESULT_STATUS_COLORS: Record<string, string> = {
  pass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  ok: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  info: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  fail: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  warn: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  skip: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  skipped: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
}

const STATUS_TIMELINE_COLORS: Record<string, string> = {
  new: 'bg-slate-400',
  triaged: 'bg-amber-400',
  fixed: 'bg-blue-400',
  deployed: 'bg-green-400',
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

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

function PlatformLabel({ platform, arch, osVersion }: { platform: string | null; arch?: string | null; osVersion?: string | null }) {
  if (!platform) return <span className="text-sm text-muted-foreground">--</span>

  const Icon = PLATFORM_ICONS[platform] || Monitor
  const label = platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : platform === 'linux' ? 'Linux' : platform

  return (
    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Icon className="h-4 w-4" />
      {label}
      {arch && <span className="text-xs">({arch})</span>}
      {osVersion && <span className="text-xs">v{osVersion}</span>}
    </span>
  )
}

function formatDateFull(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDateShort(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// =============================================================================
// SUMMARY BAR
// =============================================================================

function SummaryBar({ summary }: { summary: TelemetryEvent['summary'] }) {
  if (!summary) return null

  const { pass = 0, fail = 0, warn = 0, skip = 0 } = summary
  const total = pass + fail + warn + skip

  if (total === 0) return null

  const segments = [
    { count: pass, color: 'bg-green-500', label: 'Pass' },
    { count: fail, color: 'bg-red-500', label: 'Fail' },
    { count: warn, color: 'bg-amber-500', label: 'Warn' },
    { count: skip, color: 'bg-slate-300 dark:bg-slate-600', label: 'Skip' },
  ]

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-5',
        'shadow-[0_1px_2px_rgba(34,32,29,0.05)]'
      )}
    >
      <h2 className="text-sm font-medium text-muted-foreground mb-3">Results Summary</h2>

      {/* Counts */}
      <div className="flex items-center gap-6 mb-4">
        {pass > 0 && (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">{pass}</span>
            <span className="text-xs text-muted-foreground">pass</span>
          </div>
        )}
        {fail > 0 && (
          <div className="flex items-center gap-1.5">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium">{fail}</span>
            <span className="text-xs text-muted-foreground">fail</span>
          </div>
        )}
        {warn > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">{warn}</span>
            <span className="text-xs text-muted-foreground">warn</span>
          </div>
        )}
        {skip > 0 && (
          <div className="flex items-center gap-1.5">
            <SkipForward className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium">{skip}</span>
            <span className="text-xs text-muted-foreground">skip</span>
          </div>
        )}
      </div>

      {/* Proportional bar */}
      <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
        {segments.map((seg) =>
          seg.count > 0 ? (
            <div
              key={seg.label}
              className={cn(seg.color, 'transition-all')}
              style={{ width: `${(seg.count / total) * 100}%` }}
              title={`${seg.label}: ${seg.count}`}
            />
          ) : null
        )}
      </div>
    </div>
  )
}

// =============================================================================
// RESOLUTION SECTION
// =============================================================================

const FIX_STATUS_COLORS: Record<string, string> = {
  pass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  fail: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  warn: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

function ResolutionSection({
  fixActions,
  fixSummary,
}: {
  fixActions: FixAction[]
  fixSummary: FixSummary | null
}) {
  const attempted = fixSummary?.fixes_attempted ?? fixActions.length
  const succeeded = fixSummary?.fixes_succeeded ?? fixActions.filter((a) => a.success).length
  const failed = fixSummary?.fixes_failed ?? fixActions.filter((a) => !a.success).length
  const total = succeeded + failed

  return (
    <div className="space-y-4">
      {/* Fix Summary Bar */}
      <div
        className={cn(
          'rounded-lg border border-border bg-card p-5',
          'shadow-[0_1px_2px_rgba(34,32,29,0.05)]'
        )}
      >
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Resolution</h2>

        {/* Counts */}
        <div className="flex items-center gap-6 mb-4">
          <div className="flex items-center gap-1.5">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{attempted}</span>
            <span className="text-xs text-muted-foreground">attempted</span>
          </div>
          {succeeded > 0 && (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">{succeeded}</span>
              <span className="text-xs text-muted-foreground">succeeded</span>
            </div>
          )}
          {failed > 0 && (
            <div className="flex items-center gap-1.5">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium">{failed}</span>
              <span className="text-xs text-muted-foreground">failed</span>
            </div>
          )}
        </div>

        {/* Proportional bar */}
        {total > 0 && (
          <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
            {succeeded > 0 && (
              <div
                className="bg-green-500 transition-all"
                style={{ width: `${(succeeded / total) * 100}%` }}
                title={`Succeeded: ${succeeded}`}
              />
            )}
            {failed > 0 && (
              <div
                className="bg-red-500 transition-all"
                style={{ width: `${(failed / total) * 100}%` }}
                title={`Failed: ${failed}`}
              />
            )}
          </div>
        )}
      </div>

      {/* Fix Action Cards */}
      <div className="space-y-3">
        {fixActions.map((action, idx) => (
          <div
            key={idx}
            className={cn(
              'rounded-lg border bg-card overflow-hidden',
              'shadow-[0_1px_2px_rgba(34,32,29,0.05)]',
              action.success
                ? 'border-l-4 border-l-green-500 border-t-border border-r-border border-b-border'
                : 'border-l-4 border-l-red-500 border-t-border border-r-border border-b-border'
            )}
          >
            <div className="p-4">
              {/* Before / Arrow / After */}
              <div className="grid grid-cols-[1fr_32px_1fr] gap-3 items-start">
                {/* Before */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Badge className={FIX_STATUS_COLORS[action.before_status] || 'bg-slate-100 text-slate-500'}>
                      {action.before_status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{action.category}</span>
                  </div>
                  <div className="text-sm font-medium">{action.check_name}</div>
                  <div className="text-xs text-muted-foreground">{action.before_detail}</div>
                </div>

                {/* Arrow */}
                <div className="flex items-center justify-center pt-3">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>

                {/* After */}
                <div className="space-y-1.5">
                  <Badge className={FIX_STATUS_COLORS[action.after_status] || 'bg-slate-100 text-slate-500'}>
                    {action.after_status}
                  </Badge>
                  <div className="text-xs text-muted-foreground mt-1.5">{action.after_detail}</div>
                </div>
              </div>

              {/* Action taken */}
              <div className="mt-3 rounded-md bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 px-3 py-2">
                <code className="text-xs text-foreground font-mono whitespace-pre-wrap break-words">
                  {action.action_taken}
                </code>
              </div>

              {/* Error message if failed */}
              {!action.success && action.error && (
                <div className="mt-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 px-3 py-2">
                  <div className="text-xs font-medium text-red-700 dark:text-red-400 mb-0.5">Error</div>
                  <pre className="text-xs text-red-600 dark:text-red-300 whitespace-pre-wrap break-words font-mono">
                    {action.error}
                  </pre>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// ACTION BUTTONS
// =============================================================================

function ActionButtons({
  event,
  onStatusChange,
  onNoteAdd,
  isUpdating,
}: {
  event: TelemetryEvent
  onStatusChange: (payload: {
    status: 'triaged' | 'fixed' | 'deployed'
    note?: string
    fix_commit?: string
    fix_notes?: string
  }) => void
  onNoteAdd: (note: string) => void
  isUpdating: boolean
}) {
  const [showFixForm, setShowFixForm] = useState(false)
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [fixCommit, setFixCommit] = useState('')
  const [fixNotes, setFixNotes] = useState('')
  const [note, setNote] = useState('')
  const [triageNote, setTriageNote] = useState('')
  const [showTriageNote, setShowTriageNote] = useState(false)

  const handleTriage = () => {
    if (showTriageNote && triageNote.trim()) {
      onStatusChange({ status: 'triaged', note: triageNote.trim() })
      setTriageNote('')
      setShowTriageNote(false)
    } else if (!showTriageNote) {
      setShowTriageNote(true)
    } else {
      onStatusChange({ status: 'triaged' })
      setShowTriageNote(false)
    }
  }

  const handleFix = () => {
    onStatusChange({
      status: 'fixed',
      fix_commit: fixCommit.trim() || undefined,
      fix_notes: fixNotes.trim() || undefined,
    })
    setFixCommit('')
    setFixNotes('')
    setShowFixForm(false)
  }

  const handleDeploy = () => {
    onStatusChange({ status: 'deployed' })
  }

  const handleNote = () => {
    if (note.trim()) {
      onNoteAdd(note.trim())
      setNote('')
      setShowNoteForm(false)
    }
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-5',
        'shadow-[0_1px_2px_rgba(34,32,29,0.05)]'
      )}
    >
      <h2 className="text-sm font-medium text-muted-foreground mb-3">Actions</h2>

      <div className="flex flex-wrap items-start gap-3">
        {/* Triage button */}
        {event.status === 'new' && (
          <div className="flex flex-col gap-2">
            <button
              onClick={handleTriage}
              disabled={isUpdating}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                'bg-amber-100 text-amber-700 hover:bg-amber-200',
                'dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50',
                isUpdating && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
              Mark as Triaged
            </button>
            {showTriageNote && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={triageNote}
                  onChange={(e) => setTriageNote(e.target.value)}
                  placeholder="Triage note (optional)"
                  className={cn(
                    'h-8 rounded-md border border-border bg-background px-3 text-sm flex-1',
                    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
                  )}
                  onKeyDown={(e) => e.key === 'Enter' && handleTriage()}
                />
                <button
                  onClick={handleTriage}
                  disabled={isUpdating}
                  className="h-8 rounded-md bg-amber-500 px-3 text-sm font-medium text-white hover:bg-amber-600 transition-colors"
                >
                  Confirm
                </button>
              </div>
            )}
          </div>
        )}

        {/* Fix button */}
        {(event.status === 'new' || event.status === 'triaged') && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowFixForm(!showFixForm)}
              disabled={isUpdating}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                'bg-blue-100 text-blue-700 hover:bg-blue-200',
                'dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50',
                isUpdating && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
              Mark as Fixed
            </button>
            {showFixForm && (
              <div className="flex flex-col gap-2 min-w-[280px]">
                <input
                  type="text"
                  value={fixCommit}
                  onChange={(e) => setFixCommit(e.target.value)}
                  placeholder="Fix commit hash (optional)"
                  className={cn(
                    'h-8 rounded-md border border-border bg-background px-3 text-sm font-mono',
                    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
                  )}
                />
                <textarea
                  value={fixNotes}
                  onChange={(e) => setFixNotes(e.target.value)}
                  placeholder="Fix notes (optional)"
                  rows={2}
                  className={cn(
                    'rounded-md border border-border bg-background px-3 py-2 text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                    'resize-none'
                  )}
                />
                <button
                  onClick={handleFix}
                  disabled={isUpdating}
                  className="h-8 rounded-md bg-blue-500 px-3 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
                >
                  Confirm Fix
                </button>
              </div>
            )}
          </div>
        )}

        {/* Deploy button */}
        {event.status === 'fixed' && (
          <button
            onClick={handleDeploy}
            disabled={isUpdating}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              'bg-green-100 text-green-700 hover:bg-green-200',
              'dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50',
              isUpdating && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Mark as Deployed
          </button>
        )}

        {/* Add Note button */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowNoteForm(!showNoteForm)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              'border border-border bg-background text-muted-foreground',
              'hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            Add Note
          </button>
          {showNoteForm && (
            <div className="flex gap-2 min-w-[280px]">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                className={cn(
                  'rounded-md border border-border bg-background px-3 py-2 text-sm flex-1',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  'resize-none'
                )}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.metaKey) handleNote()
                }}
              />
              <button
                onClick={handleNote}
                disabled={isUpdating || !note.trim()}
                className={cn(
                  'h-8 self-end rounded-md bg-foreground px-3 text-sm font-medium text-background',
                  'hover:bg-foreground/90 transition-colors',
                  (!note.trim() || isUpdating) && 'opacity-50 cursor-not-allowed'
                )}
              >
                Save
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// DOCTOR RESULTS TABLE
// =============================================================================

function DoctorResultsTable({ results }: { results: Record<string, unknown>[] }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card overflow-hidden',
        'shadow-[0_1px_2px_rgba(34,32,29,0.05)]'
      )}
    >
      <div className="px-5 py-3 border-b border-border">
        <h2 className="text-sm font-medium text-muted-foreground">Check Results</h2>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[1fr_80px_2fr_100px_70px] gap-4 border-b border-border px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <div>Name</div>
        <div>Status</div>
        <div>Detail</div>
        <div>Category</div>
        <div>Fixable</div>
      </div>

      {/* Table Rows */}
      <div className="divide-y divide-border">
        {results.map((result, idx) => {
          const name = String(result.name || '')
          const status = String(result.status || '').toLowerCase()
          const detail = String(result.detail || result.message || '')
          const category = String(result.category || '--')
          const fixable = result.fixable

          return (
            <div
              key={idx}
              className="grid grid-cols-[1fr_80px_2fr_100px_70px] gap-4 px-5 py-3 items-center text-sm"
            >
              <div className="font-medium truncate" title={name}>
                {name || '--'}
              </div>
              <div>
                <Badge className={RESULT_STATUS_COLORS[status] || 'bg-slate-100 text-slate-500'}>
                  {status || '--'}
                </Badge>
              </div>
              <div className="text-muted-foreground truncate" title={detail}>
                {detail || '--'}
              </div>
              <div className="text-xs text-muted-foreground">{category}</div>
              <div className="text-center">
                {fixable === true ? (
                  <span className="text-green-600 dark:text-green-400">Y</span>
                ) : fixable === false ? (
                  <span className="text-red-500 dark:text-red-400">N</span>
                ) : (
                  <span className="text-muted-foreground">--</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =============================================================================
// INSTALL RESULTS TABLE
// =============================================================================

function InstallResultsTable({ results }: { results: Record<string, unknown>[] }) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  const toggleRow = (idx: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) {
        next.delete(idx)
      } else {
        next.add(idx)
      }
      return next
    })
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card overflow-hidden',
        'shadow-[0_1px_2px_rgba(34,32,29,0.05)]'
      )}
    >
      <div className="px-5 py-3 border-b border-border">
        <h2 className="text-sm font-medium text-muted-foreground">Install Log</h2>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[100px_70px_120px_1fr_40px] gap-4 border-b border-border px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <div>Time</div>
        <div>Level</div>
        <div>Step</div>
        <div>Detail</div>
        <div></div>
      </div>

      {/* Table Rows */}
      <div className="divide-y divide-border">
        {results.map((result, idx) => {
          const timestamp = result.timestamp ? String(result.timestamp) : ''
          const level = String(result.level || result.status || '').toLowerCase()
          const step = String(result.step || '')
          const detail = String(result.detail || result.message || '')
          const error = result.error ? String(result.error) : ''
          const command = result.command ? String(result.command) : ''
          const hasExtra = !!(error || command)
          const isExpanded = expandedRows.has(idx)

          // Format timestamp to just show time
          let timeStr = '--'
          if (timestamp) {
            try {
              const d = new Date(timestamp)
              timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            } catch {
              timeStr = timestamp
            }
          }

          return (
            <div key={idx}>
              <div
                className={cn(
                  'grid grid-cols-[100px_70px_120px_1fr_40px] gap-4 px-5 py-3 items-center text-sm',
                  hasExtra && 'cursor-pointer hover:bg-accent/30'
                )}
                onClick={() => hasExtra && toggleRow(idx)}
              >
                <div className="text-xs text-muted-foreground font-mono">{timeStr}</div>
                <div>
                  <Badge className={RESULT_STATUS_COLORS[level] || 'bg-slate-100 text-slate-500'}>
                    {level || '--'}
                  </Badge>
                </div>
                <div className="text-xs font-medium truncate" title={step}>{step || '--'}</div>
                <div className="text-muted-foreground truncate" title={detail}>{detail || '--'}</div>
                <div className="flex justify-center">
                  {hasExtra && (
                    isExpanded
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && hasExtra && (
                <div className="px-5 pb-3 space-y-2">
                  {error && (
                    <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-3">
                      <div className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">Error</div>
                      <pre className="text-xs text-red-600 dark:text-red-300 whitespace-pre-wrap break-words font-mono">
                        {error}
                      </pre>
                    </div>
                  )}
                  {command && (
                    <div className="rounded-md bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 p-3">
                      <div className="text-xs font-medium text-muted-foreground mb-1">Command</div>
                      <code className="text-xs text-foreground font-mono">{command}</code>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =============================================================================
// SYSTEM INFO PANEL
// =============================================================================

function SystemInfoPanel({ event }: { event: TelemetryEvent }) {
  const systemInfo = event.system_info as Record<string, unknown> | null

  // Collect all key-value pairs
  const entries: [string, string][] = []

  // Standard fields first
  if (event.bun_version) entries.push(['Bun Version', event.bun_version])
  if (event.os_version) entries.push(['OS Version', event.os_version])
  if (event.one_version) entries.push(['0ne Version', event.one_version])

  // Then system_info entries
  if (systemInfo) {
    for (const [key, value] of Object.entries(systemInfo)) {
      if (value !== null && value !== undefined && value !== '') {
        entries.push([key, String(value)])
      }
    }
  }

  if (entries.length === 0) return null

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-5',
        'shadow-[0_1px_2px_rgba(34,32,29,0.05)]'
      )}
    >
      <h2 className="text-sm font-medium text-muted-foreground mb-3">System Info</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-baseline gap-2 py-1">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              {key}
            </span>
            <span className="text-sm font-mono truncate" title={value}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// STATUS TIMELINE
// =============================================================================

function StatusTimeline({ history, event }: { history: StatusHistoryEntry[]; event: TelemetryEvent }) {
  // history is already ordered newest first from the API
  // Add the creation event at the bottom
  const timelineEntries = [
    ...history,
    {
      id: 'created',
      event_id: event.id,
      old_status: null,
      new_status: 'new',
      note: 'Event created',
      created_at: event.created_at,
    } as StatusHistoryEntry,
  ]

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-5',
        'shadow-[0_1px_2px_rgba(34,32,29,0.05)]'
      )}
    >
      <h2 className="text-sm font-medium text-muted-foreground mb-4">Status Timeline</h2>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

        <div className="space-y-4">
          {timelineEntries.map((entry) => {
            const isStatusChange = entry.old_status !== entry.new_status
            const dotColor = STATUS_TIMELINE_COLORS[entry.new_status] || 'bg-slate-400'

            return (
              <div key={entry.id} className="flex gap-3 relative">
                {/* Dot */}
                <div className={cn('h-[15px] w-[15px] rounded-full border-2 border-background flex-shrink-0 z-10', dotColor)} />

                {/* Content */}
                <div className="flex-1 min-w-0 -mt-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isStatusChange ? (
                      <span className="text-sm font-medium">
                        {entry.old_status || 'new'}
                        <span className="text-muted-foreground mx-1">→</span>
                        {entry.new_status}
                      </span>
                    ) : (
                      <span className="text-sm font-medium flex items-center gap-1">
                        <MessageSquarePlus className="h-3 w-3" />
                        Note
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDateShort(entry.created_at)}
                    </span>
                  </div>
                  {entry.note && entry.id !== 'created' && (
                    <p className="text-sm text-muted-foreground mt-1">{entry.note}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function InstallDetailPage() {
  const params = useParams()
  const id = params.id as string

  const { data, isLoading, error, refetch } = useInstallEvent(id)
  const { updateStatus, isLoading: isUpdating } = useUpdateStatus(id)
  const { addNote, isLoading: isAddingNote } = useAddNote(id)

  const handleStatusChange = async (payload: {
    status: 'triaged' | 'fixed' | 'deployed'
    note?: string
    fix_commit?: string
    fix_notes?: string
  }) => {
    try {
      await updateStatus(payload)
      await refetch()
    } catch {
      // Error is already captured in the hook
    }
  }

  const handleAddNote = async (note: string) => {
    try {
      await addNote(note)
      await refetch()
    } catch {
      // Error is already captured in the hook
    }
  }

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
  if (error || !data) {
    return (
      <AppShell title="Installs">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <div className="text-center">
            <p className="text-destructive font-medium">
              {error?.message || 'Event not found'}
            </p>
          </div>
          <Link
            href="/installs"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Installs
          </Link>
        </div>
      </AppShell>
    )
  }

  const { event, status_history } = data
  const TypeIcon = TYPE_ICONS[event.event_type] || Circle
  const results = (event.results || []) as Record<string, unknown>[]

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
        <div
          className={cn(
            'rounded-lg border border-border bg-card p-5',
            'shadow-[0_1px_2px_rgba(34,32,29,0.05)]'
          )}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <TypeIcon className="h-6 w-6 text-muted-foreground" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={TYPE_COLORS[event.event_type] || 'bg-gray-100 text-gray-700'}>
                    {event.event_type}
                  </Badge>
                  <Badge className={STATUS_COLORS[event.status] || 'bg-gray-100 text-gray-700'}>
                    {event.status}
                  </Badge>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {formatDateFull(event.created_at)}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-1">
              <div className="text-sm font-medium">
                {event.principal_name || 'Unknown'}
              </div>
              <PlatformLabel
                platform={event.platform}
                arch={event.arch}
                osVersion={event.os_version}
              />
            </div>
          </div>

          {/* Fix info if present */}
          {(event.fix_commit || event.fix_notes) && (
            <div className="mt-4 pt-4 border-t border-border">
              {event.fix_commit && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Fix commit:</span>
                  <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    {event.fix_commit}
                  </code>
                </div>
              )}
              {event.fix_notes && (
                <div className="text-sm text-muted-foreground mt-1">
                  {event.fix_notes}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Summary bar */}
        <SummaryBar summary={event.summary} />

        {/* Resolution section — only when fix_actions exist */}
        {event.fix_actions && event.fix_actions.length > 0 && (
          <ResolutionSection
            fixActions={event.fix_actions}
            fixSummary={event.fix_summary}
          />
        )}

        {/* Action buttons */}
        <ActionButtons
          event={event}
          onStatusChange={handleStatusChange}
          onNoteAdd={handleAddNote}
          isUpdating={isUpdating || isAddingNote}
        />

        {/* Results table */}
        {results.length > 0 && (
          event.event_type === 'doctor' ? (
            <DoctorResultsTable results={results} />
          ) : (
            <InstallResultsTable results={results} />
          )
        )}

        {/* System info */}
        <SystemInfoPanel event={event} />

        {/* Status timeline */}
        <StatusTimeline history={status_history} event={event} />
      </div>
    </AppShell>
  )
}
