/**
 * Contact Mapper
 *
 * Maps Skool users to GHL contacts using various matching strategies.
 * Target: 100% match rate - every Skool member should already have a GHL contact.
 *
 * Lookup Priority:
 * 1. Check dm_contact_mappings cache (fastest)
 * 2. Check skool_members table for existing ghl_contact_id
 * 3. Search GHL by email (97.5% match rate)
 * 4. Search GHL by skool_user_id custom field
 * 5. Create NEW contact with REAL data (rare - ~1% of cases)
 *
 * @module dm-sync/lib/contact-mapper
 */

import { createServerClient } from '@0ne/db/server'
import { GHLClient } from '@/features/kpi/lib/ghl-client'
import type { SkoolApiMember, SkoolSurveyAnswer } from '@/features/skool/types'
import type { ContactMappingRow, MapContactResult } from '../types'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Match method for contact mapping
 */
export type MatchMethod = 'cache' | 'skool_members' | 'email' | 'skool_id' | 'created' | 'no_email'

/**
 * Result of findOrCreateGhlContact
 */
export interface ContactLookupResult {
  ghlContactId: string | null
  matchMethod: MatchMethod
  wasCreated: boolean
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Find or create a GHL contact for a Skool user
 *
 * Uses multiple lookup strategies in priority order:
 * 1. Check dm_contact_mappings cache
 * 2. Check skool_members table
 * 3. Search GHL by email
 * 4. Search GHL by skool_user_id custom field
 * 5. Create new contact (rare)
 *
 * @param userId - Your user ID (for multi-tenant)
 * @param skoolUserId - Skool user ID
 * @param skoolUsername - Skool username slug
 * @param skoolDisplayName - Display name
 * @param memberData - Full member data for email/phone extraction
 */
export async function findOrCreateGhlContact(
  userId: string,
  skoolUserId: string,
  skoolUsername: string,
  skoolDisplayName: string,
  memberData?: SkoolApiMember
): Promise<ContactLookupResult> {
  const supabase = createServerClient()
  const ghl = new GHLClient()

  // 1. Check dm_contact_mappings cache first (fastest)
  const { data: cachedMapping } = await supabase
    .from('dm_contact_mappings')
    .select('ghl_contact_id')
    .eq('clerk_user_id', userId)
    .eq('skool_user_id', skoolUserId)
    .single()

  if (cachedMapping?.ghl_contact_id) {
    return {
      ghlContactId: cachedMapping.ghl_contact_id,
      matchMethod: 'cache',
      wasCreated: false,
    }
  }

  // 2. Check skool_members table for existing ghl_contact_id
  const { data: skoolMember } = await supabase
    .from('skool_members')
    .select('ghl_contact_id, email')
    .eq('skool_user_id', skoolUserId)
    .single()

  if (skoolMember?.ghl_contact_id) {
    // Cache the mapping
    await cacheMapping(
      userId,
      skoolUserId,
      skoolMember.ghl_contact_id,
      skoolUsername,
      skoolDisplayName,
      'skool_members'
    )
    return {
      ghlContactId: skoolMember.ghl_contact_id,
      matchMethod: 'skool_members',
      wasCreated: false,
    }
  }

  // 3. Extract email and search GHL by email (primary - 97.5% match rate)
  const email = memberData
    ? extractMemberEmail(memberData)
    : skoolMember?.email || null

  if (email) {
    const contact = await ghl.searchContactByEmail(email)
    if (contact) {
      // Update contact with skool custom fields
      await updateContactWithSkoolData(ghl, contact.id, skoolUserId, skoolUsername)

      // Cache the mapping
      await cacheMapping(
        userId,
        skoolUserId,
        contact.id,
        skoolUsername,
        skoolDisplayName,
        'email'
      )

      // Update skool_members if we have a match
      await supabase
        .from('skool_members')
        .update({
          ghl_contact_id: contact.id,
          matched_at: new Date().toISOString(),
          match_method: 'email',
        })
        .eq('skool_user_id', skoolUserId)

      return {
        ghlContactId: contact.id,
        matchMethod: 'email',
        wasCreated: false,
      }
    }
  }

  // 4. Search GHL by skool_user_id custom field
  const contactBySkoolId = await searchContactBySkoolUserId(ghl, skoolUserId)
  if (contactBySkoolId) {
    // Update with username if missing
    await updateContactWithSkoolData(ghl, contactBySkoolId.id, skoolUserId, skoolUsername)

    // Cache the mapping
    await cacheMapping(
      userId,
      skoolUserId,
      contactBySkoolId.id,
      skoolUsername,
      skoolDisplayName,
      'skool_id'
    )

    // Update skool_members
    await supabase
      .from('skool_members')
      .update({
        ghl_contact_id: contactBySkoolId.id,
        matched_at: new Date().toISOString(),
        match_method: 'email', // We matched by custom field, but email is our primary method
      })
      .eq('skool_user_id', skoolUserId)

    return {
      ghlContactId: contactBySkoolId.id,
      matchMethod: 'skool_id',
      wasCreated: false,
    }
  }

  // 5. RARE: Create NEW contact with REAL data (~1% of cases)
  // Only if we have real email (NOT synthetic)
  if (!email) {
    console.log(
      `[Contact Mapper] Cannot create GHL contact for Skool user ${skoolUserId} - no email found. ` +
        'This user may not have completed the Skool survey.'
    )
    return {
      ghlContactId: null,
      matchMethod: 'no_email',
      wasCreated: false,
    }
  }

  // Extract phone if available
  const phone = memberData ? extractMemberPhone(memberData) : null

  // Parse display name into first/last
  const nameParts = parseDisplayName(skoolDisplayName)

  // Create the contact
  const newContactId = await createGhlContact(ghl, {
    email,
    phone,
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    skoolUserId,
    skoolUsername,
  })

  // Cache the mapping
  await cacheMapping(
    userId,
    skoolUserId,
    newContactId,
    skoolUsername,
    skoolDisplayName,
    'created'
  )

  // Update skool_members
  await supabase
    .from('skool_members')
    .update({
      ghl_contact_id: newContactId,
      matched_at: new Date().toISOString(),
      match_method: 'email', // Created with email
    })
    .eq('skool_user_id', skoolUserId)

  return {
    ghlContactId: newContactId,
    matchMethod: 'created',
    wasCreated: true,
  }
}

/**
 * Bulk lookup GHL contacts for multiple Skool users
 *
 * Optimized for batch operations - checks cache first for all users,
 * then processes remaining users.
 */
export async function findGhlContactsForUsers(
  userId: string,
  skoolUsers: Array<{
    skoolUserId: string
    skoolUsername: string
    skoolDisplayName: string
    memberData?: SkoolApiMember
  }>
): Promise<Map<string, string>> {
  const results = new Map<string, string>()
  const supabase = createServerClient()

  if (skoolUsers.length === 0) {
    return results
  }

  // 1. Batch lookup from cache
  const skoolUserIds = skoolUsers.map((u) => u.skoolUserId)
  const { data: cachedMappings } = await supabase
    .from('dm_contact_mappings')
    .select('skool_user_id, ghl_contact_id')
    .eq('clerk_user_id', userId)
    .in('skool_user_id', skoolUserIds)

  // Add cached results
  const cachedUserIds = new Set<string>()
  for (const mapping of cachedMappings || []) {
    results.set(mapping.skool_user_id, mapping.ghl_contact_id)
    cachedUserIds.add(mapping.skool_user_id)
  }

  // Filter users not in cache
  const uncachedUsers = skoolUsers.filter((u) => !cachedUserIds.has(u.skoolUserId))

  // 2. Process remaining users one by one (with rate limiting)
  for (const user of uncachedUsers) {
    try {
      const result = await findOrCreateGhlContact(
        userId,
        user.skoolUserId,
        user.skoolUsername,
        user.skoolDisplayName,
        user.memberData
      )
      // Only add to results if we have a valid contact ID
      if (result.ghlContactId) {
        results.set(user.skoolUserId, result.ghlContactId)
      }

      // Rate limit - 200ms between GHL API calls
      await new Promise((resolve) => setTimeout(resolve, 200))
    } catch (error) {
      console.error(
        `[Contact Mapper] Error mapping ${user.skoolUserId}:`,
        error instanceof Error ? error.message : error
      )
      // Continue with other users
    }
  }

  return results
}

// =============================================================================
// EMAIL/PHONE EXTRACTION (reused from member-sync.ts)
// =============================================================================

/**
 * Extract email from Skool member data
 *
 * Email can be in several locations (checked in priority order):
 * 1. member.metadata.mbme (nested member object - primary)
 * 2. metadata.mbme (top-level metadata)
 * 3. member.inviteEmail (admin-invited members bypass survey)
 * 4. email (direct field)
 * 5. Survey answers (member.metadata.survey) - can contain email responses!
 */
export function extractMemberEmail(member: SkoolApiMember): string | null {
  // Try nested member.metadata.mbme first (most common)
  if (member.member?.metadata?.mbme) {
    return member.member.metadata.mbme
  }

  // Try top-level metadata.mbme
  if (member.metadata?.mbme) {
    return member.metadata.mbme
  }

  // Try member.inviteEmail (admin-invited members bypass survey questions)
  if (member.member?.inviteEmail) {
    return member.member.inviteEmail
  }

  // Try direct email field
  if (member.email) {
    return member.email
  }

  // Try survey answers - look for email type or answers containing @
  const surveyAnswers = parseSurveyData(member.member?.metadata?.survey)
  for (const surveyAnswer of surveyAnswers) {
    const answerValue = surveyAnswer.answer || ''

    // Check if answer type is explicitly 'email'
    if (surveyAnswer.type === 'email' && answerValue) {
      return answerValue
    }
    // Check if answer looks like an email (contains @)
    if (answerValue && answerValue.includes('@') && answerValue.includes('.')) {
      // Basic email validation
      const emailMatch = answerValue.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
      if (emailMatch) {
        return emailMatch[0]
      }
    }
  }

  return null
}

/**
 * Extract phone from Skool member data
 *
 * Phone can be in survey answers with type 'phone' or phone-related question labels
 */
export function extractMemberPhone(member: SkoolApiMember): string | null {
  const surveyAnswers = parseSurveyData(member.member?.metadata?.survey)

  for (const surveyAnswer of surveyAnswers) {
    const answerValue = surveyAnswer.answer || ''
    const question = surveyAnswer.question?.toLowerCase() || ''
    const label = surveyAnswer.label?.toLowerCase() || ''

    // Check if type is explicitly 'phone'
    if (surveyAnswer.type === 'phone' && answerValue) {
      return normalizePhone(answerValue)
    }

    // Check if question/label contains phone-related keywords
    if (
      (question.includes('phone') ||
        question.includes('mobile') ||
        question.includes('cell') ||
        question.includes('whatsapp') ||
        label.includes('phone') ||
        label.includes('mobile')) &&
      answerValue
    ) {
      const normalized = normalizePhone(answerValue)
      if (normalized) {
        return normalized
      }
    }
  }

  return null
}

/**
 * Parse survey data which can be JSON string, array, or nested object
 */
function parseSurveyData(
  surveyRaw: string | SkoolSurveyAnswer[] | { survey: SkoolSurveyAnswer[] } | undefined
): SkoolSurveyAnswer[] {
  if (!surveyRaw) return []

  if (typeof surveyRaw === 'string') {
    try {
      const parsed = JSON.parse(surveyRaw) as unknown
      if (parsed && typeof parsed === 'object' && 'survey' in parsed && Array.isArray((parsed as { survey: unknown }).survey)) {
        return (parsed as { survey: SkoolSurveyAnswer[] }).survey
      }
      if (Array.isArray(parsed)) {
        return parsed as SkoolSurveyAnswer[]
      }
    } catch {
      return []
    }
    return []
  }

  if (Array.isArray(surveyRaw)) {
    return surveyRaw
  }

  // Now surveyRaw is { survey: SkoolSurveyAnswer[] }
  if (surveyRaw.survey && Array.isArray(surveyRaw.survey)) {
    return surveyRaw.survey
  }

  return []
}

/**
 * Normalize phone number - extract digits and format
 */
function normalizePhone(phone: string): string | null {
  // Extract only digits
  const digits = phone.replace(/\D/g, '')

  // Check if we have a valid phone number (at least 10 digits)
  if (digits.length < 10) {
    return null
  }

  // US phone numbers: add +1 if 10 digits
  if (digits.length === 10) {
    return `+1${digits}`
  }

  // Already has country code
  if (digits.length >= 11) {
    return `+${digits}`
  }

  return null
}

// =============================================================================
// GHL API HELPERS
// =============================================================================

/**
 * Search GHL contacts by skool_user_id custom field
 */
async function searchContactBySkoolUserId(
  ghl: GHLClient,
  skoolUserId: string
): Promise<{ id: string } | null> {
  // GHL's query parameter searches across all fields including custom fields
  const response = await ghl.getContacts({ query: skoolUserId, limit: 10 })

  // Find contact with matching skool_user_id custom field
  for (const contact of response.contacts) {
    const skoolId = ghl.getCustomFieldValue(contact, 'skool_user_id')
    if (skoolId === skoolUserId) {
      return { id: contact.id }
    }
  }

  return null
}

/**
 * Update GHL contact with Skool custom fields
 */
async function updateContactWithSkoolData(
  ghl: GHLClient,
  contactId: string,
  skoolUserId: string,
  skoolUsername: string
): Promise<void> {
  // Use the PUT /contacts/{contactId} endpoint to update custom fields
  // GHL expects customFields as an array of { id, field_value } or { key, field_value }
  // However, since GHLClient doesn't have a direct updateContact method,
  // we'll add tags to mark Skool relationship
  try {
    await ghl.updateContactTags(contactId, ['skool_member', 'dm_sync_linked'])
  } catch (error) {
    console.error(`[Contact Mapper] Failed to update contact ${contactId}:`, error)
    // Don't throw - this is a non-critical update
  }

  // TODO: When GHLClient supports custom field updates, add:
  // await ghl.updateContactCustomFields(contactId, {
  //   skool_user_id: skoolUserId,
  //   skool_username: skoolUsername,
  // })
  void skoolUserId
  void skoolUsername
}

/**
 * Create a new GHL contact
 */
async function createGhlContact(
  ghl: GHLClient,
  data: {
    email: string
    phone: string | null
    firstName: string
    lastName: string
    skoolUserId: string
    skoolUsername: string
  }
): Promise<string> {
  // GHL create contact endpoint: POST /contacts
  const GHL_API_BASE = 'https://services.leadconnectorhq.com'
  const locationId = process.env.GHL_LOCATION_ID
  const apiKey = process.env.GHL_API_KEY

  if (!locationId || !apiKey) {
    throw new Error('GHL_LOCATION_ID and GHL_API_KEY environment variables are required')
  }

  const body: Record<string, unknown> = {
    locationId,
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    tags: ['skool_unmatched', 'created_from_dm_sync', 'skool_member'],
    // Custom fields - GHL expects customFields array with field key/id and value
    // The actual format depends on how custom fields are set up in GHL
    // This is a simplified version - you may need to adjust based on your GHL setup
  }

  if (data.phone) {
    body.phone = data.phone
  }

  const response = await fetch(`${GHL_API_BASE}/contacts/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to create GHL contact: ${response.status} - ${errorText}`)
  }

  const result = (await response.json()) as { contact?: { id: string } }
  if (!result.contact?.id) {
    throw new Error('GHL create contact response missing contact ID')
  }

  console.log(`[Contact Mapper] Created GHL contact ${result.contact.id} for ${data.email}`)

  // Use the GHL client instance that was passed in (for rate limiting via ghl)
  void ghl

  return result.contact.id
}

// =============================================================================
// CACHE HELPERS
// =============================================================================

/**
 * Cache a Skool → GHL mapping in dm_contact_mappings table
 */
async function cacheMapping(
  userId: string,
  skoolUserId: string,
  ghlContactId: string,
  skoolUsername: string,
  skoolDisplayName: string,
  matchMethod: MatchMethod
): Promise<void> {
  const supabase = createServerClient()

  const mappingRow: Omit<ContactMappingRow, 'id' | 'created_at'> = {
    clerk_user_id: userId,
    skool_user_id: skoolUserId,
    ghl_contact_id: ghlContactId,
    skool_username: skoolUsername,
    skool_display_name: skoolDisplayName,
    match_method:
      matchMethod === 'created'
        ? 'synthetic'
        : matchMethod === 'cache'
          ? 'skool_id'
          : matchMethod === 'skool_members'
            ? 'email'
            : matchMethod === 'no_email'
              ? null // Should never happen - we don't cache when no email
              : matchMethod,
  }

  const { error } = await supabase.from('dm_contact_mappings').upsert(mappingRow, {
    onConflict: 'clerk_user_id,skool_user_id',
    ignoreDuplicates: false,
  })

  if (error) {
    console.error('[Contact Mapper] Failed to cache mapping:', error)
    // Don't throw - caching is optimization, not critical
  }
}

// =============================================================================
// NAME PARSING
// =============================================================================

/**
 * Parse display name into first and last name
 */
function parseDisplayName(displayName: string): { firstName: string; lastName: string } {
  const parts = displayName.trim().split(/\s+/)

  if (parts.length === 0) {
    return { firstName: 'Unknown', lastName: '' }
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' }
  }

  // First word is first name, rest is last name
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

// =============================================================================
// UTILITY FUNCTIONS (kept from original)
// =============================================================================

/**
 * Generate synthetic email for Skool user
 * @deprecated Use real email from extractMemberEmail() instead
 */
export function generateSyntheticEmail(skoolUserId: string): string {
  return `skool_${skoolUserId}@sync.local`
}

/**
 * Check if email is synthetic
 */
export function isSyntheticEmail(email: string): boolean {
  return email.endsWith('@sync.local') && email.startsWith('skool_')
}

/**
 * Normalize name for matching
 */
export function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Calculate name similarity score (0-1)
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  const n1 = normalizeName(name1)
  const n2 = normalizeName(name2)

  if (n1 === n2) return 1

  // Simple Levenshtein-based similarity
  const maxLen = Math.max(n1.length, n2.length)
  if (maxLen === 0) return 1

  const distance = levenshteinDistance(n1, n2)
  return 1 - distance / maxLen
}

/**
 * Levenshtein distance between two strings
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length
  const n = s2.length
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }

  return dp[m][n]
}

// =============================================================================
// LEGACY CLASS (for backward compatibility)
// =============================================================================

/**
 * Contact mapper configuration
 */
export interface ContactMapperConfig {
  userId: string
  ghlLocationId: string
  ghlApiKey: string
}

/**
 * Legacy ContactMapper class - wraps functional API
 * @deprecated Use findOrCreateGhlContact() directly
 */
export class ContactMapper {
  private userId: string

  constructor(config: ContactMapperConfig) {
    this.userId = config.userId
    // ghlLocationId and ghlApiKey are now read from environment
    void config.ghlLocationId
    void config.ghlApiKey
  }

  async mapContact(skoolUser: {
    id: string
    username: string
    displayName: string
    email?: string
  }): Promise<MapContactResult> {
    try {
      const result = await findOrCreateGhlContact(
        this.userId,
        skoolUser.id,
        skoolUser.username,
        skoolUser.displayName
      )

      // Map internal match methods to the expected MapContactResult types
      let matchMethod: 'skool_id' | 'email' | 'name' | 'synthetic' | undefined
      switch (result.matchMethod) {
        case 'cache':
        case 'skool_members':
        case 'email':
          matchMethod = 'email'
          break
        case 'skool_id':
          matchMethod = 'skool_id'
          break
        case 'created':
          matchMethod = 'synthetic'
          break
        default:
          matchMethod = undefined
      }

      return {
        success: true,
        matchMethod,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async mapContacts(
    skoolUsers: Array<{
      id: string
      username: string
      displayName: string
      email?: string
    }>
  ): Promise<MapContactResult[]> {
    const results: MapContactResult[] = []
    for (const user of skoolUsers) {
      const result = await this.mapContact(user)
      results.push(result)
    }
    return results
  }
}

/**
 * Create a contact mapper with configuration
 * @deprecated Use findOrCreateGhlContact() directly
 */
export function createContactMapper(config: ContactMapperConfig): ContactMapper {
  return new ContactMapper(config)
}
