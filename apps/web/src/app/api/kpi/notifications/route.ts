import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@0ne/db/server'
import {
  type NotificationPreferences,
  type NotificationPreferencesInput,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_METRICS_CONFIG,
} from '@0ne/db/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/settings/notifications
 * Fetch current user's notification preferences
 */
export async function GET() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('clerk_user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = "no rows returned" - that's fine, we'll return defaults
      console.error('Error fetching notification preferences:', error)
      return NextResponse.json(
        { error: 'Failed to fetch preferences' },
        { status: 500 }
      )
    }

    // If no preferences exist, return defaults with the user ID
    const preferences: NotificationPreferences = data || {
      clerk_user_id: userId,
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    return NextResponse.json({ preferences })
  } catch (error) {
    console.error('Error in GET /api/settings/notifications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/settings/notifications
 * Update (or create) user's notification preferences
 */
export async function PUT(request: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as NotificationPreferencesInput

    // Validate delivery_method if provided
    if (body.delivery_method && !['email', 'sms', 'both'].includes(body.delivery_method)) {
      return NextResponse.json(
        { error: 'Invalid delivery_method. Must be email, sms, or both.' },
        { status: 400 }
      )
    }

    // Validate delivery_time format if provided (HH:MM:SS or HH:MM)
    if (body.delivery_time) {
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/
      if (!timeRegex.test(body.delivery_time)) {
        return NextResponse.json(
          { error: 'Invalid delivery_time format. Use HH:MM or HH:MM:SS.' },
          { status: 400 }
        )
      }
      // Normalize to HH:MM:SS format
      if (body.delivery_time.length === 5) {
        body.delivery_time = `${body.delivery_time}:00`
      }
    }

    const supabase = createServerClient()

    // First, check if a record exists
    const { data: existing } = await supabase
      .from('notification_preferences')
      .select('clerk_user_id, metrics_config')
      .eq('clerk_user_id', userId)
      .single()

    // Build the upsert data
    const upsertData: Partial<NotificationPreferences> & { clerk_user_id: string } = {
      clerk_user_id: userId,
      updated_at: new Date().toISOString(),
    }

    // Only include fields that were provided
    if (body.daily_snapshot_enabled !== undefined) {
      upsertData.daily_snapshot_enabled = body.daily_snapshot_enabled
    }
    if (body.delivery_time !== undefined) {
      upsertData.delivery_time = body.delivery_time
    }
    if (body.delivery_email !== undefined) {
      upsertData.delivery_email = body.delivery_email
    }
    if (body.delivery_method !== undefined) {
      upsertData.delivery_method = body.delivery_method
    }
    if (body.metrics_config !== undefined) {
      // Merge with existing or default config
      const existingConfig = existing?.metrics_config || DEFAULT_METRICS_CONFIG
      upsertData.metrics_config = {
        ...existingConfig,
        ...body.metrics_config,
      }
    }
    if (body.alert_thresholds !== undefined) {
      upsertData.alert_thresholds = body.alert_thresholds
    }

    // If creating new record, set created_at
    if (!existing) {
      upsertData.created_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert(upsertData, {
        onConflict: 'clerk_user_id',
      })
      .select()
      .single()

    if (error) {
      console.error('Error upserting notification preferences:', error)
      return NextResponse.json(
        { error: 'Failed to update preferences' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      preferences: data,
    })
  } catch (error) {
    console.error('Error in PUT /api/settings/notifications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
