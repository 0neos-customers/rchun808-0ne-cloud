'use client'

import { useState, useMemo } from 'react'
import { startOfMonth } from 'date-fns'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Switch,
  cn,
  toast,
} from '@0ne/ui'
import { AppShell } from '@/components/shell'
import { FilterBar } from '@/features/kpi/components/FilterBar'
import { DataTable, type Column } from '@/features/kpi/components/DataTable'
import { MetricCard } from '@/features/kpi/components/MetricCard'
import { TrendChart } from '@/features/kpi/charts/TrendChart'
import { ExpenseDialog, type ExpenseFormData } from '@/features/personal/components/ExpenseDialog'
import { CategoryDialog } from '@/features/personal/components/CategoryDialog'
import {
  usePersonalExpenses,
  addPersonalExpense,
  updatePersonalExpense,
  deletePersonalExpense,
  togglePersonalExpense,
  type PersonalExpenseItem,
} from '@/features/personal/hooks/use-personal-expenses'
import {
  usePersonalExpenseCategories,
  createPersonalCategory,
  updatePersonalCategory,
  deletePersonalCategory,
  type PersonalExpenseCategoryData,
} from '@/features/personal/hooks/use-personal-expense-categories'
import {
  Plus,
  DollarSign,
  TrendingUp,
  Wallet,
  Tag,
  Pencil,
  Trash2,
  Loader2,
  Palette,
  Receipt,
} from 'lucide-react'

// Helper to generate light background from hex color
function hexToLightBg(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, 0.15)`
}

const createExpenseColumns = (
  onToggleActive: (id: string, isActive: boolean) => void,
  onEdit: (expense: PersonalExpenseItem) => void,
  onDelete: (id: string) => void,
  togglingIds: Set<string>,
  categoryColorMap: Record<string, string>
): Column<PersonalExpenseItem>[] => [
  {
    key: 'name',
    header: 'Name',
    render: (value) => (
      <span className="font-medium">{value as string}</span>
    ),
  },
  {
    key: 'category',
    header: 'Category',
    render: (value) => {
      const categoryName = value as string
      const color = categoryColorMap[categoryName.toLowerCase()] || '#6b7280'
      return (
        <span
          className="inline-flex rounded-full px-2 py-1 text-xs font-medium"
          style={{
            backgroundColor: hexToLightBg(color),
            color: color,
          }}
        >
          {categoryName}
        </span>
      )
    },
  },
  {
    key: 'amount',
    header: 'Amount',
    align: 'right' as const,
    render: (value) => `$${(value as number).toLocaleString()}`,
  },
  {
    key: 'frequency',
    header: 'Frequency',
    render: (value) => (
      <span className="capitalize">{(value as string).replace('_', ' ')}</span>
    ),
  },
  {
    key: 'isActive',
    header: 'Active',
    align: 'center' as const,
    sortable: false,
    render: (value, row) => {
      const isToggling = togglingIds.has(row.id)
      return (
        <div className="flex justify-center">
          <Switch
            checked={value as boolean}
            disabled={isToggling}
            onCheckedChange={(checked) => {
              onToggleActive(row.id, checked)
            }}
            title={value ? 'Click to deactivate' : 'Click to activate'}
          />
        </div>
      )
    },
  },
  {
    key: 'actions',
    header: '',
    align: 'right' as const,
    sortable: false,
    render: (_, row) => (
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onEdit(row)
          }}
          title="Edit expense"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(row.id)
          }}
          className="text-red-500 hover:text-red-700 hover:bg-red-50"
          title="Delete expense"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    ),
  },
]

export default function PersonalExpensesPage() {
  // Local filter state (separate from KPI filters)
  const [period, setPeriod] = useState('mtd')
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: new Date(),
  })

  // Fetch personal expenses data from API
  const { data: expensesData, isLoading: isExpensesLoading, refetch } = usePersonalExpenses({
    dateRange,
    period,
  })

  // Fetch personal expense categories
  const {
    categories: expenseCategoryList,
    isLoading: isCategoriesLoading,
    refetch: refetchCategories,
  } = usePersonalExpenseCategories()

  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseFormData | null>(null)
  const [isSavingExpense, setIsSavingExpense] = useState(false)
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<PersonalExpenseCategoryData | null>(null)
  const [isSavingCategory, setIsSavingCategory] = useState(false)
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())

  // Use expenses from API, fallback to empty array
  const expenses: PersonalExpenseItem[] = expensesData?.expenses || []

  // Handle saving expense (add or edit)
  const handleSaveExpense = async (formData: ExpenseFormData) => {
    setIsSavingExpense(true)
    try {
      const category = formData.category === 'other' ? formData.customCategory || '' : formData.category
      const isEdit = !!formData.id

      if (isEdit) {
        const result = await updatePersonalExpense({
          id: formData.id!,
          description: formData.name,
          amount: parseFloat(formData.amount),
          category,
          frequency: formData.frequency,
          notes: formData.notes,
        })

        if (result.success) {
          refetch()
        } else {
          throw new Error(result.error || 'Failed to update expense')
        }
      } else {
        // Add new expense - use local date (not UTC) to avoid timezone issues
        const today = new Date()
        const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        const result = await addPersonalExpense({
          description: formData.name,
          amount: parseFloat(formData.amount),
          category,
          expense_date: localDate,
          frequency: formData.frequency,
          notes: formData.notes,
        })

        if (result.success) {
          refetch()
        } else {
          throw new Error(result.error || 'Failed to add expense')
        }
      }

      setIsExpenseDialogOpen(false)
      setEditingExpense(null)
      toast.success(isEdit ? 'Expense updated successfully' : 'Expense added successfully')
    } catch (error) {
      console.error('Error saving expense:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save expense')
    } finally {
      setIsSavingExpense(false)
    }
  }

  // Open dialog to add new expense
  const handleAddExpense = () => {
    setEditingExpense(null)
    setIsExpenseDialogOpen(true)
  }

  // Open dialog to edit existing expense
  const handleEditExpense = (expense: PersonalExpenseItem) => {
    setEditingExpense({
      id: expense.id,
      name: expense.name,
      category: expense.category,
      amount: String(expense.amount),
      frequency: expense.frequency as 'monthly' | 'annual' | 'one_time',
      notes: expense.notes || '',
    })
    setIsExpenseDialogOpen(true)
  }

  const handleDeleteExpense = async (id: string) => {
    try {
      const result = await deletePersonalExpense(id)
      if (result.success) {
        toast.success('Expense deleted successfully')
        refetch()
      } else {
        throw new Error(result.error || 'Failed to delete expense')
      }
    } catch (error) {
      console.error('Error deleting expense:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete expense')
    }
  }

  const handleToggleActive = async (id: string, isActive: boolean) => {
    setTogglingIds((prev) => new Set(prev).add(id))

    try {
      const result = await togglePersonalExpense(id, isActive)

      if (!result.success) {
        throw new Error(result.error || 'Failed to update expense')
      }

      refetch()
      toast.success(`Expense ${isActive ? 'activated' : 'deactivated'}`)
    } catch (error) {
      console.error('Error toggling expense:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update expense')
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  // Category handlers
  const handleSaveCategory = async (data: { name: string; color?: string; description?: string }) => {
    setIsSavingCategory(true)
    try {
      if (editingCategory) {
        const result = await updatePersonalCategory({
          id: editingCategory.id,
          ...data,
        })
        if (!result.success) {
          throw new Error(result.error)
        }
        toast.success('Category updated successfully')
      } else {
        const result = await createPersonalCategory(data)
        if (!result.success) {
          throw new Error(result.error)
        }
        toast.success('Category created successfully')
      }
      refetchCategories()
      setIsCategoryDialogOpen(false)
      setEditingCategory(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save category')
    } finally {
      setIsSavingCategory(false)
    }
  }

  const handleEditCategory = (category: PersonalExpenseCategoryData) => {
    setEditingCategory(category)
    setIsCategoryDialogOpen(true)
  }

  const handleDeleteCategory = async (id: string) => {
    setDeletingCategoryId(id)
    try {
      const result = await deletePersonalCategory(id)
      if (!result.success) {
        toast.error(result.error || 'Failed to delete category')
      } else {
        toast.success('Category deleted successfully')
        refetchCategories()
      }
    } finally {
      setDeletingCategoryId(null)
    }
  }

  const handleAddCategory = () => {
    setEditingCategory(null)
    setIsCategoryDialogOpen(true)
  }

  // Summary data
  const totalExpenses = expensesData?.summary.totalExpenses ?? 0
  const monthlyBurnRate = expensesData?.summary.monthlyBurnRate ?? 0
  const activeExpenses = expensesData?.summary.activeExpenses ?? 0

  // Top category by spend
  const topCategory = useMemo(() => {
    if (expensesData?.categories && expensesData.categories.length > 0) {
      return expensesData.categories[0] // Already sorted by amount desc from API
    }
    return null
  }, [expensesData?.categories])

  // Build category color map from loaded categories
  const categoryColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    expenseCategoryList.forEach(cat => {
      if (cat.color) {
        map[cat.name.toLowerCase()] = cat.color
      }
    })
    return map
  }, [expenseCategoryList])

  const expenseColumns = useMemo(
    () => createExpenseColumns(handleToggleActive, handleEditExpense, handleDeleteExpense, togglingIds, categoryColorMap),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers are stable enough; togglingIds/categoryColorMap drive re-render
    [togglingIds, categoryColorMap]
  )

  // Display categories from API
  const displayCategories = expensesData?.categories || []

  // Prepare trend data from API monthly data
  const { trendData, trendLines } = useMemo(() => {
    if (!expensesData?.monthly || expensesData.monthly.length === 0 || !expensesData.categories) {
      return { trendData: [], trendLines: [] }
    }

    // Take top 4 categories by spend for the trend chart
    const topCategories = expensesData.categories.slice(0, 4)

    const lines = topCategories.map(cat => ({
      key: cat.name.toLowerCase().replace(/\s+/g, '_'),
      color: cat.color,
      label: cat.name,
    }))

    const data = expensesData.monthly.map(m => ({
      date: m.month,
      ...Object.fromEntries(
        Object.entries(m.byCategory).map(([cat, amount]) => [
          cat.toLowerCase().replace(/\s+/g, '_'),
          amount
        ])
      ),
    }))

    return { trendData: data, trendLines: lines }
  }, [expensesData?.monthly, expensesData?.categories])

  // Check if filters differ from defaults
  const hasActiveFilters = period !== 'mtd'

  const handleResetFilters = () => {
    setPeriod('mtd')
    setDateRange({
      from: startOfMonth(new Date()),
      to: new Date(),
    })
  }

  return (
    <AppShell title="Personal" appId="personal">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Personal Expenses</h1>
            <p className="text-sm text-muted-foreground">
              Track your personal spending and monthly burn rate
            </p>
          </div>
          <Button onClick={handleAddExpense}>
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        </div>

        {/* Filters */}
        <FilterBar
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          onPeriodChange={setPeriod}
          period={period}
          showSourceFilter={false}
          hasActiveFilters={hasActiveFilters}
          onReset={handleResetFilters}
        />

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Expenses"
            value={`$${totalExpenses.toLocaleString()}`}
            change={expensesData?.categories?.[0]?.change}
            trend={totalExpenses > 0 ? 'up' : 'neutral'}
            icon={DollarSign}
            positiveIsGood={false}
          />
          <MetricCard
            title="Monthly Burn Rate"
            value={`$${monthlyBurnRate.toLocaleString()}/mo`}
            icon={Wallet}
            description="Average per month in period"
          />
          <MetricCard
            title="Active Expenses"
            value={String(activeExpenses)}
            icon={TrendingUp}
            description="Currently tracked"
          />
          <MetricCard
            title="Top Category"
            value={topCategory?.name ?? 'None'}
            icon={Tag}
            description={topCategory ? `$${topCategory.amount.toLocaleString()}` : 'No expenses yet'}
          />
        </div>

        {/* Tabs for different views */}
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="all">All Expenses</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Category Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Spend by Category</CardTitle>
                <CardDescription>Breakdown by expense type</CardDescription>
              </CardHeader>
              <CardContent>
                {isExpensesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : displayCategories.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Tag className="h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No expense data for this period. Add expenses to see the breakdown.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {displayCategories.map((cat) => (
                      <div key={cat.id} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{cat.name}</span>
                          <div className="flex items-center gap-2">
                            <span>${cat.amount.toLocaleString()}</span>
                            <span
                              className={cn(
                                'text-xs',
                                cat.trend === 'up' && 'text-red-500',
                                cat.trend === 'down' && 'text-green-600',
                                cat.trend === 'neutral' && 'text-muted-foreground'
                              )}
                            >
                              {cat.change > 0 ? '+' : ''}
                              {cat.change}%
                            </span>
                          </div>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full transition-all"
                            style={{
                              width: `${totalExpenses > 0 ? (cat.amount / totalExpenses) * 100 : 0}%`,
                              backgroundColor: cat.color || '#FF692D',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Spend Trend Chart */}
            {trendData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Spend Over Time</CardTitle>
                  <CardDescription>Monthly spend by category</CardDescription>
                </CardHeader>
                <CardContent>
                  <TrendChart
                    data={trendData}
                    lines={trendLines}
                    formatValue={(v) => `$${v.toLocaleString()}`}
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* All Expenses Tab */}
          <TabsContent value="all" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>All Expenses</CardTitle>
                <CardDescription>
                  Manage your recurring and one-time personal expenses.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isExpensesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : expenses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Receipt className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium">No expenses yet</h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">
                      Start tracking your personal spending by adding your first expense.
                    </p>
                    <Button onClick={handleAddExpense}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Expense
                    </Button>
                  </div>
                ) : (
                  <DataTable
                    columns={expenseColumns}
                    data={expenses}
                    keyField="id"
                    pageSize={10}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Expense Categories</CardTitle>
                  <CardDescription>
                    Manage categories used to organize your personal expenses.
                  </CardDescription>
                </div>
                <Button onClick={handleAddCategory}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Category
                </Button>
              </CardHeader>
              <CardContent>
                {isCategoriesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : expenseCategoryList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Palette className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium">No categories yet</h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">
                      Create your first category to organize expenses.
                    </p>
                    <Button onClick={handleAddCategory}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Category
                    </Button>
                  </div>
                ) : (
                  <DataTable
                    columns={[
                      {
                        key: 'name',
                        header: 'Name',
                        render: (value, row) => (
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full shrink-0"
                              style={{ backgroundColor: row.color || '#6b7280' }}
                            />
                            <span className="font-medium">{value as string}</span>
                          </div>
                        ),
                      },
                      {
                        key: 'description',
                        header: 'Description',
                        render: (value) => (
                          <span className="text-muted-foreground">{(value as string) || '-'}</span>
                        ),
                      },
                      {
                        key: 'expense_count',
                        header: 'Expenses',
                        align: 'right' as const,
                        render: (value) => value as number,
                      },
                      {
                        key: 'actions',
                        header: '',
                        align: 'right' as const,
                        sortable: false,
                        render: (_, row) => (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditCategory(row)}
                              title="Edit category"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCategory(row.id)}
                              disabled={deletingCategoryId === row.id}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              title="Delete category"
                            >
                              {deletingCategoryId === row.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        ),
                      },
                    ]}
                    data={expenseCategoryList}
                    keyField="id"
                    paginated={false}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Category Dialog */}
        <CategoryDialog
          open={isCategoryDialogOpen}
          onOpenChange={(open) => {
            setIsCategoryDialogOpen(open)
            if (!open) setEditingCategory(null)
          }}
          category={editingCategory}
          onSave={handleSaveCategory}
          isSaving={isSavingCategory}
        />

        {/* Expense Dialog (Add/Edit) */}
        <ExpenseDialog
          open={isExpenseDialogOpen}
          onOpenChange={(open) => {
            setIsExpenseDialogOpen(open)
            if (!open) setEditingExpense(null)
          }}
          expense={editingExpense}
          onSave={handleSaveExpense}
          isSaving={isSavingExpense}
          categories={expenseCategoryList.map(c => c.name)}
        />
      </div>
    </AppShell>
  )
}
