'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@0ne/ui'
import { Loader2 } from 'lucide-react'

export interface ExpenseFormData {
  id?: string
  name: string
  category: string
  customCategory?: string
  amount: string
  frequency: 'monthly' | 'annual' | 'one_time'
  notes?: string
}

interface ExpenseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense?: ExpenseFormData | null
  onSave: (data: ExpenseFormData) => Promise<void>
  isSaving?: boolean
  categories?: string[]
}

const defaultFormData: ExpenseFormData = {
  name: '',
  category: '',
  customCategory: '',
  amount: '',
  frequency: 'monthly',
  notes: '',
}

export function ExpenseDialog({
  open,
  onOpenChange,
  expense,
  onSave,
  isSaving = false,
  categories = [],
}: ExpenseDialogProps) {
  const [formData, setFormData] = useState<ExpenseFormData>(defaultFormData)
  const isEditMode = !!expense?.id

  // Reset form when dialog opens/closes or expense changes
  useEffect(() => {
    if (open && expense) {
      // Match category case-insensitively against available categories
      const expenseCategory = expense.category || ''
      const matchedCategory = categories.find(
        c => c.toLowerCase() === expenseCategory.toLowerCase()
      ) || expenseCategory

      setFormData({
        id: expense.id,
        name: expense.name || '',
        category: matchedCategory,
        customCategory: expense.customCategory || '',
        amount: expense.amount || '',
        frequency: expense.frequency || 'monthly',
        notes: expense.notes || '',
      })
    } else if (open && !expense) {
      setFormData(defaultFormData)
    }
  }, [open, expense, categories])

  const handleSubmit = async () => {
    await onSave(formData)
  }

  const isValid =
    formData.name.trim() &&
    formData.category &&
    formData.amount &&
    (formData.category !== 'other' || formData.customCategory?.trim())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Expense' : 'Add New Expense'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the expense details below.'
              : 'Add a recurring or one-time personal expense.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="expense-name" className="text-sm font-medium">
              Expense Name
            </label>
            <Input
              id="expense-name"
              placeholder="e.g., Rent, Groceries, Netflix"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label htmlFor="expense-category" className="text-sm font-medium">
                Category
              </label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value, customCategory: '' })
                }
              >
                <SelectTrigger id="expense-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                  <SelectItem value="other">Other...</SelectItem>
                </SelectContent>
              </Select>
              {formData.category === 'other' && (
                <Input
                  placeholder="Enter custom category"
                  value={formData.customCategory}
                  onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                  className="mt-2"
                />
              )}
            </div>
            <div className="grid gap-2">
              <label htmlFor="expense-frequency" className="text-sm font-medium">
                Frequency
              </label>
              <Select
                value={formData.frequency}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    frequency: value as 'monthly' | 'annual' | 'one_time',
                  })
                }
              >
                <SelectTrigger id="expense-frequency">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="one_time">One-time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <label htmlFor="expense-amount" className="text-sm font-medium">
              Amount ($)
            </label>
            <Input
              id="expense-amount"
              type="number"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="expense-notes" className="text-sm font-medium">
              Notes
            </label>
            <textarea
              id="expense-notes"
              placeholder="Optional notes..."
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditMode ? 'Save Changes' : 'Add Expense'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
