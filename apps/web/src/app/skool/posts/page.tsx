'use client'

import { useState, useMemo } from 'react'
import {
  Button,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from '@0ne/ui'
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2, Eye, Check, Bot, Upload, User } from 'lucide-react'
import { type SkoolPostLibraryItem, type PostLibraryStatus } from '@0ne/db'
import {
  usePostLibrary,
  createPost,
  updatePost,
  deletePost,
  approvePost,
  useVariationGroups,
} from '@/features/skool/hooks'
import { PostDialog, ConfirmDialog, PostPreviewPopover, type PostFormData } from '@/features/skool/components'

export default function PostsLibraryPage() {
  const [groupFilter, setGroupFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Build filters object based on active filters
  const filters = {
    ...(groupFilter !== 'all' ? { variationGroupId: groupFilter } : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter as PostLibraryStatus } : {}),
  }
  const hasFilters = Object.keys(filters).length > 0

  const { posts, isLoading, refresh } = usePostLibrary(hasFilters ? filters : undefined)
  const { groups } = useVariationGroups(true) // include stats for post counts

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<SkoolPostLibraryItem | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Approve state
  const [approvingId, setApprovingId] = useState<string | null>(null)

  // Sort posts by created_at descending (newest first)
  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      // Drafts always at top, then by created_at descending
      if (a.status === 'draft' && b.status !== 'draft') return -1
      if (b.status === 'draft' && a.status !== 'draft') return 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [posts])

  // Create a map of group IDs to names for display
  const groupNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    groups.forEach((g) => {
      map[g.id] = g.name
    })
    return map
  }, [groups])

  const handleAddClick = () => {
    setEditingPost(null)
    setDialogOpen(true)
  }

  const handleEditClick = (post: SkoolPostLibraryItem) => {
    setEditingPost(post)
    setDialogOpen(true)
  }

  const handleDeleteClick = (id: string) => {
    setDeletingId(id)
    setDeleteDialogOpen(true)
  }

  const handleSave = async (data: PostFormData) => {
    setIsSaving(true)
    try {
      if (data.id) {
        // Update existing
        const result = await updatePost(data.id, {
          title: data.title,
          body: data.body,
          image_url: data.image_url || null,
          video_url: data.video_url || null,
          is_active: data.is_active,
          variation_group_id: data.variation_group_id,
          status: data.status,
        })
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Post updated')
      } else {
        // Create new (manual creation defaults to active)
        const result = await createPost({
          category: '', // kept for backward compatibility
          day_of_week: null,
          time: null,
          title: data.title,
          body: data.body,
          image_url: data.image_url || null,
          video_url: data.video_url || null,
          is_active: data.is_active,
          variation_group_id: data.variation_group_id,
          status: 'active',
          source: 'manual',
        })
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Post created')
      }
      setDialogOpen(false)
      refresh()
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    setIsDeleting(true)
    try {
      const result = await deletePost(deletingId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Post deleted')
      setDeleteDialogOpen(false)
      refresh()
    } finally {
      setIsDeleting(false)
      setDeletingId(null)
    }
  }

  const handleApprove = async (id: string) => {
    setApprovingId(id)
    try {
      const result = await approvePost(id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Post approved')
      refresh()
    } finally {
      setApprovingId(null)
    }
  }

  // Count drafts for badge
  const draftCount = posts.filter((p) => p.status === 'draft').length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Posts Library
            {draftCount > 0 && (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                {draftCount} draft{draftCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground">Content variations for rotation.</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="active">Active</SelectItem>
            </SelectContent>
          </Select>
          {/* Variation Group Filter */}
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              <SelectItem value="none">No Group</SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                  {group.post_count !== undefined && (
                    <span className="text-muted-foreground ml-1">({group.post_count})</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAddClick}>
            <Plus className="h-4 w-4 mr-2" />
            Add Post
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/50">
          <p className="text-muted-foreground">
            {groupFilter !== 'all'
              ? `No posts in the selected group.`
              : statusFilter !== 'all'
                ? `No ${statusFilter} posts.`
                : 'No posts in the library yet.'}
          </p>
          <Button variant="outline" className="mt-4" onClick={handleAddClick}>
            <Plus className="h-4 w-4 mr-2" />
            Create First Post
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[280px]">Title</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPosts.map((post) => (
                <TableRow key={post.id} className={post.status === 'draft' ? 'bg-yellow-50' : undefined}>
                  <TableCell>
                    <PostPreviewPopover post={post}>
                      <button className="flex items-center gap-2 text-left hover:text-primary transition-colors">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium truncate max-w-[240px]">
                          {post.title}
                        </span>
                      </button>
                    </PostPreviewPopover>
                  </TableCell>
                  <TableCell>
                    {post.variation_group_id ? (
                      <span className="text-sm">{groupNameMap[post.variation_group_id] || 'Unknown'}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {post.source === 'api' && (
                      <Badge variant="outline" className="gap-1">
                        <Bot className="h-3 w-3" />
                        AI
                      </Badge>
                    )}
                    {post.source === 'import' && (
                      <Badge variant="outline" className="gap-1">
                        <Upload className="h-3 w-3" />
                        Import
                      </Badge>
                    )}
                    {(!post.source || post.source === 'manual') && (
                      <Badge variant="outline" className="gap-1 text-muted-foreground">
                        <User className="h-3 w-3" />
                        Manual
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {post.status === 'draft' && (
                      <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                        Draft
                      </Badge>
                    )}
                    {post.status === 'approved' && (
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                        Approved
                      </Badge>
                    )}
                    {(!post.status || post.status === 'active') && (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {post.status === 'draft' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleApprove(post.id)}
                          disabled={approvingId === post.id}
                          title="Approve post"
                        >
                          {approvingId === post.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4 text-green-600" />
                          )}
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditClick(post)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(post.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <PostDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        post={
          editingPost
            ? {
                id: editingPost.id,
                category: editingPost.category,
                day_of_week: editingPost.day_of_week,
                time: editingPost.time,
                title: editingPost.title,
                body: editingPost.body,
                image_url: editingPost.image_url || '',
                video_url: editingPost.video_url || '',
                is_active: editingPost.is_active,
                variation_group_id: editingPost.variation_group_id ?? null,
                status: editingPost.status,
                source: editingPost.source,
              }
            : null
        }
        onSave={handleSave}
        isSaving={isSaving}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Post"
        description="Are you sure you want to delete this post? This action cannot be undone."
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
    </div>
  )
}
