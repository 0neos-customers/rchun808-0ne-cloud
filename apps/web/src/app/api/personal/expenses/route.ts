import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@0ne/db/server'

export const dynamic = 'force-dynamic'

interface DateRangeResult {
  startDate: string
  endDate: string
}

function getDateRangeFromPeriod(period: string): DateRangeResult {
  const now = new Date()
  const endDate = now.toISOString().split('T')[0]
  let startDate: Date

  switch (period) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      break
    case 'mtd': {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    }
    case 'lastMonth': {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      return {
        startDate: lastMonth.toISOString().split('T')[0],
        endDate: new Date(thisMonth.getTime() - 1).toISOString().split('T')[0],
      }
    }
    case 'ytd':
      startDate = new Date(now.getFullYear(), 0, 1)
      break
    case 'lifetime':
      startDate = new Date('2020-01-01')
      break
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate,
  }
}

/**
 * Parse date range from request params
 * Priority: explicit startDate/endDate > period preset
 */
function parseDateRange(searchParams: URLSearchParams): DateRangeResult {
  const startDateParam = searchParams.get('startDate')
  const endDateParam = searchParams.get('endDate')

  // If explicit dates provided, use them
  if (startDateParam && endDateParam) {
    return { startDate: startDateParam, endDate: endDateParam }
  }

  // Fall back to period preset
  const period = searchParams.get('period') || 'mtd'
  return getDateRangeFromPeriod(period)
}

function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

/**
 * GET /api/personal/expenses
 * Fetch personal expenses with summary, category breakdown, and monthly trends
 */
export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || null

    // Parse date range from explicit params or period preset
    const { startDate, endDate } = parseDateRange(searchParams)
    const previousPeriodLength = new Date(endDate).getTime() - new Date(startDate).getTime()
    const previousStartDate = new Date(new Date(startDate).getTime() - previousPeriodLength)
      .toISOString()
      .split('T')[0]

    const supabase = createServerClient()

    // Build queries
    const categoriesQuery = supabase
      .from('personal_expense_categories')
      .select('id, name, slug, color')

    let currentQuery = supabase
      .from('personal_expenses')
      .select('id, name, category, amount, frequency, expense_date, is_active, notes')
      .gte('expense_date', startDate)
      .lte('expense_date', endDate)

    if (category) {
      currentQuery = currentQuery.eq('category', category)
    }

    let prevQuery = supabase
      .from('personal_expenses')
      .select('category, amount')
      .gte('expense_date', previousStartDate)
      .lt('expense_date', startDate)

    if (category) {
      prevQuery = prevQuery.eq('category', category)
    }

    const activeCountQuery = supabase
      .from('personal_expenses')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)

    // Run all 4 queries in parallel
    const [
      { data: expenseCategories },
      { data: currentExpenses },
      { data: previousExpenses },
      { count: activeExpenseCount },
    ] = await Promise.all([categoriesQuery, currentQuery, prevQuery, activeCountQuery])

    // Build lookup map: lowercase category -> canonical display info
    const categoryCanonical = new Map<string, { id: string; name: string; color: string }>()
    expenseCategories?.forEach((cat) => {
      categoryCanonical.set(cat.name.toLowerCase(), {
        id: cat.id,
        name: cat.name,
        color: cat.color || '#6b7280',
      })
    })

    // Group expenses by category
    const categoryMap = new Map<string, { current: number; previous: number; displayName: string; color: string; categoryId: string }>()

    const getCategoryKey = (cat: string) => cat.toLowerCase()
    const getCanonicalInfo = (catKey: string) => {
      const canonical = categoryCanonical.get(catKey)
      return canonical || {
        id: catKey.replace(/\s+/g, '_'),
        name: catKey.charAt(0).toUpperCase() + catKey.slice(1),
        color: '#6b7280',
      }
    }

    currentExpenses?.forEach((exp) => {
      const rawCat = exp.category || 'Other'
      const catKey = getCategoryKey(rawCat)
      if (!categoryMap.has(catKey)) {
        const canonical = getCanonicalInfo(catKey)
        categoryMap.set(catKey, {
          current: 0,
          previous: 0,
          displayName: canonical.name,
          color: canonical.color,
          categoryId: canonical.id,
        })
      }
      const entry = categoryMap.get(catKey)!
      entry.current += Number(exp.amount) || 0
    })

    previousExpenses?.forEach((exp) => {
      const rawCat = exp.category || 'Other'
      const catKey = getCategoryKey(rawCat)
      if (!categoryMap.has(catKey)) {
        const canonical = getCanonicalInfo(catKey)
        categoryMap.set(catKey, {
          current: 0,
          previous: 0,
          displayName: canonical.name,
          color: canonical.color,
          categoryId: canonical.id,
        })
      }
      const entry = categoryMap.get(catKey)!
      entry.previous += Number(exp.amount) || 0
    })

    const categories = Array.from(categoryMap.entries()).map(([_key, data]) => ({
      id: data.categoryId,
      name: data.displayName,
      amount: data.current,
      change: Number(calculateChange(data.current, data.previous).toFixed(1)),
      trend: (data.current > data.previous ? 'up' : data.current < data.previous ? 'down' : 'neutral') as 'up' | 'down' | 'neutral',
      color: data.color,
    })).sort((a, b) => b.amount - a.amount)

    // Monthly trends — group by YYYY-MM with per-category breakdown
    const monthlyMap = new Map<string, { total: number; byCategory: Record<string, number> }>()

    currentExpenses?.forEach((exp) => {
      const month = exp.expense_date.substring(0, 7) // YYYY-MM
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { total: 0, byCategory: {} })
      }
      const entry = monthlyMap.get(month)!
      const amount = Number(exp.amount) || 0
      entry.total += amount

      const catName = getCanonicalInfo(getCategoryKey(exp.category || 'Other')).name
      entry.byCategory[catName] = (entry.byCategory[catName] || 0) + amount
    })

    const monthly = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({ month, total: data.total, byCategory: data.byCategory }))
      .sort((a, b) => a.month.localeCompare(b.month))

    // Calculate summary
    const totalExpenses = categories.reduce((sum, c) => sum + c.amount, 0)
    const monthCount = Math.max(monthly.length, 1)
    const monthlyBurnRate = Number((totalExpenses / monthCount).toFixed(2))

    // Format individual expenses for the list
    const expenses = (currentExpenses || []).map((exp) => {
      const catKey = (exp.category || 'other').toLowerCase()
      const canonical = getCanonicalInfo(catKey)
      return {
        id: exp.id,
        name: exp.name || 'Unnamed',
        category: canonical.name,
        amount: Number(exp.amount) || 0,
        frequency: exp.frequency || 'one_time',
        isActive: exp.is_active !== false,
        expenseDate: exp.expense_date,
        notes: exp.notes || null,
      }
    })

    const response = {
      summary: {
        totalExpenses,
        monthlyBurnRate,
        categoryCount: categories.length,
        activeExpenses: activeExpenseCount || 0,
      },
      categories,
      monthly,
      expenses,
      period: {
        startDate,
        endDate,
        label: searchParams.get('period') || 'custom',
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Personal Expenses GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch personal expense data', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/personal/expenses
 * Create a new personal expense
 */
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { description, amount, category, expense_date, frequency, notes } = body

    // Validate required fields
    if (!description || !amount || !category || !expense_date) {
      return NextResponse.json(
        { error: 'Missing required fields: description, amount, category, expense_date' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('personal_expenses')
      .insert({
        name: description, // Map description to name column
        amount: Number(amount),
        category,
        expense_date,
        frequency: frequency || 'one_time',
        is_active: true,
        notes: notes || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Insert personal expense error:', error)
      return NextResponse.json(
        { error: 'Failed to add expense', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, expense: data })
  } catch (error) {
    console.error('Add personal expense error:', error)
    return NextResponse.json(
      { error: 'Failed to add expense', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/personal/expenses
 * Update an existing personal expense
 */
export async function PUT(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, description, amount, category, frequency, expense_date, notes } = body

    // Validate required fields
    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      )
    }

    if (!description || !amount || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: description, amount, category' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      name: description, // Map description to name column
      amount: Number(amount),
      category,
    }

    if (frequency) {
      updateData.frequency = frequency
    }
    if (expense_date) {
      updateData.expense_date = expense_date
    }
    if (notes !== undefined) {
      updateData.notes = notes || null
    }

    // Update the expense directly — check result instead of pre-fetching
    const { data, error } = await supabase
      .from('personal_expenses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error || !data) {
      const status = error?.code === 'PGRST116' ? 404 : 500
      return NextResponse.json(
        { error: status === 404 ? 'Expense not found' : 'Failed to update expense', details: error?.message },
        { status }
      )
    }

    return NextResponse.json({ success: true, expense: data })
  } catch (error) {
    console.error('Update personal expense error:', error)
    return NextResponse.json(
      { error: 'Failed to update expense', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/personal/expenses
 * Toggle active status on a personal expense
 */
export async function PATCH(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, is_active } = body

    // Validate required fields
    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      )
    }

    if (typeof is_active !== 'boolean') {
      return NextResponse.json(
        { error: 'is_active must be a boolean' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Update directly — check result instead of pre-fetching
    const { data, error } = await supabase
      .from('personal_expenses')
      .update({ is_active })
      .eq('id', id)
      .select()
      .single()

    if (error || !data) {
      const status = error?.code === 'PGRST116' ? 404 : 500
      return NextResponse.json(
        { error: status === 404 ? 'Expense not found' : 'Failed to update expense', details: error?.message },
        { status }
      )
    }

    return NextResponse.json({ success: true, expense: data })
  } catch (error) {
    console.error('Patch personal expense error:', error)
    return NextResponse.json(
      { error: 'Failed to update expense', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/personal/expenses
 * Delete a personal expense by ID
 */
export async function DELETE(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required query parameter: id' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Delete directly — check result
    const { data, error } = await supabase
      .from('personal_expenses')
      .delete()
      .eq('id', id)
      .select('id')
      .single()

    if (error || !data) {
      const status = error?.code === 'PGRST116' ? 404 : 500
      return NextResponse.json(
        { error: status === 404 ? 'Expense not found' : 'Failed to delete expense', details: error?.message },
        { status }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete personal expense error:', error)
    return NextResponse.json(
      { error: 'Failed to delete expense', details: String(error) },
      { status: 500 }
    )
  }
}
