import { NextResponse } from 'next/server'

/**
 * Validates the external API key from the X-API-Key header
 * Returns null if valid, or an error response if invalid
 */
export function validateExternalApiKey(request: Request): NextResponse | null {
  const apiKey = request.headers.get('x-api-key')
  const expectedKey = process.env.EXTERNAL_API_KEY

  if (!expectedKey) {
    console.error('[External API] EXTERNAL_API_KEY environment variable not set')
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    )
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing X-API-Key header' },
      { status: 401 }
    )
  }

  if (apiKey !== expectedKey) {
    return NextResponse.json(
      { error: 'Invalid API key' },
      { status: 401 }
    )
  }

  return null // Valid
}
