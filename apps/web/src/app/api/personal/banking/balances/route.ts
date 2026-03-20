import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@0ne/db/server'
import { getBalances } from '@/lib/plaid-client'
import { decryptAccessToken } from '@/lib/plaid-encryption'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const refresh = searchParams.get('refresh') === 'true'
    const scope = searchParams.get('scope') // 'personal', 'business', or null (all)

    const supabase = createServerClient()

    if (refresh) {
      // Live-fetch from Plaid and update cache
      const { data: items } = await supabase
        .from('plaid_items')
        .select('id, access_token')
        .eq('status', 'active')

      for (const item of items || []) {
        try {
          const accessToken = decryptAccessToken(item.access_token)
          const accounts = await getBalances(accessToken)

          for (const account of accounts) {
            await supabase
              .from('plaid_accounts')
              .update({
                current_balance: account.balances.current,
                available_balance: account.balances.available,
                credit_limit: account.balances.limit || null,
              })
              .eq('account_id', account.account_id)
          }
        } catch (error) {
          console.error(`Error refreshing balances for item ${item.id}:`, error)
        }
      }
    }

    // Return cached balances from DB
    let query = supabase
      .from('plaid_accounts')
      .select(`
        id,
        account_id,
        name,
        official_name,
        type,
        subtype,
        mask,
        current_balance,
        available_balance,
        credit_limit,
        iso_currency_code,
        is_hidden,
        scope,
        item_id,
        plaid_items(institution_name)
      `)
      .eq('is_hidden', false)

    // Filter by scope if specified
    if (scope === 'personal' || scope === 'business') {
      query = query.eq('scope', scope)
    }

    const { data: accounts, error } = await query.order('type')

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch balances', details: error.message },
        { status: 500 }
      )
    }

    // Calculate summary
    const depository = (accounts || []).filter((a) => a.type === 'depository')
    const credit = (accounts || []).filter((a) => a.type === 'credit')

    const totalAssets = depository.reduce((sum, a) => sum + (a.current_balance || 0), 0)
    const totalLiabilities = credit.reduce((sum, a) => sum + Math.abs(a.current_balance || 0), 0)
    const netWorth = totalAssets - totalLiabilities

    // Group by type
    const grouped = {
      checking: depository.filter((a) => a.subtype === 'checking'),
      savings: depository.filter((a) => a.subtype === 'savings'),
      credit: credit,
      other: (accounts || []).filter((a) => !['depository', 'credit'].includes(a.type)),
    }

    return NextResponse.json({
      accounts: accounts || [],
      grouped,
      summary: {
        totalAssets,
        totalLiabilities,
        netWorth,
        totalChecking: grouped.checking.reduce((sum, a) => sum + (a.available_balance ?? a.current_balance ?? 0), 0),
        totalSavings: grouped.savings.reduce((sum, a) => sum + (a.available_balance ?? a.current_balance ?? 0), 0),
      },
    })
  } catch (error) {
    console.error('Balances GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch balances', details: String(error) },
      { status: 500 }
    )
  }
}
