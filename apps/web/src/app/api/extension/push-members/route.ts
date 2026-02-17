import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@0ne/db/server'
import { corsHeaders, validateExtensionAuth } from '@/lib/extension-auth'

export { OPTIONS } from '@/lib/extension-auth'

export const dynamic = 'force-dynamic'

/**
 * Chrome Extension Push Members API
 *
 * Receives member data from the Skool Chrome extension
 * and stores them in the skool_members table.
 */

// =============================================
// Types
// =============================================

interface IncomingMember {
  skoolUserId: string
  name?: string
  email?: string
  avatarUrl?: string
  level?: number
  points?: number
  joinedAt?: string | null
  lastSeenAt?: string | null
  // Additional fields from Phase 6 full member sync
  username?: string
  bio?: string
  location?: string
  role?: string                                       // 'admin', 'moderator', 'member'
  questionsAndAnswers?: Record<string, string>[] | null  // Survey/question answers on join
}

interface PushMembersRequest {
  staffSkoolId: string
  groupId: string
  members: IncomingMember[]
}

interface PushMembersResponse {
  success: boolean
  upserted: number
  errors?: string[]
}

// =============================================
// POST /api/extension/push-members
// =============================================

export async function POST(request: NextRequest) {
  // Validate auth (supports both Clerk and API key)
  const authResult = await validateExtensionAuth(request)
  if (!authResult.valid) {
    return NextResponse.json(
      { error: authResult.error },
      { status: 401, headers: corsHeaders }
    )
  }

  try {
    const body: PushMembersRequest = await request.json()

    // If using Clerk auth and staffSkoolId not provided, use linked Skool ID
    if (authResult.authType === 'clerk' && !body.staffSkoolId && authResult.skoolUserId) {
      body.staffSkoolId = authResult.skoolUserId
    }

    // Validate request structure
    const validationError = validateRequest(body)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400, headers: corsHeaders })
    }

    const { staffSkoolId, groupId, members } = body

    console.log(
      `[Extension API] Received ${members.length} members for group ${groupId}`
    )

    const supabase = createServerClient()
    let upserted = 0
    const errors: string[] = []

    // Upsert members in batches
    for (const member of members) {
      try {
        const memberRow: Record<string, unknown> = {
          group_slug: groupId,
          skool_user_id: member.skoolUserId,
          display_name: member.name || null,
          email: member.email || null,
          profile_image: member.avatarUrl || null,
          level: member.level ?? null,
          points: member.points ?? null,
          member_since: member.joinedAt || null,
          last_online: member.lastSeenAt || null,
        }

        // Add additional fields if present (Phase 6)
        if (member.username) memberRow.skool_username = member.username
        if (member.bio) memberRow.bio = member.bio
        if (member.location) memberRow.location = member.location
        if (member.role) memberRow.role = member.role

        const { error } = await supabase
          .from('skool_members')
          .upsert(memberRow, {
            onConflict: 'skool_user_id',
          })

        if (error) {
          console.error(`[Extension API] Error upserting member ${member.skoolUserId}:`, error)
          errors.push(`Member ${member.skoolUserId}: ${error.message}`)
        } else {
          upserted++
        }
      } catch (memberError) {
        console.error(`[Extension API] Exception processing member ${member.skoolUserId}:`, memberError)
        errors.push(
          `Member ${member.skoolUserId}: ${memberError instanceof Error ? memberError.message : 'Unknown error'}`
        )
      }
    }

    console.log(
      `[Extension API] Members complete: upserted=${upserted}, errors=${errors.length}`
    )

    const response: PushMembersResponse = {
      success: errors.length === 0,
      upserted,
      ...(errors.length > 0 && { errors }),
    }

    return NextResponse.json(response, { headers: corsHeaders })
  } catch (error) {
    console.error('[Extension API] POST exception:', error)
    return NextResponse.json(
      {
        success: false,
        upserted: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      } as PushMembersResponse,
      { status: 500, headers: corsHeaders }
    )
  }
}

// =============================================
// Validation
// =============================================

function validateRequest(body: PushMembersRequest): string | null {
  if (!body.staffSkoolId?.trim()) {
    return 'Missing required field: staffSkoolId'
  }

  if (!body.groupId?.trim()) {
    return 'Missing required field: groupId'
  }

  if (!Array.isArray(body.members)) {
    return 'members must be an array'
  }

  if (body.members.length === 0) {
    return 'members array cannot be empty'
  }

  // Validate each member
  for (let i = 0; i < body.members.length; i++) {
    const member = body.members[i]
    if (!member.skoolUserId?.trim()) {
      return `Member at index ${i}: missing required field "skoolUserId"`
    }
  }

  return null
}
