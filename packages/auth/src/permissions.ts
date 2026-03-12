import { clerkClient, currentUser } from '@clerk/nextjs/server'

export type AppId = 'kpi' | 'prospector' | 'skoolSync' | 'skoolScheduler' | 'ghlMedia' | 'personal'

export interface UserPermissions {
  apps: Record<AppId, boolean>
  isAdmin: boolean
}

export const DEFAULT_PERMISSIONS: UserPermissions = {
  apps: {
    kpi: false,
    prospector: false,
    skoolSync: false,
    skoolScheduler: false,
    ghlMedia: false,
    personal: false,
  },
  isAdmin: false,
}

export async function getUserPermissions(userId: string): Promise<UserPermissions> {
  try {
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const permissions = user.publicMetadata.permissions as UserPermissions | undefined
    return permissions || DEFAULT_PERMISSIONS
  } catch {
    return DEFAULT_PERMISSIONS
  }
}

export async function canAccessApp(userId: string, appId: AppId): Promise<boolean> {
  const permissions = await getUserPermissions(userId)
  return permissions.isAdmin || permissions.apps[appId] || false
}

export async function getCurrentUserPermissions(): Promise<UserPermissions | null> {
  const user = await currentUser()
  if (!user) return null
  return getUserPermissions(user.id)
}

export async function setUserPermissions(userId: string, permissions: UserPermissions): Promise<void> {
  const client = await clerkClient()
  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      permissions,
    },
  })
}

export async function enableAppForUser(userId: string, appId: AppId): Promise<void> {
  const permissions = await getUserPermissions(userId)
  permissions.apps[appId] = true
  await setUserPermissions(userId, permissions)
}

export async function disableAppForUser(userId: string, appId: AppId): Promise<void> {
  const permissions = await getUserPermissions(userId)
  permissions.apps[appId] = false
  await setUserPermissions(userId, permissions)
}

export function getEnabledApps(permissions: UserPermissions): AppId[] {
  // Always respect individual app toggles, even for admins
  // This allows admins to clean up their own UI by disabling apps they don't need
  return (Object.entries(permissions.apps) as [AppId, boolean][])
    .filter(([, enabled]) => enabled)
    .map(([appId]) => appId)
}
