import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@0ne/db/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServerClient()

    // Get all items with their accounts
    const { data: items, error: itemsError } = await supabase
      .from('plaid_items')
      .select(`
        id,
        item_id,
        institution_id,
        institution_name,
        status,
        error_code,
        last_synced_at,
        created_at
      `)
      .order('created_at', { ascending: false })

    if (itemsError) {
      console.error('Fetch plaid items error:', itemsError)
      return NextResponse.json(
        { error: 'Failed to fetch accounts', details: itemsError.message },
        { status: 500 }
      )
    }

    // Get accounts for all items
    const itemIds = (items || []).map((item) => item.id)

    let accounts: any[] = []
    if (itemIds.length > 0) {
      const { data: accountData, error: accountsError } = await supabase
        .from('plaid_accounts')
        .select('*')
        .in('item_id', itemIds)
        .order('type')

      if (accountsError) {
        console.error('Fetch plaid accounts error:', accountsError)
      } else {
        accounts = accountData || []
      }
    }

    // Group accounts by item
    const result = (items || []).map((item) => ({
      ...item,
      accounts: accounts.filter((a) => a.item_id === item.id),
    }))

    return NextResponse.json({ items: result })
  } catch (error) {
    console.error('Plaid accounts GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch accounts', details: String(error) },
      { status: 500 }
    )
  }
}
