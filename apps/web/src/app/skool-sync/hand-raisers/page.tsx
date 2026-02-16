'use client'

import { useState } from 'react'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@0ne/ui'
import { Edit, Plus, Trash2, Tag, Filter, Clock, Send } from 'lucide-react'
import {
  useHandRaisers,
  createHandRaiser,
  updateHandRaiser,
  deleteHandRaiser,
  type HandRaiserCampaignWithStats,
} from '@/features/dm-sync/hooks/use-hand-raisers'
import { HandRaiserDialog, type HandRaiserFormData } from '@/features/dm-sync/components/HandRaiserDialog'
import { ConfirmDialog } from '@/features/skool/components'

export default function HandRaisersPage() {
  const { campaigns, isLoading, refresh } = useHandRaisers()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<HandRaiserFormData | null>(null)
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleCreate = () => {
    setSelectedCampaign(null)
    setDialogOpen(true)
  }

  const handleEdit = (campaign: HandRaiserCampaignWithStats) => {
    setSelectedCampaign({
      id: campaign.id,
      post_url: campaign.post_url,
      dm_template: campaign.dm_template || '',
      keyword_filter: campaign.keyword_filter || '',
      ghl_tag: campaign.ghl_tag || '',
      is_active: campaign.is_active,
    })
    setDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    setCampaignToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleSave = async (data: HandRaiserFormData) => {
    setIsSaving(true)
    try {
      if (data.id) {
        await updateHandRaiser(data.id, data)
      } else {
        await createHandRaiser({
          post_url: data.post_url,
          dm_template: data.dm_template,
          keyword_filter: data.keyword_filter || null,
          ghl_tag: data.ghl_tag || null,
          is_active: data.is_active,
        })
      }
      refresh()
      setDialogOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!campaignToDelete) return
    setIsDeleting(true)
    try {
      await deleteHandRaiser(campaignToDelete)
      refresh()
      setDeleteDialogOpen(false)
      setCampaignToDelete(null)
    } finally {
      setIsDeleting(false)
    }
  }

  const truncateUrl = (url: string, maxLength = 40) => {
    if (url.length <= maxLength) return url
    return url.substring(0, maxLength) + '...'
  }

  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hand-Raiser Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Automatically DM users who comment on posts
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              No hand-raiser campaigns yet. Create one to automatically DM users who comment on your
              Skool posts.
            </p>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create your first campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className={!campaign.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-mono truncate" title={campaign.post_url}>
                      {truncateUrl(campaign.post_url)}
                    </CardTitle>
                    {!campaign.is_active && (
                      <span className="inline-block mt-1 text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        Inactive
                      </span>
                    )}
                    {campaign.is_active && (
                      <span className="inline-block mt-1 text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(campaign)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(campaign.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                  {campaign.keyword_filter && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      <Filter className="h-3 w-3" />
                      {campaign.keyword_filter.split(',').length} keyword
                      {campaign.keyword_filter.split(',').length > 1 ? 's' : ''}
                    </span>
                  )}
                  {campaign.ghl_tag && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                      <Tag className="h-3 w-3" />
                      {campaign.ghl_tag}
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Send className="h-4 w-4" />
                    <span>{campaign.stats.sent_count} sent</span>
                  </div>
                  {campaign.stats.last_sent_at && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{formatRelativeTime(campaign.stats.last_sent_at)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <HandRaiserDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        campaign={selectedCampaign}
        onSave={handleSave}
        isSaving={isSaving}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Campaign"
        description="Are you sure you want to delete this hand-raiser campaign? This action cannot be undone."
        confirmText="Delete"
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        variant="destructive"
      />
    </div>
  )
}
