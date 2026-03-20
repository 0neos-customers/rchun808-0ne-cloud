'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@0ne/ui'
import { AppShell } from '@/components/shell'
import { Shield, Users, RefreshCw, Landmark } from 'lucide-react'

export default function SettingsPage() {
  return (
    <AppShell title="0ne">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account and app permissions
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Your account settings</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Account management is handled through Clerk. Click your profile
              picture in the sidebar to manage your account.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>App Access</CardTitle>
            <CardDescription>
              Your enabled applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Contact an administrator to request access to additional apps.
            </p>
            <Button variant="outline" disabled>
              Request Access
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Data Synchronization
            </CardTitle>
            <CardDescription>
              Monitor and manage data sync jobs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/settings/sync">
              <Button variant="outline" className="w-full justify-start">
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5" />
              Integrations
            </CardTitle>
            <CardDescription>
              Connected bank accounts and external services
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/settings/integrations">
              <Button variant="outline" className="w-full justify-start">
                <Landmark className="mr-2 h-4 w-4" />
                Manage Integrations
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Administration
            </CardTitle>
            <CardDescription>
              Admin-only settings and user management
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/settings/admin">
              <Button variant="outline" className="w-full justify-start">
                <Users className="mr-2 h-4 w-4" />
                Manage User Permissions
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
