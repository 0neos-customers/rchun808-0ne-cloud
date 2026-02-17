/**
 * Staff Users Management
 *
 * Handles multi-staff support for Skool-GHL DM sync.
 * Maps Skool staff members to GHL users for proper message attribution
 * and outbound routing.
 *
 * @module dm-sync/lib/staff-users
 */

import { createServerClient } from '@0ne/db/server'
import type { StaffUserRow } from '../types'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Input for creating/updating a staff user
 */
export interface StaffUserInput {
  userId: string // 0ne-app account owner
  skoolUserId: string
  skoolUsername?: string
  displayName: string
  ghlUserId?: string
  isDefault?: boolean
  isActive?: boolean
}

/**
 * Result from staff resolution
 */
export interface ResolvedStaff {
  skoolUserId: string
  displayName: string
  ghlUserId: string | null
  matchMethod: 'override' | 'ghl_user' | 'last_conversation' | 'default'
}

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

/**
 * Get all staff users for an account
 */
export async function getStaffUsers(userId: string): Promise<StaffUserRow[]> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('staff_users')
    .select('*')
    .eq('clerk_user_id', userId)
    .order('display_name', { ascending: true })

  if (error) {
    console.error('[Staff Users] Error fetching staff:', error)
    throw new Error(`Failed to fetch staff users: ${error.message}`)
  }

  return data || []
}

/**
 * Get active staff users for an account
 */
export async function getActiveStaffUsers(userId: string): Promise<StaffUserRow[]> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('staff_users')
    .select('*')
    .eq('clerk_user_id', userId)
    .eq('is_active', true)
    .order('display_name', { ascending: true })

  if (error) {
    console.error('[Staff Users] Error fetching active staff:', error)
    throw new Error(`Failed to fetch active staff users: ${error.message}`)
  }

  return data || []
}

/**
 * Get a staff user by Skool user ID
 */
export async function getStaffBySkoolId(
  skoolUserId: string
): Promise<StaffUserRow | null> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('staff_users')
    .select('*')
    .eq('skool_user_id', skoolUserId)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned
    console.error('[Staff Users] Error fetching staff by Skool ID:', error)
  }

  return data || null
}

/**
 * Get a staff user by GHL user ID
 */
export async function getStaffByGhlUserId(
  userId: string,
  ghlUserId: string
): Promise<StaffUserRow | null> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('staff_users')
    .select('*')
    .eq('clerk_user_id', userId)
    .eq('ghl_user_id', ghlUserId)
    .eq('is_active', true)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('[Staff Users] Error fetching staff by GHL ID:', error)
  }

  return data || null
}

/**
 * Get the default staff user for an account
 */
export async function getDefaultStaff(userId: string): Promise<StaffUserRow | null> {
  const supabase = createServerClient()

  // First try to find explicit default
  const { data: defaultStaff, error: defaultError } = await supabase
    .from('staff_users')
    .select('*')
    .eq('clerk_user_id', userId)
    .eq('is_default', true)
    .eq('is_active', true)
    .single()

  if (defaultStaff) {
    return defaultStaff
  }

  // Fall back to first active staff user
  if (defaultError && defaultError.code === 'PGRST116') {
    const { data: firstStaff, error: firstError } = await supabase
      .from('staff_users')
      .select('*')
      .eq('clerk_user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (firstError && firstError.code !== 'PGRST116') {
      console.error('[Staff Users] Error fetching first staff:', firstError)
    }

    return firstStaff || null
  }

  return null
}

/**
 * Create a new staff user
 */
export async function createStaffUser(input: StaffUserInput): Promise<StaffUserRow> {
  const supabase = createServerClient()

  // If setting as default, unset other defaults first
  if (input.isDefault) {
    await supabase
      .from('staff_users')
      .update({ is_default: false })
      .eq('clerk_user_id', input.userId)
  }

  const { data, error } = await supabase
    .from('staff_users')
    .insert({
      clerk_user_id: input.userId,
      skool_user_id: input.skoolUserId,
      skool_username: input.skoolUsername || null,
      display_name: input.displayName,
      ghl_user_id: input.ghlUserId || null,
      is_default: input.isDefault || false,
      is_active: input.isActive !== false,
    })
    .select()
    .single()

  if (error) {
    console.error('[Staff Users] Error creating staff user:', error)
    throw new Error(`Failed to create staff user: ${error.message}`)
  }

  return data
}

/**
 * Update a staff user
 */
export async function updateStaffUser(
  id: string,
  updates: Partial<Omit<StaffUserInput, 'userId' | 'skoolUserId'>>
): Promise<StaffUserRow> {
  const supabase = createServerClient()

  // If setting as default, need to get the clerk_user_id first
  if (updates.isDefault) {
    const { data: existing } = await supabase
      .from('staff_users')
      .select('clerk_user_id')
      .eq('id', id)
      .single()

    if (existing) {
      await supabase
        .from('staff_users')
        .update({ is_default: false })
        .eq('clerk_user_id', existing.clerk_user_id)
    }
  }

  const updateData: Record<string, unknown> = {}
  if (updates.skoolUsername !== undefined)
    updateData.skool_username = updates.skoolUsername
  if (updates.displayName !== undefined)
    updateData.display_name = updates.displayName
  if (updates.ghlUserId !== undefined) updateData.ghl_user_id = updates.ghlUserId
  if (updates.isDefault !== undefined) updateData.is_default = updates.isDefault
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive

  const { data, error } = await supabase
    .from('staff_users')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[Staff Users] Error updating staff user:', error)
    throw new Error(`Failed to update staff user: ${error.message}`)
  }

  return data
}

/**
 * Delete a staff user
 */
export async function deleteStaffUser(id: string): Promise<void> {
  const supabase = createServerClient()

  const { error } = await supabase.from('staff_users').delete().eq('id', id)

  if (error) {
    console.error('[Staff Users] Error deleting staff user:', error)
    throw new Error(`Failed to delete staff user: ${error.message}`)
  }
}

// =============================================================================
// ROUTING LOGIC
// =============================================================================

/**
 * Parse @staffname override from message text
 *
 * Format: "@username " at the start of the message
 * Returns the username (without @) and the remaining message
 */
export function parseStaffOverride(
  message: string
): { username: string; remainingMessage: string } | null {
  // Match @username at start followed by space and message
  // Use [\s\S] instead of . with 's' flag for cross-platform compatibility
  const match = message.match(/^@(\w+)\s+([\s\S]+)$/)
  if (!match) return null

  return {
    username: match[1].toLowerCase(),
    remainingMessage: match[2],
  }
}

/**
 * Resolve which staff user should send an outbound message
 *
 * Priority:
 * 1. @staffname override prefix in message
 * 2. GHL user mapping (who sent the message in GHL)
 * 3. Last conversation (who last talked to this contact in Skool)
 * 4. Default staff (fallback)
 */
export async function resolveOutboundStaff(
  userId: string,
  messageText: string,
  ghlUserId?: string,
  skoolContactId?: string
): Promise<{
  staff: ResolvedStaff | null
  processedMessage: string
}> {
  const supabase = createServerClient()

  // 1. Check for @staffname override
  const override = parseStaffOverride(messageText)
  if (override) {
    const { data: staffByUsername } = await supabase
      .from('staff_users')
      .select('*')
      .eq('clerk_user_id', userId)
      .ilike('skool_username', override.username)
      .eq('is_active', true)
      .single()

    if (staffByUsername) {
      return {
        staff: {
          skoolUserId: staffByUsername.skool_user_id,
          displayName: staffByUsername.display_name,
          ghlUserId: staffByUsername.ghl_user_id,
          matchMethod: 'override',
        },
        processedMessage: override.remainingMessage,
      }
    }
    // If override staff not found, continue with original message
    console.warn(
      `[Staff Users] Override @${override.username} not found, using fallback`
    )
  }

  // 2. Check GHL user mapping
  if (ghlUserId) {
    const staffByGhl = await getStaffByGhlUserId(userId, ghlUserId)
    if (staffByGhl) {
      return {
        staff: {
          skoolUserId: staffByGhl.skool_user_id,
          displayName: staffByGhl.display_name,
          ghlUserId: staffByGhl.ghl_user_id,
          matchMethod: 'ghl_user',
        },
        processedMessage: messageText,
      }
    }
  }

  // 3. Check last conversation with this contact
  if (skoolContactId) {
    const { data: lastMessage } = await supabase
      .from('dm_messages')
      .select('staff_skool_id, staff_display_name')
      .eq('clerk_user_id', userId)
      .eq('skool_user_id', skoolContactId)
      .not('staff_skool_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (lastMessage?.staff_skool_id) {
      // Verify this staff is still active
      const { data: staffFromHistory } = await supabase
        .from('staff_users')
        .select('*')
        .eq('skool_user_id', lastMessage.staff_skool_id)
        .eq('is_active', true)
        .single()

      if (staffFromHistory) {
        return {
          staff: {
            skoolUserId: staffFromHistory.skool_user_id,
            displayName: staffFromHistory.display_name,
            ghlUserId: staffFromHistory.ghl_user_id,
            matchMethod: 'last_conversation',
          },
          processedMessage: messageText,
        }
      }
    }
  }

  // 4. Fallback to default staff
  const defaultStaff = await getDefaultStaff(userId)
  if (defaultStaff) {
    return {
      staff: {
        skoolUserId: defaultStaff.skool_user_id,
        displayName: defaultStaff.display_name,
        ghlUserId: defaultStaff.ghl_user_id,
        matchMethod: 'default',
      },
      processedMessage: messageText,
    }
  }

  // No staff configured
  return {
    staff: null,
    processedMessage: messageText,
  }
}

// =============================================================================
// MESSAGE PREFIXES
// =============================================================================

/**
 * Format inbound message with staff attribution
 *
 * Format: "{ContactName} to {StaffName} (via Skool): {message}"
 */
export function formatInboundMessage(
  contactName: string,
  staffDisplayName: string,
  message: string
): string {
  return `${contactName} to ${staffDisplayName} (via Skool): ${message}`
}

/**
 * Format outbound message with staff attribution
 *
 * Format: "{StaffName} (via Skool): {message}"
 */
export function formatOutboundMessage(
  staffDisplayName: string,
  message: string
): string {
  return `${staffDisplayName} (via Skool): ${message}`
}

/**
 * Strip staff prefix from message if present
 *
 * Handles both inbound and outbound formats
 */
export function stripStaffPrefix(message: string): string {
  // Match outbound format: "Name (via Skool): message"
  // Use [\s\S] instead of . with 's' flag for cross-platform compatibility
  const outboundMatch = message.match(/^[^(]+\(via Skool\):\s*([\s\S]+)$/)
  if (outboundMatch) {
    return outboundMatch[1]
  }

  // Match inbound format: "Name to Name (via Skool): message"
  const inboundMatch = message.match(/^[^(]+to\s+[^(]+\(via Skool\):\s*([\s\S]+)$/)
  if (inboundMatch) {
    return inboundMatch[1]
  }

  return message
}
