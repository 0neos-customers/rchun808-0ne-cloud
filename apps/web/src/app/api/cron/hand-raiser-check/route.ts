/**
 * Hand-Raiser Check Cron Endpoint — NO-OP
 *
 * Previously: Server-side cron that fetched Skool post comments via cookies
 * and processed hand-raiser campaigns (GHL tagging + DM queuing).
 *
 * Now: This cron is a NO-OP. Hand-raiser processing has been migrated to the
 * Chrome extension (Phase 2 of Extension-First Architecture).
 *
 * The extension now:
 * 1. Fetches active campaigns via GET /api/extension/get-hand-raiser-campaigns
 * 2. Scrapes post comments from Skool (browser context, same IP/cookies)
 * 3. Pushes commenters via POST /api/extension/push-hand-raiser-commenters
 *
 * The server endpoints handle GHL tagging, dedup, and DM queuing — but Skool
 * API calls happen exclusively in the extension to avoid AWS WAF cookie/IP blocks.
 *
 * Manual invocation still works (returns success with no-op message):
 * curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/hand-raiser-check"
 */

import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 10 // Minimal — this is a no-op

/**
 * GET /api/cron/hand-raiser-check
 *
 * No-op: Hand-raiser processing has moved to the Chrome extension.
 * See: /api/extension/get-hand-raiser-campaigns
 * See: /api/extension/push-hand-raiser-commenters
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (keep auth so Vercel cron doesn't report failures)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log(
    '[hand-raiser-check] NO-OP: Hand-raiser processing has been migrated to the Chrome extension. ' +
    'See /api/extension/get-hand-raiser-campaigns and /api/extension/push-hand-raiser-commenters.'
  )

  return NextResponse.json({
    success: true,
    message:
      'Hand-raiser processing has been migrated to the Chrome extension (Phase 2). ' +
      'This cron endpoint is now a no-op. ' +
      'The extension fetches campaigns, scrapes comments, and pushes them to /api/extension/push-hand-raiser-commenters.',
    migrated: true,
    replacedBy: [
      'GET /api/extension/get-hand-raiser-campaigns',
      'POST /api/extension/push-hand-raiser-commenters',
    ],
  })
}
