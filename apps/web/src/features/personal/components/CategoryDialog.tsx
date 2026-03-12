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
} from '@0ne/ui'
import { Loader2 } from 'lucide-react'
import type { PersonalExpenseCategoryData } from '../hooks/use-personal-expense-categories'

// Preset colors for category selection
const PRESET_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Orange', value: '#f59e0b' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Indigo', value: '#6366f1' },
]

interface CategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: PersonalExpenseCategoryData | null
  onSave: (data: { name: string; color?: string; description?: string }) => Promise<void>
  isSaving?: boolean
}

export function CategoryDialog({
  open,
  onOpenChange,
  category,
  onSave,
  isSaving = false,
}: CategoryDialogProps) {
  const isEditMode = !!category
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Reset form when dialog opens/closes or category changes
  useEffect(() => {
    if (open) {
      setName(category?.name || '')
      setColor(category?.color || '')
      setDescription(category?.description || '')
      setError(null)
    }
  }, [open, category])

  const handleSubmit = async () => {
    // Validate
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    setError(null)

    try {
      await onSave({
        name: name.trim(),
        color: color || undefined,
        description: description.trim() || undefined,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Category' : 'Add Category'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update this expense category.'
              : 'Create a new category to organize your personal expenses.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Name */}
          <div className="grid gap-2">
            <label htmlFor="category-name" className="text-sm font-medium">
              Name <span className="text-red-500">*</span>
            </label>
            <Input
              id="category-name"
              placeholder="e.g., Housing, Food, Entertainment"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Color */}
          <div className="grid gap-2">
            <label className="text-sm font-medium">Color</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setColor(preset.value)}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${
                    color === preset.value
                      ? 'border-foreground scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: preset.value }}
                  title={preset.name}
                />
              ))}
              {/* Custom color option */}
              <div className="relative">
                <input
                  type="color"
                  value={color || '#6b7280'}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 h-8 w-8 cursor-pointer opacity-0"
                  title="Custom color"
                />
                <div
                  className={`h-8 w-8 rounded-full border-2 flex items-center justify-center ${
                    color && !PRESET_COLORS.find((p) => p.value === color)
                      ? 'border-foreground scale-110'
                      : 'border-dashed border-muted-foreground hover:scale-105'
                  }`}
                  style={{
                    backgroundColor:
                      color && !PRESET_COLORS.find((p) => p.value === color)
                        ? color
                        : 'transparent',
                  }}
                >
                  {(!color || PRESET_COLORS.find((p) => p.value === color)) && (
                    <span className="text-xs text-muted-foreground">+</span>
                  )}
                </div>
              </div>
            </div>
            {color && (
              <button
                type="button"
                onClick={() => setColor('')}
                className="text-xs text-muted-foreground hover:text-foreground self-start"
              >
                Clear color
              </button>
            )}
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <label htmlFor="category-description" className="text-sm font-medium">
              Description
            </label>
            <Input
              id="category-description"
              placeholder="Optional description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSaving || !name.trim()}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditMode ? 'Save Changes' : 'Add Category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
