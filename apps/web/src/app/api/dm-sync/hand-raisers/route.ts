import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@0ne/db/server'

export const dynamic = 'force-dynamic'

interface HandRaiserCampaignWithStats {
  id: string
  clerk_user_id: string
  post_url: string
  skool_post_id: string | null
  keyword_filter: string | null
  dm_template: string | null  // Now optional - if null, only tags GHL (no DM sent)
  ghl_tag: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  stats: {
    sent_count: number
    last_sent_at: string | null
  }
}

/**
 * GET /api/dm-sync/hand-raisers
 * List all hand-raiser campaigns with stats (sent DM count per campaign)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active_only') === 'true'

    let query = supabase
      .from('dm_hand_raiser_campaigns')
      .select('*')
      .order('created_at', { ascending: false })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('[Hand-Raisers API] GET error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get stats for each campaign
    let campaignsWithStats: HandRaiserCampaignWithStats[] = []
    if (data && data.length > 0) {
      const campaignIds = data.map((c) => c.id)

      // Get sent DMs for each campaign
      const { data: sentDms } = await supabase
        .from('dm_hand_raiser_sent')
        .select('campaign_id, sent_at')
        .in('campaign_id', campaignIds)

      // Aggregate stats
      const statsMap = new Map<
        string,
        { sent_count: number; last_sent_at: string | null }
      >()

      sentDms?.forEach((dm) => {
        if (!dm.campaign_id) return
        const existing = statsMap.get(dm.campaign_id) || {
          sent_count: 0,
          last_sent_at: null,
        }
        existing.sent_count++
        // Track most recent sent_at
        if (!existing.last_sent_at || dm.sent_at > existing.last_sent_at) {
          existing.last_sent_at = dm.sent_at
        }
        statsMap.set(dm.campaign_id, existing)
      })

      campaignsWithStats = data.map((campaign) => ({
        ...campaign,
        stats: statsMap.get(campaign.id) || { sent_count: 0, last_sent_at: null },
      }))
    }

    return NextResponse.json({ campaigns: campaignsWithStats })
  } catch (error) {
    console.error('[Hand-Raisers API] GET exception:', error)
    return NextResponse.json(
      { error: 'Failed to fetch hand-raiser campaigns', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/dm-sync/hand-raisers
 * Create a new hand-raiser campaign
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()
    const body = await request.json()

    // Validate required fields
    if (!body.post_url) {
      return NextResponse.json({ error: 'Missing required field: post_url' }, { status: 400 })
    }
    // dm_template is now OPTIONAL:
    // - With template: Tags GHL + queues DM for extension to send
    // - Without template: Tags GHL only (use GHL workflows for messaging)

    const { data, error } = await supabase
      .from('dm_hand_raiser_campaigns')
      .insert({
        clerk_user_id: userId,
        post_url: body.post_url,
        skool_post_id: body.skool_post_id || null,
        keyword_filter: body.keyword_filter || null,
        dm_template: body.dm_template || null,  // Optional - can be null
        ghl_tag: body.ghl_tag || null,
        is_active: body.is_active ?? true,
      })
      .select()
      .single()

    if (error) {
      console.error('[Hand-Raisers API] POST error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ campaign: data }, { status: 201 })
  } catch (error) {
    console.error('[Hand-Raisers API] POST exception:', error)
    return NextResponse.json(
      { error: 'Failed to create hand-raiser campaign', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/dm-sync/hand-raisers
 * Update an existing hand-raiser campaign
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('dm_hand_raiser_campaigns')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[Hand-Raisers API] PUT error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    return NextResponse.json({ campaign: data })
  } catch (error) {
    console.error('[Hand-Raisers API] PUT exception:', error)
    return NextResponse.json(
      { error: 'Failed to update hand-raiser campaign', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/dm-sync/hand-raisers?id=xxx
 * Delete a hand-raiser campaign
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing id query parameter' }, { status: 400 })
    }

    const { error } = await supabase.from('dm_hand_raiser_campaigns').delete().eq('id', id)

    if (error) {
      console.error('[Hand-Raisers API] DELETE error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Hand-Raisers API] DELETE exception:', error)
    return NextResponse.json(
      { error: 'Failed to delete hand-raiser campaign', details: String(error) },
      { status: 500 }
    )
  }
}
