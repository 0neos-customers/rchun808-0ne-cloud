'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@0ne/ui'
import { Search, Shield, Users, RefreshCw, Loader2, Mail, Copy, Check, Ban } from 'lucide-react'
import { AppShell } from '@/components/shell'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  imageUrl?: string
  role: string
  permissions: {
    apps: Record<string, boolean>
    isAdmin: boolean
  }
}

interface Invite {
  id: string
  email: string
  name: string | null
  token: string
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  createdAt: string
}

export default function AdminPermissionsPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [invites, setInvites] = useState<Invite[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [invitesLoading, setInvitesLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  const fetchInvites = async () => {
    setInvitesLoading(true)
    try {
      const response = await fetch('/api/admin/invites')
      if (!response.ok) throw new Error('Failed to fetch invites')
      const data = await response.json()
      setInvites(data.invites || [])
    } catch (err) {
      console.error('Failed to load invites:', err)
    } finally {
      setInvitesLoading(false)
    }
  }

  const createInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviteLoading(true)
    try {
      const response = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, name: inviteName }),
      })
      if (!response.ok) throw new Error('Failed to create invite')
      setInviteEmail('')
      setInviteName('')
      await fetchInvites()
    } catch (err) {
      console.error('Failed to create invite:', err)
    } finally {
      setInviteLoading(false)
    }
  }

  const revokeInvite = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/invites/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to revoke invite')
      await fetchInvites()
    } catch (err) {
      console.error('Failed to revoke invite:', err)
    }
  }

  const copyInviteLink = (token: string, inviteId: string) => {
    const link = `${window.location.origin}/sign-up?invite=${token}`
    navigator.clipboard.writeText(link)
    setCopied(inviteId)
    setTimeout(() => setCopied(null), 2000)
  }

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/permissions')
      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }
      const data = await response.json()
      setUsers(data.users || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchInvites()
  }, [])

  // Platform admin (e.g. 0ne Cloud support) is hidden from customer-facing
  // user lists but retains full admin access for debugging. Set via env var
  // during provisioning — customers never see the platform admin in their UI.
  const hiddenEmail = process.env.NEXT_PUBLIC_PLATFORM_ADMIN_EMAIL?.toLowerCase()

  const filteredUsers = users
    .filter((user) => !hiddenEmail || user.email.toLowerCase() !== hiddenEmail)
    .filter(
      (user) =>
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${user.firstName} ${user.lastName}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
    )

  const toggleAdminStatus = async (userId: string) => {
    const user = users.find((u) => u.id === userId)
    if (!user) return

    setSaving(userId)
    const currentValue = user.permissions.isAdmin

    // Optimistic update
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            permissions: {
              ...u.permissions,
              isAdmin: !currentValue,
            },
          }
        }
        return u
      })
    )

    try {
      const response = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: userId,
          isAdmin: !currentValue,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update admin status')
      }
    } catch {
      // Revert on error
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id === userId) {
            return {
              ...u,
              permissions: {
                ...u.permissions,
                isAdmin: currentValue,
              },
            }
          }
          return u
        })
      )
    } finally {
      setSaving(null)
    }
  }

  return (
    <AppShell title="0ne">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Permissions</h1>
          <p className="text-muted-foreground">
            Manage which apps each user can access
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Invites
            </CardTitle>
            <CardDescription>
              Create and manage user invites
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                createInvite()
              }}
              className="mb-4 flex items-center gap-2"
            >
              <Input
                placeholder="Email address"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1"
                required
              />
              <Input
                placeholder="Name (optional)"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={inviteLoading || !inviteEmail.trim()}>
                {inviteLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Send Invite
              </Button>
            </form>

            {invitesLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invites.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell className="font-medium">{invite.email}</TableCell>
                        <TableCell>{invite.name || '—'}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              invite.status === 'pending'
                                ? 'bg-orange-100 text-orange-700'
                                : invite.status === 'accepted'
                                  ? 'bg-green-100 text-green-700'
                                  : invite.status === 'expired'
                                    ? 'bg-gray-100 text-gray-600'
                                    : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {invite.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(invite.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyInviteLink(invite.token, invite.id)}
                              title="Copy invite link"
                            >
                              {copied === invite.id ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                            {invite.status === 'pending' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => revokeInvite(invite.id)}
                                title="Revoke invite"
                              >
                                <Ban className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {invites.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No invites yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Users
                </CardTitle>
                <CardDescription>
                  Toggle app access for each user
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[250px]">User</TableHead>
                      <TableHead className="text-center">Role</TableHead>
                      <TableHead className="text-center">Admin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                              {user.firstName?.[0] || '?'}
                              {user.lastName?.[0] || ''}
                            </div>
                            <div>
                              <div className="font-medium">
                                {user.firstName} {user.lastName}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground capitalize">
                          {user.role || 'member'}
                        </TableCell>
                        <TableCell className="text-center">
                          <ToggleSwitch
                            enabled={user.permissions?.isAdmin || false}
                            onChange={() => toggleAdminStatus(user.id)}
                            loading={saving === user.id}
                            variant="admin"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredUsers.length === 0 && !loading && (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No users found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Permission Legend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-medium">App Access</h4>
                <p className="text-sm text-muted-foreground">
                  Users can only see and access apps they have enabled. The home
                  dashboard will only show tiles for enabled apps.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Admin Access</h4>
                <p className="text-sm text-muted-foreground">
                  Admins can access all apps regardless of individual toggles,
                  manage user permissions, and access system settings.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}

function ToggleSwitch({
  enabled,
  onChange,
  loading,
  variant = 'default',
}: {
  enabled: boolean
  onChange: () => void
  loading?: boolean
  variant?: 'default' | 'admin'
}) {
  const baseClasses =
    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2'

  const enabledColor =
    variant === 'admin'
      ? 'bg-amber-500 focus:ring-amber-500'
      : 'bg-lime-500 focus:ring-lime-500'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onChange}
      disabled={loading}
      className={`${baseClasses} ${enabled ? enabledColor : 'bg-gray-200'} ${loading ? 'opacity-50' : ''}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  )
}
