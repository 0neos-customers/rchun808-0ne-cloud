import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders, validateExtensionAuth } from '@/lib/extension-auth'

export { OPTIONS } from '@/lib/extension-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/extension/health
 * Health check endpoint for the Chrome extension
 * Supports both Clerk session and API key authentication
 */
export async function GET(request: NextRequest) {
  const authResult = await validateExtensionAuth(request)

  if (!authResult.valid) {
    return NextResponse.json(
      { error: authResult.error },
      { status: 401, headers: corsHeaders }
    )
  }

  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'skool-extension-api',
      authType: authResult.authType,
    },
    { headers: corsHeaders }
  )
}
