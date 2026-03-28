import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const ACTIVE_STATUSES = ['active', 'trialing', 'comped']

const STATUS_MESSAGES: Record<string, { title: string; message: string }> = {
  canceled: {
    title: 'Your subscription has been canceled',
    message: 'Your 0ne Cloud access has been suspended. Reactivate to continue using your apps and data.',
  },
  past_due: {
    title: 'Payment past due',
    message: 'We couldn\'t process your last payment. Please update your payment method to restore access.',
  },
  paused: {
    title: 'Your subscription is paused',
    message: 'Your 0ne Cloud access is currently paused. Resume your subscription to continue.',
  },
}

/**
 * Standalone paywall page. Users are redirected here by middleware when their
 * subscription status is not active. Also accessible via direct URL.
 *
 * If the user's subscription IS active (e.g., they just reactivated), redirects home.
 */
export default async function SubscriptionRequiredPage() {
  const user = await currentUser()

  if (!user) {
    redirect('/sign-in')
  }

  const metadata = user.publicMetadata as {
    subscriptionStatus?: string
    role?: string
    permissions?: { isAdmin?: boolean }
  } | undefined

  // If subscription is actually active (or user is admin), redirect home
  const status = metadata?.subscriptionStatus
  const isAdmin = metadata?.role === 'admin' || metadata?.role === 'owner' || metadata?.permissions?.isAdmin
  const isActive = ACTIVE_STATUSES.includes(status || '')

  if (isActive || isAdmin) {
    redirect('/')
  }

  const { title, message } = STATUS_MESSAGES[status || ''] || {
    title: 'Subscription required',
    message: 'An active subscription is required to access 0ne Cloud.',
  }

  const skoolUrl = process.env.NEXT_PUBLIC_REACTIVATION_URL

  return (
    <div className="min-h-screen bg-[#F6F5F3] flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center">
        {/* Lock icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#FF692D]/10">
          <svg className="h-8 w-8 text-[#FF692D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-[#22201D] mb-3">{title}</h1>
        <p className="text-[#666] mb-8">{message}</p>

        {/* Reactivation options */}
        <div className="space-y-3 mb-8">
          {/* Skool — active */}
          {skoolUrl && (
            <a
              href={skoolUrl}
              className="flex items-center gap-3 w-full rounded-lg border-2 border-[#FF692D] bg-white px-5 py-4 text-left hover:bg-[#FF692D]/5 transition-colors"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#FF692D]/10">
                <svg className="h-5 w-5 text-[#FF692D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-[#22201D]">Reactivate via Skool</p>
                <p className="text-sm text-[#999]">Rejoin the community to restore access</p>
              </div>
              <svg className="h-5 w-5 text-[#999] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
          )}

          {/* Stripe — coming soon (grayed out) */}
          <div className="flex items-center gap-3 w-full rounded-lg border border-[#E5E3DF] bg-[#FAFAF9] px-5 py-4 text-left cursor-not-allowed opacity-50">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#E5E3DF]">
              <svg className="h-5 w-5 text-[#999]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[#999]">Pay with credit card</p>
              <p className="text-sm text-[#C4C2BE]">Direct billing — coming soon</p>
            </div>
          </div>
        </div>

        <p className="text-sm text-[#999]">
          Your data is safe and will be here when you come back.
        </p>

        <div className="mt-8">
          <Link href="/sign-in" className="text-sm text-[#999] hover:text-[#666] underline">
            Sign out
          </Link>
        </div>
      </div>
    </div>
  )
}
