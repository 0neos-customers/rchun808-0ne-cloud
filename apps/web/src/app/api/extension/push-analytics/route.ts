import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@0ne/db/server'

export const dynamic = 'force-dynamic'

// CORS headers for Chrome extension
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

/**
 * OPTIONS /api/extension/push-analytics
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

/**
 * Chrome Extension Push Analytics API
 *
 * Receives analytics data captured from Skool admin dashboard
 * and stores them in the skool_analytics table.
 */

// =============================================
// Types
// =============================================

interface AnalyticsMetric {
  groupId: string
  postId?: string | null  // null for group-level metrics
  metricType: string      // 'views', 'engagement', 'comments', 'likes', 'shares', etc.
  metricValue: number
  metricDate: string      // ISO date string (YYYY-MM-DD)
  rawData?: Record<string, unknown>  // Original API response
}

interface PushAnalyticsRequest {
  staffSkoolId: string
  metrics: AnalyticsMetric[]
}

interface PushAnalyticsResponse {
  success: boolean
  synced: number   // New metrics inserted
  updated: number  // Metrics updated (on conflict)
  skipped: number  // Metrics skipped (invalid data)
  errors?: string[]
}

// =============================================
// Auth Helper
// =============================================

function validateExtensionApiKey(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('authorization')
  const expectedKey = process.env.EXTENSION_API_KEY

  if (!expectedKey) {
    console.error('[Extension API] EXTENSION_API_KEY environment variable not set')
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500, headers: corsHeaders }
    )
  }

  if (!authHeader) {
    return NextResponse.json(
      { error: 'Missing Authorization header' },
      { status: 401, headers: corsHeaders }
    )
  }

  // Extract Bearer token
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    return NextResponse.json(
      { error: 'Invalid Authorization header format. Expected: Bearer {apiKey}' },
      { status: 401, headers: corsHeaders }
    )
  }

  const apiKey = match[1]
  if (apiKey !== expectedKey) {
    return NextResponse.json(
      { error: 'Invalid API key' },
      { status: 401, headers: corsHeaders }
    )
  }

  return null // Valid
}

// =============================================
// POST /api/extension/push-analytics
// =============================================

export async function POST(request: NextRequest) {
  // Validate API key
  const authError = validateExtensionApiKey(request)
  if (authError) return authError

  try {
    const body: PushAnalyticsRequest = await request.json()

    // Validate request structure
    const validationError = validateRequest(body)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400, headers: corsHeaders })
    }

    const { staffSkoolId, metrics } = body

    console.log(
      `[Extension API] Received ${metrics.length} analytics metrics from user ${staffSkoolId}`
    )

    const supabase = createServerClient()
    let synced = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    // Process each metric
    for (const metric of metrics) {
      try {
        // Validate metric data
        if (!metric.groupId?.trim()) {
          skipped++
          continue
        }

        if (!metric.metricType?.trim()) {
          skipped++
          continue
        }

        if (typeof metric.metricValue !== 'number' || isNaN(metric.metricValue)) {
          skipped++
          continue
        }

        // Parse the date - expect YYYY-MM-DD format
        let metricDate: string | null = null
        if (metric.metricDate) {
          const dateMatch = metric.metricDate.match(/^\d{4}-\d{2}-\d{2}/)
          if (dateMatch) {
            metricDate = dateMatch[0]
          }
        }

        // Default to today if no date provided
        if (!metricDate) {
          metricDate = new Date().toISOString().split('T')[0]
        }

        const analyticsRow = {
          user_id: staffSkoolId,
          group_id: metric.groupId,
          post_id: metric.postId || null,
          metric_type: metric.metricType,
          metric_value: metric.metricValue,
          metric_date: metricDate,
          raw_data: metric.rawData || null,
        }

        // Use upsert to handle duplicates - update if exists
        const { error } = await supabase
          .from('skool_analytics')
          .upsert(analyticsRow, {
            onConflict: 'user_id,group_id,coalesce_post_id,metric_type,metric_date',
            ignoreDuplicates: false,
          })

        if (error) {
          // If upsert fails, try insert with conflict handling
          if (error.code === '23505') {
            // Duplicate - try update instead
            const { error: updateError } = await supabase
              .from('skool_analytics')
              .update({
                metric_value: metric.metricValue,
                raw_data: metric.rawData || null,
                recorded_at: new Date().toISOString(),
              })
              .eq('user_id', staffSkoolId)
              .eq('group_id', metric.groupId)
              .eq('metric_type', metric.metricType)
              .eq('metric_date', metricDate)
              .is('post_id', metric.postId || null)

            if (updateError) {
              console.error(`[Extension API] Error updating metric:`, updateError)
              errors.push(`Metric ${metric.metricType}: ${updateError.message}`)
            } else {
              updated++
            }
          } else {
            console.error(`[Extension API] Error inserting metric:`, error)
            errors.push(`Metric ${metric.metricType}: ${error.message}`)
          }
        } else {
          synced++
        }
      } catch (metricError) {
        console.error(`[Extension API] Exception processing metric:`, metricError)
        errors.push(
          `Metric: ${metricError instanceof Error ? metricError.message : 'Unknown error'}`
        )
      }
    }

    console.log(
      `[Extension API] Analytics complete: synced=${synced}, updated=${updated}, skipped=${skipped}, errors=${errors.length}`
    )

    const response: PushAnalyticsResponse = {
      success: errors.length === 0,
      synced,
      updated,
      skipped,
      ...(errors.length > 0 && { errors }),
    }

    return NextResponse.json(response, { headers: corsHeaders })
  } catch (error) {
    console.error('[Extension API] POST analytics exception:', error)
    return NextResponse.json(
      {
        success: false,
        synced: 0,
        updated: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      } as PushAnalyticsResponse,
      { status: 500, headers: corsHeaders }
    )
  }
}

// =============================================
// Validation
// =============================================

function validateRequest(body: PushAnalyticsRequest): string | null {
  if (!body.staffSkoolId?.trim()) {
    return 'Missing required field: staffSkoolId'
  }

  if (!Array.isArray(body.metrics)) {
    return 'metrics must be an array'
  }

  if (body.metrics.length === 0) {
    return 'metrics array cannot be empty'
  }

  // Validate each metric has required fields
  for (let i = 0; i < body.metrics.length; i++) {
    const metric = body.metrics[i]
    if (!metric.groupId?.trim()) {
      return `Metric at index ${i}: missing required field "groupId"`
    }
    if (!metric.metricType?.trim()) {
      return `Metric at index ${i}: missing required field "metricType"`
    }
    if (typeof metric.metricValue !== 'number') {
      return `Metric at index ${i}: missing or invalid field "metricValue" (must be a number)`
    }
  }

  return null
}
