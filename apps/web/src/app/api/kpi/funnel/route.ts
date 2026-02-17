import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@0ne/db/server'
import {
  FUNNEL_STAGE_ORDER,
  STAGE_LABELS,
  STAGE_COLORS,
  type FunnelStage,
} from '@/features/kpi/lib/config'
import { sanitizeForPostgrestFilter } from '@/lib/postgrest-utils'

export const dynamic = 'force-dynamic'

// Contact type for stage-based queries
interface ContactAtStage {
  id: string
  name: string
  email: string
  source: string
  daysInStage: number
  enteredAt: string
}

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source') || null
    // Support multiple sources via comma-separated string (attribution sources from skool_members)
    const sourcesParam = searchParams.get('sources')
    const sources = sourcesParam ? sourcesParam.split(',').filter(Boolean) : []
    const campaign = searchParams.get('campaign') || null
    const stage = searchParams.get('stage') || null
    const contactsLimit = parseInt(searchParams.get('contactsLimit') || '50')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    // Date range filters
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const supabase = createServerClient()

    // If sources filter is provided, get matching skool_user_ids from skool_members
    let skoolUserIds: string[] | null = null
    if (sources.length > 0) {
      // Query skool_members to get user IDs with matching attribution sources
      // Note: 'unknown' source means attribution_source IS NULL
      const hasUnknown = sources.includes('unknown')
      const otherSources = sources.filter(s => s !== 'unknown')

      let skoolQuery = supabase
        .from('skool_members')
        .select('skool_user_id')

      const safeSources = otherSources.map(sanitizeForPostgrestFilter)
      if (hasUnknown && safeSources.length > 0) {
        // Both unknown (NULL) and specific sources
        skoolQuery = skoolQuery.or(`attribution_source.in.(${safeSources.join(',')}),attribution_source.is.null`)
      } else if (hasUnknown) {
        // Only unknown (NULL)
        skoolQuery = skoolQuery.is('attribution_source', null)
      } else {
        // Only specific sources
        skoolQuery = skoolQuery.in('attribution_source', safeSources)
      }

      const { data: skoolMembers } = await skoolQuery
      skoolUserIds = skoolMembers?.map(m => m.skool_user_id).filter(Boolean) || []
    }

    // Build contact query with filters
    let contactsQuery = supabase
      .from('contacts')
      .select('*', { count: 'exact' })

    // Apply source filter via skool_user_id join (new attribution-based filtering)
    if (skoolUserIds !== null) {
      if (skoolUserIds.length === 0) {
        // No matching skool members, return empty results
        return NextResponse.json({
          funnel: {
            stages: FUNNEL_STAGE_ORDER.map(stageId => ({
              id: stageId,
              name: STAGE_LABELS[stageId],
              count: 0,
              color: STAGE_COLORS[stageId],
              conversionRate: null,
            })),
            totalContacts: 0,
            overallConversion: 0,
          },
          contacts: [],
          pagination: { total: 0, limit, offset, hasMore: false },
          filters: { sources: [], campaigns: [], stages: FUNNEL_STAGE_ORDER.map(s => ({ id: s, name: STAGE_LABELS[s] })) },
          sourceFilteringNote: 'No contacts found matching the selected attribution sources.',
        })
      }
      contactsQuery = contactsQuery.in('skool_user_id', skoolUserIds)
    } else if (source) {
      // Legacy single source filter (deprecated, uses contacts.source)
      contactsQuery = contactsQuery.eq('source', source)
    }
    if (campaign) {
      contactsQuery = contactsQuery.eq('campaign', campaign)
    }
    if (stage) {
      contactsQuery = contactsQuery.eq('current_stage', stage)
    }
    // Apply date range filter
    if (startDate) {
      contactsQuery = contactsQuery.gte('created_at', startDate)
    }
    if (endDate) {
      contactsQuery = contactsQuery.lte('created_at', endDate + 'T23:59:59')
    }

    contactsQuery = contactsQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: contacts, count: totalContacts } = await contactsQuery

    // Get stage counts (without pagination)
    let stageCountsQuery = supabase
      .from('contacts')
      .select('current_stage')

    // Apply same source filter via skool_user_id
    if (skoolUserIds !== null && skoolUserIds.length > 0) {
      stageCountsQuery = stageCountsQuery.in('skool_user_id', skoolUserIds)
    } else if (source) {
      stageCountsQuery = stageCountsQuery.eq('source', source)
    }
    if (campaign) {
      stageCountsQuery = stageCountsQuery.eq('campaign', campaign)
    }
    // Apply date range to stage counts too
    if (startDate) {
      stageCountsQuery = stageCountsQuery.gte('created_at', startDate)
    }
    if (endDate) {
      stageCountsQuery = stageCountsQuery.lte('created_at', endDate + 'T23:59:59')
    }

    const { data: allContacts } = await stageCountsQuery

    // Calculate stage counts - initialize from FUNNEL_STAGE_ORDER
    const stageCounts: Record<FunnelStage, number> = Object.fromEntries(
      FUNNEL_STAGE_ORDER.map((stage) => [stage, 0])
    ) as Record<FunnelStage, number>

    allContacts?.forEach((contact) => {
      const contactStage = contact.current_stage as FunnelStage
      if (contactStage && stageCounts[contactStage] !== undefined) {
        stageCounts[contactStage]++
      }
    })

    // Build funnel stages with conversion rates
    const funnelStages = [...FUNNEL_STAGE_ORDER].reverse().map((stageId, index, arr) => {
      const count = stageCounts[stageId]
      const previousStageCount = index > 0 ? stageCounts[arr[index - 1]] : null
      const conversionRate = previousStageCount && previousStageCount > 0
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

    // Get source breakdown
    const { data: sourceBreakdown } = await supabase
      .from('contacts')
      .select('source')

    const sourceCountMap: Record<string, number> = {}
    sourceBreakdown?.forEach((c) => {
      const src = c.source || 'Unknown'
      sourceCountMap[src] = (sourceCountMap[src] || 0) + 1
    })

    const sourcesList = Object.entries(sourceCountMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // Get campaign breakdown
    const { data: campaignBreakdown } = await supabase
      .from('contacts')
      .select('campaign')
      .not('campaign', 'is', null)

    const campaignCountMap: Record<string, number> = {}
    campaignBreakdown?.forEach((c) => {
      if (c.campaign) {
        campaignCountMap[c.campaign] = (campaignCountMap[c.campaign] || 0) + 1
      }
    })

    const campaigns = Object.entries(campaignCountMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // Calculate overall conversion (member → client [vip + premium])
    const totalMembers = stageCounts.member
    const totalClients = stageCounts.vip + stageCounts.premium

    // Get contacts by stage if a specific stage is requested
    // Returns top N contacts at the specified stage with name, email, source, daysInStage
    let contactsByStage: ContactAtStage[] = []
    if (stage) {
      // First get contacts at the requested stage
      let stageContactsQuery = supabase
        .from('contacts')
        .select('id, skool_user_id, created_at, became_hand_raiser_at, became_qualified_at, became_client_at')
        .eq('current_stage', stage)
        .order('created_at', { ascending: false })
        .limit(contactsLimit)

      // Apply source filter if specified
      if (skoolUserIds !== null && skoolUserIds.length > 0) {
        stageContactsQuery = stageContactsQuery.in('skool_user_id', skoolUserIds)
      }

      const { data: stageContacts } = await stageContactsQuery

      if (stageContacts && stageContacts.length > 0) {
        // Get the skool user IDs to fetch member details
        const contactSkoolIds = stageContacts
          .map((c) => c.skool_user_id)
          .filter(Boolean) as string[]

        // Fetch member info from skool_members
        const { data: skoolMembers } = await supabase
          .from('skool_members')
          .select('skool_user_id, display_name, email, attribution_source')
          .in('skool_user_id', contactSkoolIds)

        // Create a map for quick lookup
        const memberMap = new Map(
          skoolMembers?.map((m) => [m.skool_user_id, m]) || []
        )

        // Build the response
        const now = new Date()
        contactsByStage = stageContacts.map((contact) => {
          const member = memberMap.get(contact.skool_user_id || '')

          // Determine when they entered this stage
          let enteredAt = contact.created_at
          if (stage === 'hand_raiser' && contact.became_hand_raiser_at) {
            enteredAt = contact.became_hand_raiser_at
          } else if (stage === 'qualified' && contact.became_qualified_at) {
            enteredAt = contact.became_qualified_at
          } else if ((stage === 'vip' || stage === 'premium') && contact.became_client_at) {
            enteredAt = contact.became_client_at
          }

          // Calculate days in stage
          const enteredDate = new Date(enteredAt)
          const daysInStage = Math.floor(
            (now.getTime() - enteredDate.getTime()) / (1000 * 60 * 60 * 24)
          )

          return {
            id: contact.id,
            name: member?.display_name || 'Unknown',
            email: member?.email || '',
            source: member?.attribution_source || 'Unknown',
            daysInStage,
            enteredAt: enteredDate.toISOString().split('T')[0],
          }
        })
      }
    }

    const response = {
      funnel: {
        stages: funnelStages,
        totalContacts: allContacts?.length || 0,
        overallConversion: totalMembers > 0
          ? Number(((totalClients / totalMembers) * 100).toFixed(2))
          : 0,
      },
      contacts: contacts?.map((c) => ({
        id: c.id,
        ghlContactId: c.ghl_contact_id,
        stage: c.current_stage,
        stageName: STAGE_LABELS[c.current_stage as FunnelStage] || c.current_stage,
        source: c.source || 'Unknown',
        campaign: c.campaign,
        creditStatus: c.credit_status,
        leadAge: c.lead_age,
        clientAge: c.client_age,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })) || [],
      pagination: {
        total: totalContacts || 0,
        limit,
        offset,
        hasMore: (totalContacts || 0) > offset + limit,
      },
      filters: {
        sources: sourcesList,
        campaigns,
        stages: FUNNEL_STAGE_ORDER.map((s) => ({
          id: s,
          name: STAGE_LABELS[s],
        })),
      },
      // Contacts at the specified stage (only returned if stage param is set)
      contactsByStage: stage ? contactsByStage : undefined,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('KPI Funnel error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch funnel data', details: String(error) },
      { status: 500 }
    )
  }
}
