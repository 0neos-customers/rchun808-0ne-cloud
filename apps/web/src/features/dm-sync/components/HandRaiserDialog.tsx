'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Switch,
} from '@0ne/ui'
import { Loader2, Eye, AlertCircle, CheckCircle2 } from 'lucide-react'

export interface HandRaiserFormData {
  id?: string
  post_url: string
  dm_template: string
  keyword_filter: string
  ghl_tag: string
  is_active: boolean
}

interface HandRaiserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaign?: HandRaiserFormData | null
  onSave: (data: HandRaiserFormData) => Promise<void>
  isSaving?: boolean
}

const DEFAULT_FORM_DATA: HandRaiserFormData = {
  post_url: '',
  dm_template: '',
  keyword_filter: '',
  ghl_tag: '',
  is_active: true,
}

/**
 * Validates if a URL looks like a valid Skool post URL
 * Expected format: https://www.skool.com/[community]/[post-slug]~[id]
 */
function validateSkoolUrl(url: string): { isValid: boolean; message: string } {
  if (!url.trim()) {
    return { isValid: false, message: '' }
  }

  try {
    const parsed = new URL(url)
    const isSkoolDomain = parsed.hostname.includes('skool.com')
    const hasPath = parsed.pathname.length > 1

    if (!isSkoolDomain) {
      return { isValid: false, message: 'URL must be from skool.com' }
    }

    if (!hasPath) {
      return { isValid: false, message: 'URL must include the post path' }
    }

    return { isValid: true, message: 'Valid Skool post URL' }
  } catch {
    return { isValid: false, message: 'Please enter a valid URL' }
  }
}

export function HandRaiserDialog({
  open,
  onOpenChange,
  campaign,
  onSave,
  isSaving = false,
}: HandRaiserDialogProps) {
  const isEditMode = !!campaign?.id
  const [formData, setFormData] = useState<HandRaiserFormData>(DEFAULT_FORM_DATA)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // URL validation state
  const urlValidation = useMemo(
    () => validateSkoolUrl(formData.post_url),
    [formData.post_url]
  )

  // Template preview with sample data
  const previewText = useMemo(
    () =>
      formData.dm_template
        .replace(/\{\{name\}\}/g, 'John')
        .replace(/\{\{username\}\}/g, 'johndoe'),
    [formData.dm_template]
  )

  // Reset form when dialog opens/closes or campaign changes
  useEffect(() => {
    if (open) {
      setFormData(
        campaign
          ? {
              id: campaign.id,
              post_url: campaign.post_url || '',
              dm_template: campaign.dm_template || '',
              keyword_filter: campaign.keyword_filter || '',
              ghl_tag: campaign.ghl_tag || '',
              is_active: campaign.is_active ?? true,
            }
          : DEFAULT_FORM_DATA
      )
      setError(null)
      setShowPreview(false)
    }
  }, [open, campaign])

  const handleFieldChange = (field: keyof HandRaiserFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError(null)
  }

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.post_url.trim()) {
      setError('Post URL is required')
      return
    }

    if (!urlValidation.isValid) {
      setError(urlValidation.message || 'Please enter a valid Skool post URL')
      return
    }

    // dm_template is now optional - campaigns can work in GHL-only mode

    setError(null)

    try {
      await onSave({
        ...formData,
        post_url: formData.post_url.trim(),
        dm_template: formData.dm_template.trim(),
        keyword_filter: formData.keyword_filter.trim(),
        ghl_tag: formData.ghl_tag.trim(),
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save campaign')
    }
  }

  const hasTemplate = formData.dm_template.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Edit Hand-Raiser Campaign' : 'Create Hand-Raiser Campaign'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update this hand-raiser campaign settings.'
              : 'Create a campaign to automatically DM users who comment on a Skool post.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Post URL */}
          <div className="grid gap-2">
            <label htmlFor="post-url" className="text-sm font-medium">
              Skool Post URL <span className="text-red-500">*</span>
            </label>
            <Input
              id="post-url"
              placeholder="https://www.skool.com/community/post~abc123"
              value={formData.post_url}
              onChange={(e) => handleFieldChange('post_url', e.target.value)}
            />
            {formData.post_url && (
              <div className="flex items-center gap-1.5 text-xs">
                {urlValidation.isValid ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-green-600">{urlValidation.message}</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-amber-600">{urlValidation.message}</span>
                  </>
                )}
              </div>
            )}
            {!formData.post_url && (
              <p className="text-xs text-muted-foreground">
                Enter the full URL of the Skool post to monitor for comments
              </p>
            )}
          </div>

          {/* DM Template */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="dm-template" className="text-sm font-medium">
                DM Template
              </label>
              {hasTemplate && (
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {showPreview ? 'Hide Preview' : 'Show Preview'}
                </button>
              )}
            </div>
            <textarea
              id="dm-template"
              placeholder="Hey {{name}}! Thanks for commenting..."
              value={formData.dm_template}
              onChange={(e) => handleFieldChange('dm_template', e.target.value)}
              rows={4}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
            {hasTemplate ? (
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600 font-medium">DM Mode:</span> Extension will send Skool DM + tag GHL.{' '}
                Variables: <code className="bg-muted px-1 rounded">{'{{name}}'}</code>{' '}
                <code className="bg-muted px-1 rounded">{'{{username}}'}</code>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                <span className="text-blue-600 font-medium">GHL-Only Mode:</span> Leave blank to only tag contacts in GHL.
                Use GHL workflows for messaging.
              </p>
            )}

            {/* Template Preview */}
            {showPreview && hasTemplate && (
              <div className="rounded-md border bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  Preview (with sample data):
                </p>
                <p className="text-sm whitespace-pre-wrap">{previewText}</p>
              </div>
            )}
          </div>

          {/* Keyword Filter */}
          <div className="grid gap-2">
            <label htmlFor="keyword-filter" className="text-sm font-medium">
              Keyword Filter
            </label>
            <Input
              id="keyword-filter"
              placeholder="interested, sign me up, how do I join"
              value={formData.keyword_filter}
              onChange={(e) => handleFieldChange('keyword_filter', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated keywords. Only comments containing these words will trigger a DM.
              Leave blank to DM all commenters.
            </p>
          </div>

          {/* GHL Tag */}
          <div className="grid gap-2">
            <label htmlFor="ghl-tag" className="text-sm font-medium">
              GHL Tag
            </label>
            <Input
              id="ghl-tag"
              placeholder="hand-raiser-campaign-1"
              value={formData.ghl_tag}
              onChange={(e) => handleFieldChange('ghl_tag', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Tag to apply in GoHighLevel when a DM is sent
            </p>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <label htmlFor="is-active" className="text-sm font-medium cursor-pointer">
                Campaign Active
              </label>
              <p className="text-xs text-muted-foreground">
                {formData.is_active
                  ? 'Campaign will monitor and send DMs'
                  : 'Campaign is paused'}
              </p>
            </div>
            <Switch
              id="is-active"
              checked={formData.is_active}
              onCheckedChange={(checked) => handleFieldChange('is_active', checked)}
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-500">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
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
            disabled={isSaving || !formData.post_url.trim()}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditMode ? 'Save Changes' : 'Create Campaign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
