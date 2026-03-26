/**
 * GHL OAuth Callback
 *
 * Handles the OAuth callback from GHL Marketplace app installation.
 * Exchanges authorization code for access + refresh tokens.
 *
 * Flow:
 * 1. User installs app in GHL Marketplace
 * 2. GHL redirects to this callback with ?code=xxx
 * 3. We exchange code for tokens
 * 4. Display tokens for manual env setup (or store in DB for multi-tenant)
 */

import { NextResponse } from 'next/server'
import { safeErrorResponse } from '@/lib/security'

const GHL_OAUTH_URL = 'https://services.leadconnectorhq.com/oauth/token'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  // Handle OAuth errors
  if (error) {
    return NextResponse.json(
      { error, description: searchParams.get('error_description') },
      { status: 400 }
    )
  }

  // Require authorization code
  if (!code) {
    // If no code, show instructions to start OAuth flow
    const clientId = process.env.GHL_MARKETPLACE_CLIENT_ID
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/marketplace/callback`

    const authUrl = `https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${clientId}&scope=conversations.readonly%20conversations.write%20conversations/message.readonly%20conversations/message.write%20contacts.readonly%20contacts.write`

    return new Response(`
<!DOCTYPE html>
<html>
<head>
  <title>GHL OAuth Setup</title>
  <style>
    body { font-family: system-ui; max-width: 600px; margin: 40px auto; padding: 20px; }
    h1 { color: #333; }
    a { color: #FF692D; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; }
    pre { background: #f5f5f5; padding: 16px; border-radius: 8px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>GHL Marketplace OAuth Setup</h1>
  <p>Click the button below to authorize the app and get your OAuth tokens:</p>
  <p><a href="${escapeHtml(authUrl)}" style="display: inline-block; background: #FF692D; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Authorize with GHL</a></p>
  <h2>After Authorization</h2>
  <p>You'll be redirected back here with your tokens. Copy them to your <code>.env.local</code> file.</p>
</body>
</html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    })
  }

  // Exchange code for tokens
  try {
    const clientId = process.env.GHL_MARKETPLACE_CLIENT_ID!
    const clientSecret = process.env.GHL_MARKETPLACE_CLIENT_SECRET!

    // Log for debugging (will show in Vercel logs)
    console.log('[OAuth] Exchanging code for tokens', {
      hasClientId: !!clientId,
      clientIdLength: clientId?.length,
      hasClientSecret: !!clientSecret,
      code: code?.substring(0, 10) + '...',
    })

    // GHL OAuth requires form-urlencoded (confirmed by their error message)
    // Trim values to ensure no whitespace issues
    const response = await fetch(GHL_OAUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        grant_type: 'authorization_code',
        code: code.trim(),
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/marketplace/callback`,
        user_type: 'Location',
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return new Response(`
<!DOCTYPE html>
<html>
<head>
  <title>OAuth Error</title>
  <style>
    body { font-family: system-ui; max-width: 600px; margin: 40px auto; padding: 20px; }
    .error { background: #fee; border: 1px solid #fcc; padding: 16px; border-radius: 8px; }
    pre { background: #f5f5f5; padding: 16px; border-radius: 8px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>OAuth Error</h1>
  <div class="error">
    <p><strong>Error:</strong> ${escapeHtml(String(data.error || 'Unknown error'))}</p>
    <p>${escapeHtml(String(data.error_description || ''))}</p>
  </div>
  <h3>Full Response</h3>
  <pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>
</body>
</html>
      `, {
        status: 400,
        headers: { 'Content-Type': 'text/html' }
      })
    }

    // Log tokens server-side (check Vercel logs or terminal output)
    console.log('[OAuth] Tokens obtained successfully:', {
      locationId: data.locationId,
      userId: data.userId,
      accessToken: data.access_token ? `${data.access_token.slice(0, 8)}...` : 'none',
      refreshToken: data.refresh_token ? `${data.refresh_token.slice(0, 8)}...` : 'none',
      expiresIn: data.expires_in,
    })

    // Success - tokens logged server-side only, NOT rendered in HTML
    return new Response(`
<!DOCTYPE html>
<html>
<head>
  <title>OAuth Success</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { color: #22c55e; }
    .success { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px; margin-bottom: 20px; }
    .info { background: #eff6ff; border: 1px solid #bfdbfe; padding: 16px; border-radius: 8px; margin-bottom: 20px; }
    .warning { background: #fef3c7; border: 1px solid #fcd34d; padding: 12px; border-radius: 6px; margin-top: 16px; }
  </style>
</head>
<body>
  <h1>OAuth Authorization Successful!</h1>
  <div class="success">
    <p><strong>Location ID:</strong> ${escapeHtml(String(data.locationId || 'N/A'))}</p>
    <p><strong>User ID:</strong> ${escapeHtml(String(data.userId || 'N/A'))}</p>
    <p><strong>Scopes:</strong> ${escapeHtml(String(data.scope || 'N/A'))}</p>
  </div>

  <div class="info">
    <p><strong>Tokens have been logged to the server console.</strong></p>
    <p>Check Vercel logs or terminal output to retrieve your access and refresh tokens.</p>
  </div>

  <div class="warning">
    <strong>Important:</strong>
    <ul>
      <li>Add tokens from server logs to <code>.env.local</code> AND Vercel environment variables</li>
      <li>The refresh token is permanent - guard it carefully</li>
      <li>After adding, run: <code>bun run scripts/register-ghl-provider.ts</code></li>
    </ul>
  </div>
</body>
</html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    })

  } catch (error) {
    console.error('OAuth error:', error)
    return safeErrorResponse('Token exchange failed', error)
  }
}
