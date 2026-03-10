/**
 * POST /api/telemetry/report
 *
 * Receives telemetry events from 0ne Doctor and Install Wizard.
 * Stores structured results in Supabase for install analytics and improvement.
 * Auto-detects failure patterns and returns known fixes when available.
 *
 * Auth: Bearer token (TELEMETRY_API_KEY env var)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@0ne/db/server'

export const dynamic = 'force-dynamic'

// CORS headers for CLI tools (not browsers, but good practice)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

// =============================================
// Types
// =============================================

interface FixAction {
  check_name: string
  category: string
  before_status: string
  before_detail: string
  action_taken: string
  after_status: string
  after_detail: string
  success: boolean
  error?: string
}

interface FixSummary {
  fixes_attempted: number
  fixes_succeeded: number
  fixes_failed: number
}

interface TelemetryRequest {
  event_type: 'doctor' | 'install'
  platform?: string
  arch?: string
  os_version?: string
  bun_version?: string
  one_version?: string
  principal_name?: string
  results: unknown
  fix_actions?: FixAction[]
  summary?: Record<string, unknown>
  system_info?: Record<string, unknown>
}

// Doctor result shape: { name, status: "pass"|"fail", detail, category, fixable }
interface DoctorResult {
  name: string
  status: string
  detail?: string
  category?: string
  fixable?: boolean
}

// Install result shape: { time, level: "info"|"warn"|"fail"|"skip", step, detail, ... }
interface InstallResult {
  time?: string
  level: string
  step: string
  detail?: string
  command?: string
  error?: string
}

interface ExtractedFailure {
  pattern_key: string
  failure_name: string
  category: string | null
}

// =============================================
// Pattern Detection Helpers
// =============================================

/**
 * Extract failures from results JSONB based on event type.
 * Doctor: items with status === "fail"
 * Install: items with level === "fail"
 */
function extractFailures(eventType: string, results: unknown): ExtractedFailure[] {
  if (!Array.isArray(results)) return []

  const failures: ExtractedFailure[] = []

  if (eventType === 'doctor') {
    for (const item of results as DoctorResult[]) {
      if (item.status === 'fail' && item.name) {
        const category = item.category || 'unknown'
        const nameSafe = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)
        failures.push({
          pattern_key: `doctor:${category}:${nameSafe}`,
          failure_name: item.name,
          category,
        })
      }
    }
  } else if (eventType === 'install') {
    for (const item of results as InstallResult[]) {
      if (item.level === 'fail' && item.step) {
        const step = item.step.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
        const detailSnip = (item.detail || '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .slice(0, 20)
        failures.push({
          pattern_key: `install:${step}:${detailSnip}`,
          failure_name: `${item.step}: ${item.detail || 'unknown'}`,
          category: item.step,
        })
      }
    }
  }

  return failures
}

// =============================================
// POST /api/telemetry/report
// =============================================

export async function POST(request: NextRequest) {
  // Validate bearer token
  const authHeader = request.headers.get('authorization')
  const expectedKey = process.env.TELEMETRY_API_KEY

  if (!expectedKey) {
    console.error('[Telemetry API] TELEMETRY_API_KEY environment variable not set')
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500, headers: corsHeaders }
    )
  }

  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i)
  if (!bearerMatch || bearerMatch[1] !== expectedKey) {
    return NextResponse.json(
      { error: 'Invalid or missing authorization' },
      { status: 401, headers: corsHeaders }
    )
  }

  try {
    const body: TelemetryRequest = await request.json()

    // Validate required fields
    if (!body.event_type || !['doctor', 'install'].includes(body.event_type)) {
      return NextResponse.json(
        { error: 'event_type must be "doctor" or "install"' },
        { status: 400, headers: corsHeaders }
      )
    }

    if (!body.results) {
      return NextResponse.json(
        { error: 'results field is required' },
        { status: 400, headers: corsHeaders }
      )
    }

    const supabase = createServerClient()

    // Build fix_summary from fix_actions if present
    const fixSummary: FixSummary | null = body.fix_actions && body.fix_actions.length > 0
      ? {
          fixes_attempted: body.fix_actions.length,
          fixes_succeeded: body.fix_actions.filter(fa => fa.success === true).length,
          fixes_failed: body.fix_actions.filter(fa => fa.success === false).length,
        }
      : (body.summary?.fixes_attempted != null
          ? {
              fixes_attempted: Number(body.summary.fixes_attempted),
              fixes_succeeded: Number(body.summary.fixes_succeeded ?? 0),
              fixes_failed: Number(body.summary.fixes_failed ?? 0),
            }
          : null)

    const row = {
      event_type: body.event_type,
      platform: body.platform || null,
      arch: body.arch || null,
      os_version: body.os_version || null,
      bun_version: body.bun_version || null,
      one_version: body.one_version || null,
      principal_name: body.principal_name || null,
      results: body.results,
      summary: body.summary || null,
      system_info: body.system_info || null,
      fix_actions: body.fix_actions || null,
      fix_summary: fixSummary,
    }

    const { data, error } = await supabase
      .from('telemetry_events')
      .insert(row)
      .select('id')
      .single()

    if (error) {
      console.error('[Telemetry API] Insert error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500, headers: corsHeaders }
      )
    }

    // =============================================
    // Auto-pattern detection
    // =============================================

    const knownFixes: { failure: string; fix: string }[] = []

    const failures = extractFailures(body.event_type, body.results)

    if (failures.length > 0) {
      const now = new Date().toISOString()

      // Upsert each failure pattern
      for (const failure of failures) {
        // Try to fetch existing pattern first
        const { data: existing } = await supabase
          .from('telemetry_failure_patterns')
          .select('id, occurrence_count, known_fix')
          .eq('pattern_key', failure.pattern_key)
          .single()

        if (existing) {
          // Increment count and update last_seen
          await supabase
            .from('telemetry_failure_patterns')
            .update({
              occurrence_count: existing.occurrence_count + 1,
              last_seen: now,
              updated_at: now,
            })
            .eq('id', existing.id)

          // Collect known fix if available
          if (existing.known_fix) {
            knownFixes.push({
              failure: failure.failure_name,
              fix: existing.known_fix,
            })
          }
        } else {
          // Insert new pattern
          await supabase
            .from('telemetry_failure_patterns')
            .insert({
              pattern_key: failure.pattern_key,
              failure_name: failure.failure_name,
              category: failure.category,
              occurrence_count: 1,
              first_seen: now,
              last_seen: now,
              updated_at: now,
            })
        }
      }
    }

    // =============================================
    // Auto-populate known fixes from successful fix_actions
    // =============================================

    if (body.fix_actions && body.fix_actions.length > 0) {
      for (const fa of body.fix_actions) {
        if (fa.success && fa.action_taken) {
          const category = fa.category || 'unknown'
          const nameSafe = fa.check_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)
          const patternKey = `doctor:${category}:${nameSafe}`

          // Look up matching pattern in telemetry_failure_patterns
          const { data: pattern } = await supabase
            .from('telemetry_failure_patterns')
            .select('id, known_fix')
            .eq('pattern_key', patternKey)
            .single()

          // If pattern exists and has no known_fix yet, teach it
          if (pattern && !pattern.known_fix) {
            await supabase
              .from('telemetry_failure_patterns')
              .update({
                known_fix: fa.action_taken,
                updated_at: new Date().toISOString(),
              })
              .eq('id', pattern.id)
          }
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        id: data.id,
        known_fixes: knownFixes.length > 0 ? knownFixes : undefined,
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('[Telemetry API] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
