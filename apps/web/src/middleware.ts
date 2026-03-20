import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessApp, type AppId } from '@0ne/auth/permissions'

// Redirect root domain to app subdomain (temporary until marketing site exists)
function handleDomainRedirect(request: NextRequest): NextResponse | null {
  const hostname = request.headers.get('host') || ''

  // Redirect project0ne.ai (not app.project0ne.ai) to app subdomain
  if (hostname === 'project0ne.ai' || hostname === 'www.project0ne.ai') {
    const url = request.nextUrl.clone()
    url.host = 'app.project0ne.ai'
    return NextResponse.redirect(url, 307)
  }

  return null
}

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/embed(.*)',
  '/privacy',
  '/security-policy',
  '/access-control',
  '/api/public(.*)',
  '/api/cron(.*)',
  '/api/external(.*)', // External API uses API key auth
  '/api/extension(.*)', // Chrome extension uses API key auth
  '/api/auth(.*)', // OAuth callbacks
  '/api/webhooks(.*)', // Webhooks from external services
  '/api/widget(.*)', // Widget API uses its own token auth
])

const appRoutes: Record<string, AppId> = {
  '/kpi': 'kpi',
  '/prospector': 'prospector',
  '/skool-sync': 'skoolSync',
  '/skool': 'skoolScheduler',
  '/media': 'ghlMedia',
}

export default clerkMiddleware(async (auth, request) => {
  // Handle domain redirect before anything else
  const domainRedirect = handleDomainRedirect(request)
  if (domainRedirect) return domainRedirect

  const { pathname } = request.nextUrl

  if (isPublicRoute(request)) {
    return NextResponse.next()
  }

  const { userId } = await auth.protect()

  for (const [route, appId] of Object.entries(appRoutes)) {
    if (pathname.startsWith(route)) {
      const hasAccess = await canAccessApp(userId, appId)
      if (!hasAccess) {
        return NextResponse.redirect(new URL('/unauthorized', request.url))
      }
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
