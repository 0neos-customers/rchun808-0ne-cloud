'use client'

/**
 * Staff Users Manager Component
 *
 * Admin UI for managing staff users in the DM sync system.
 * Allows adding, editing, and removing staff members with their
 * Skool ID to GHL user mappings.
 */

import { useState } from 'react'
import useSWR from 'swr'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Input,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Switch,
} from '@0ne/ui'
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Star,
  Check,
  X,
} from 'lucide-react'
import type { StaffUserRow } from '../types'

// =============================================================================
// TYPES
// =============================================================================

interface StaffFormData {
  skoolUserId: string
  skoolUsername: string
  displayName: string
  ghlUserId: string
  isDefault: boolean
  isActive: boolean
}

const emptyFormData: StaffFormData = {
  skoolUserId: '',
  skoolUsername: '',
  displayName: '',
  ghlUserId: '',
  isDefault: false,
  isActive: true,
}

// =============================================================================
// API HOOKS
// =============================================================================

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch staff users')
  const data = await res.json()
  return data.data as StaffUserRow[]
}

function useStaffUsers() {
  const { data, error, isLoading, mutate } = useSWR<StaffUserRow[]>(
    '/api/settings/staff-users',
    fetcher
  )

  return {
    staffUsers: data || [],
    isLoading,
    error,
    refresh: mutate,
  }
}

// =============================================================================
// COMPONENTS
// =============================================================================

interface StaffDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: StaffFormData) => Promise<void>
  initialData?: Partial<StaffFormData>
  isEditing?: boolean
  isSubmitting?: boolean
}

function StaffDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isEditing,
  isSubmitting,
}: StaffDialogProps) {
  const [formData, setFormData] = useState<StaffFormData>({
    ...emptyFormData,
    ...initialData,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData)
    setFormData(emptyFormData)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Edit Staff User' : 'Add Staff User'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update staff user details for DM routing.'
                : 'Add a new staff user for multi-staff DM support.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="displayName" className="text-sm font-medium">Display Name *</label>
              <Input
                id="displayName"
                placeholder="Jimmy"
                value={formData.displayName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    displayName: e.target.value,
                  }))
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                Shown in message prefixes (e.g., &quot;Jimmy (via Skool)&quot;)
              </p>
            </div>

            <div className="grid gap-2">
              <label htmlFor="skoolUserId" className="text-sm font-medium">Skool User ID *</label>
              <Input
                id="skoolUserId"
                placeholder="abc123..."
                value={formData.skoolUserId}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    skoolUserId: e.target.value,
                  }))
                }
                required
                disabled={isEditing}
              />
              <p className="text-xs text-muted-foreground">
                Found in Skool member profile URL
              </p>
            </div>

            <div className="grid gap-2">
              <label htmlFor="skoolUsername" className="text-sm font-medium">Skool Username</label>
              <Input
                id="skoolUsername"
                placeholder="@jimmy"
                value={formData.skoolUsername}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    skoolUsername: e.target.value.replace('@', ''),
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Used for @mention override routing (e.g., @jimmy)
              </p>
            </div>

            <div className="grid gap-2">
              <label htmlFor="ghlUserId" className="text-sm font-medium">GHL User ID</label>
              <Input
                id="ghlUserId"
                placeholder="user_xyz..."
                value={formData.ghlUserId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, ghlUserId: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                For routing GHL replies to specific Skool user
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-sm font-medium">Default Staff</span>
                <p className="text-xs text-muted-foreground">
                  Fallback when no routing match
                </p>
              </div>
              <Switch
                checked={formData.isDefault}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isDefault: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-sm font-medium">Active</span>
                <p className="text-xs text-muted-foreground">
                  Include in message routing
                </p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isActive: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Add Staff User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function StaffUsersManager() {
  const { staffUsers, isLoading, error, refresh } = useStaffUsers()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<StaffUserRow | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleAdd = async (data: StaffFormData) => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/settings/staff-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add staff user')
      }

      await refresh()
      setIsAddOpen(false)
    } catch (error) {
      console.error('Error adding staff user:', error)
      alert(error instanceof Error ? error.message : 'Failed to add staff user')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = async (data: StaffFormData) => {
    if (!editingUser) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/settings/staff-users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update staff user')
      }

      await refresh()
      setEditingUser(null)
    } catch (error) {
      console.error('Error updating staff user:', error)
      alert(error instanceof Error ? error.message : 'Failed to update staff user')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this staff user?')) {
      return
    }

    setDeletingId(id)
    try {
      const response = await fetch(`/api/settings/staff-users/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete staff user')
      }

      await refresh()
    } catch (error) {
      console.error('Error deleting staff user:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete staff user')
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggleActive = async (user: StaffUserRow) => {
    try {
      const response = await fetch(`/api/settings/staff-users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.is_active }),
      })

      if (!response.ok) {
        throw new Error('Failed to toggle active status')
      }

      await refresh()
    } catch (error) {
      console.error('Error toggling active status:', error)
    }
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Staff Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">
            Failed to load staff users: {error.message}
          </p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => refresh()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Staff Users
              </CardTitle>
              <CardDescription>
                Manage team members for multi-staff DM routing
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setIsAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Staff
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : staffUsers.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-2" />
              <p className="text-muted-foreground">No staff users configured</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Add staff users to enable multi-staff DM routing
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Skool Username</TableHead>
                    <TableHead>GHL User</TableHead>
                    <TableHead className="w-[80px]">Status</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{user.display_name}</span>
                          {user.is_default && (
                            <Badge variant="outline" className="gap-1">
                              <Star className="h-3 w-3" />
                              Default
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.skool_username ? (
                          <code className="text-sm">@{user.skool_username}</code>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.ghl_user_id ? (
                          <code className="text-xs">{user.ghl_user_id.slice(0, 12)}...</code>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleToggleActive(user)}
                          className="flex items-center gap-1 text-sm"
                        >
                          {user.is_active ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200 gap-1">
                              <Check className="h-3 w-3" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <X className="h-3 w-3" />
                              Inactive
                            </Badge>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setEditingUser(user)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            onClick={() => handleDelete(user.id)}
                            disabled={deletingId === user.id}
                          >
                            {deletingId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-4 rounded-md bg-muted/50 p-3">
            <p className="text-sm font-medium mb-1">How Staff Routing Works</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>1. <code className="bg-muted px-1">@username</code> prefix in GHL message overrides routing</li>
              <li>2. GHL User ID maps replies to specific Skool staff</li>
              <li>3. Last conversation history determines staff for ongoing threads</li>
              <li>4. Default staff handles fallback when no match found</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <StaffDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onSubmit={handleAdd}
        isSubmitting={isSubmitting}
      />

      {/* Edit Dialog */}
      {editingUser && (
        <StaffDialog
          open={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
          onSubmit={handleEdit}
          initialData={{
            skoolUserId: editingUser.skool_user_id,
            skoolUsername: editingUser.skool_username || '',
            displayName: editingUser.display_name,
            ghlUserId: editingUser.ghl_user_id || '',
            isDefault: editingUser.is_default,
            isActive: editingUser.is_active,
          }}
          isEditing
          isSubmitting={isSubmitting}
        />
      )}
    </>
  )
}
