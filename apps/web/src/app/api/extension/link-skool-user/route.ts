import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { corsHeaders } from '@/lib/extension-auth'

export { OPTIONS } from '@/lib/extension-auth'

export const dynamic = 'force-dynamic'

interface LinkSkoolUserRequest {
  skoolUserId: string
}

/**
 * POST /api/extension/link-skool-user
 * Links a Skool user ID to the current Clerk user
 * Called by the Chrome extension when it detects the logged-in Skool user
 */
export async function POST(request: NextRequest) {
  try {
    // Get the auth info from Clerk
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated', success: false },
        { status: 401, headers: corsHeaders }
      )
    }

    // Parse request body
    const body: LinkSkoolUserRequest = await request.json()

    if (!body.skoolUserId?.trim()) {
      return NextResponse.json(
        { error: 'Missing skoolUserId', success: false },
        { status: 400, headers: corsHeaders }
      )
    }

    const skoolUserId = body.skoolUserId.trim()

    // Update the user's public metadata with the Skool user ID
    const client = await clerkClient()
    const user = await client.users.getUser(userId)

    // Merge with existing metadata
    const existingMetadata = user.publicMetadata || {}
    const updatedMetadata = {
      ...existingMetadata,
      skoolUserId,
      skoolUserIdLinkedAt: new Date().toISOString(),
    }

    await client.users.updateUserMetadata(userId, {
      publicMetadata: updatedMetadata,
    })

    console.log(`[Extension Link Skool] Linked Skool user ${skoolUserId} to Clerk user ${userId}`)

    return NextResponse.json(
      {
        success: true,
        userId,
        skoolUserId,
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('[Extension Link Skool] Error:', error)
    return NextResponse.json(
      { error: 'Failed to link Skool user', success: false },
      { status: 500, headers: corsHeaders }
    )
  }
}
