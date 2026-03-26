/**
 * GHL Inbound Webhook Handler
 *
 * This endpoint receives inbound notifications from GHL. For the Skool sync,
 * we primarily push messages TO GHL (from Skool), so this is mainly a health
 * check / ping endpoint. GHL may call this to verify the webhook is active.
 *
 * Note: Actual inbound message handling for the "Skool" channel isn't needed
 * because GHL sends outbound messages via the outbound-message webhook when
 * a user replies in the GHL inbox.
 *
 * @module api/webhooks/ghl/inbound
 */

import { NextResponse } from 'next/server'
import { secureCompare } from '@/lib/security'

/**
 * POST /api/webhooks/ghl/inbound
 *
 * Handles inbound webhook pings from GHL.
 * Returns 200 OK to acknowledge receipt.
 */
export async function POST(request: Request) {
  // Shared secret auth (graceful: only enforced when GHL_WEBHOOK_SECRET is set)
  const webhookSecret = process.env.GHL_WEBHOOK_SECRET
  const incomingSecret = request.headers.get('x-webhook-secret')
  if (webhookSecret && (!incomingSecret || !secureCompare(incomingSecret, webhookSecret))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Log the incoming request for debugging
    const body = await request.text()

    if (body) {
      console.log('[GHL Inbound Webhook] Received payload:', {
        contentLength: body.length,
        // Log first 200 chars to avoid flooding logs
        preview: body.substring(0, 200),
      })
    } else {
      console.log('[GHL Inbound Webhook] Received empty/ping request')
    }

    // Acknowledge the webhook
    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('[GHL Inbound Webhook] Error processing request:', error)

    // Still return 200 to avoid GHL retrying
    // (we don't want failed parsing to cause a retry loop)
    return NextResponse.json({ received: true, error: 'parse_error' }, { status: 200 })
  }
}

/**
 * GET /api/webhooks/ghl/inbound
 *
 * Health check endpoint. GHL may ping this to verify the webhook is reachable.
 */
export async function GET() {
  return new Response('GHL Inbound Webhook Active', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  })
}
