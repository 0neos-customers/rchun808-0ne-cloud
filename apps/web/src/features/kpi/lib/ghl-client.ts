/**
 * GoHighLevel API Client
 * Documentation: https://highlevel.stoplight.io/docs/integrations/
 */

import { FUNNEL_STAGE_ORDER, type FunnelStage } from './config'

const GHL_API_BASE = 'https://services.leadconnectorhq.com'

interface GHLContact {
  id: string
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  tags?: string[]
  customFields?: Array<{ id: string; key: string; value: unknown }>
  dateAdded?: string
  dateUpdated?: string
}

interface GHLContactsResponse {
  contacts: GHLContact[]
  meta?: {
    total?: number
    startAfter?: number
    startAfterId?: string
    currentPage?: number
    nextPage?: number
  }
}

// =============================================================================
// PAYMENTS API TYPES
// =============================================================================

export interface GHLTransaction {
  _id: string
  altId: string
  altType: string
  contactId?: string
  contactName?: string
  contactEmail?: string
  currency: string
  amount: number
  status: 'succeeded' | 'pending' | 'failed' | 'refunded'
  liveMode: boolean
  entityType: string
  entityId?: string
  entitySourceType?: string
  entitySourceId?: string
  entitySourceName?: string
  subscriptionId?: string
  chargeId?: string
  paymentProviderType?: string
  createdAt: string
  updatedAt: string
  meta?: {
    paymentMethod?: string
    invoiceId?: string
    invoiceNumber?: string
  }
}

export interface GHLTransactionsResponse {
  data: GHLTransaction[]
  totalCount?: number
  startAfterId?: string
}

export interface GHLInvoice {
  _id: string
  invoiceNumber?: string
  name?: string
  businessDetails?: {
    name?: string
    email?: string
    phone?: string
  }
  currency: string
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'partially-paid' | 'void'
  total: number
  amountDue: number
  amountPaid: number
  contactDetails?: {
    id?: string
    name?: string
    email?: string
    phone?: string
  }
  issueDate?: string
  dueDate?: string
  items?: Array<{
    name: string
    description?: string
    quantity: number
    price: number
    amount: number
  }>
  createdAt: string
  updatedAt: string
}

export interface GHLInvoicesResponse {
  invoices: GHLInvoice[]
  total?: number
}

export class GHLClient {
  private apiKey: string
  private locationId: string

  constructor(apiKey?: string, locationId?: string) {
    this.apiKey = apiKey || process.env.GHL_API_KEY || ''
    this.locationId = locationId || process.env.GHL_LOCATION_ID || ''

    if (!this.apiKey || !this.locationId) {
      console.warn('GHL client initialized without credentials')
    }
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${GHL_API_BASE}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Version: '2021-07-28',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`GHL API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  async getContacts(params?: {
    limit?: number
    startAfterId?: string
    startAfter?: number
    query?: string
  }): Promise<GHLContactsResponse> {
    const searchParams = new URLSearchParams({
      locationId: this.locationId,
      limit: String(params?.limit || 100),
    })

    // GHL pagination requires BOTH startAfterId and startAfter
    if (params?.startAfterId) {
      searchParams.set('startAfterId', params.startAfterId)
    }
    if (params?.startAfter) {
      searchParams.set('startAfter', String(params.startAfter))
    }
    if (params?.query) {
      searchParams.set('query', params.query)
    }

    return this.request<GHLContactsResponse>(
      `/contacts/?${searchParams.toString()}`
    )
  }

  async getContact(contactId: string): Promise<{ contact: GHLContact }> {
    return this.request<{ contact: GHLContact }>(`/contacts/${contactId}`)
  }

  async getAllContacts(limit = 100, maxContacts?: number): Promise<GHLContact[]> {
    const allContacts: GHLContact[] = []
    let startAfterId: string | undefined
    let startAfter: number | undefined
    let hasMore = true

    while (hasMore) {
      const response = await this.getContacts({ limit, startAfterId, startAfter })
      allContacts.push(...response.contacts)

      // Check if we've reached the max limit
      if (maxContacts && allContacts.length >= maxContacts) {
        return allContacts.slice(0, maxContacts)
      }

      if (response.contacts.length < limit) {
        hasMore = false
      } else {
        // GHL pagination requires BOTH startAfterId AND startAfter
        startAfterId = response.meta?.startAfterId
        startAfter = response.meta?.startAfter
        if (!startAfterId || !startAfter) hasMore = false
      }
    }

    return allContacts
  }

  async getContactsByTag(tag: string, limit = 100): Promise<GHLContact[]> {
    const allContacts: GHLContact[] = []
    let startAfterId: string | undefined
    let startAfter: number | undefined
    let hasMore = true

    while (hasMore) {
      const response = await this.getContacts({ limit, startAfterId, startAfter, query: tag })
      const contactsWithTag = response.contacts.filter((c) =>
        c.tags?.some((t) => t.toLowerCase() === tag.toLowerCase())
      )
      allContacts.push(...contactsWithTag)

      if (response.contacts.length < limit) {
        hasMore = false
      } else {
        startAfterId = response.meta?.startAfterId
        startAfter = response.meta?.startAfter
        if (!startAfterId || !startAfter) hasMore = false
      }
    }

    return allContacts
  }

  async getContactsUpdatedSince(since: Date): Promise<GHLContact[]> {
    const allContacts: GHLContact[] = []
    let startAfterId: string | undefined
    let startAfter: number | undefined
    let hasMore = true
    let staleContactsFound = false

    while (hasMore && !staleContactsFound) {
      const response = await this.getContacts({ limit: 100, startAfterId, startAfter })

      for (const contact of response.contacts) {
        const updatedAt = contact.dateUpdated
          ? new Date(contact.dateUpdated)
          : null
        if (updatedAt && updatedAt >= since) {
          allContacts.push(contact)
        } else if (updatedAt && updatedAt < since) {
          // If we find a contact older than our threshold, we can stop
          // (assuming contacts are returned in descending update order)
          staleContactsFound = true
        }
      }

      if (response.contacts.length < 100) {
        hasMore = false
      } else {
        startAfterId = response.meta?.startAfterId
        startAfter = response.meta?.startAfter
        if (!startAfterId || !startAfter) hasMore = false
      }
    }

    return allContacts
  }

  getCustomFieldValue(contact: GHLContact, fieldKey: string): unknown {
    const field = contact.customFields?.find((f) => f.key === fieldKey)
    return field?.value
  }

  /**
   * Maps contact tags to their highest funnel stage.
   * Uses FUNNEL_STAGE_ORDER from config (highest value first).
   */
  mapTagsToStage(
    tags: string[],
    tagMappings: Record<FunnelStage, string[]>
  ): FunnelStage | null {
    // FUNNEL_STAGE_ORDER is already sorted from highest to lowest
    // e.g., ['premium', 'vip', 'offer_seen', 'offer_made', 'qualified_vip', 'qualified_premium', 'hand_raiser', 'member']
    for (const stage of FUNNEL_STAGE_ORDER) {
      const stageTags = tagMappings[stage] || []
      // Case-insensitive matching
      if (tags.some((t) => stageTags.some((st) => t.toLowerCase().includes(st.toLowerCase())))) {
        return stage
      }
    }

    return null
  }

  /**
   * Maps contact tags to ALL matching funnel stages.
   * Unlike mapTagsToStage which returns only the highest,
   * this returns every stage the contact has a tag for.
   * Tags accumulate as contacts progress through the funnel.
   */
  mapTagsToAllStages(
    tags: string[],
    tagMappings: Record<FunnelStage, string[]>
  ): FunnelStage[] {
    const matchedStages: FunnelStage[] = []

    for (const stage of FUNNEL_STAGE_ORDER) {
      const stageTags = tagMappings[stage] || []
      // Case-insensitive matching
      if (tags.some((t) => stageTags.some((st) => t.toLowerCase().includes(st.toLowerCase())))) {
        matchedStages.push(stage)
      }
    }

    return matchedStages
  }

  /**
   * Update a contact's tags (add or remove)
   */
  async updateContactTags(
    contactId: string,
    tagsToAdd?: string[],
    tagsToRemove?: string[]
  ): Promise<{ contact: GHLContact }> {
    const body: { tags?: string[]; removeTags?: string[] } = {}
    if (tagsToAdd?.length) body.tags = tagsToAdd
    if (tagsToRemove?.length) body.removeTags = tagsToRemove

    return this.request<{ contact: GHLContact }>(`/contacts/${contactId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  }

  /**
   * Search for a contact by email
   */
  async searchContactByEmail(email: string): Promise<GHLContact | null> {
    const response = await this.getContacts({ query: email, limit: 10 })
    // Find exact email match (query is fuzzy)
    const match = response.contacts.find(
      (c) => c.email?.toLowerCase() === email.toLowerCase()
    )
    return match || null
  }

  /**
   * Search for a contact by phone number.
   * Compares last 10 digits to handle format differences (+1, parentheses, etc.)
   */
  async searchContactByPhone(phone: string): Promise<GHLContact | null> {
    const response = await this.getContacts({ query: phone, limit: 10 })
    const normalizedInput = phone.replace(/\D/g, '').slice(-10)
    const match = response.contacts.find((c) => {
      if (!c.phone) return false
      const normalizedContact = c.phone.replace(/\D/g, '').slice(-10)
      return normalizedContact === normalizedInput && normalizedInput.length === 10
    })
    return match || null
  }

  /**
   * Create a new contact in GHL.
   * Returns the created contact.
   */
  async createContact(data: {
    email?: string
    phone?: string
    firstName?: string
    lastName?: string
    tags?: string[]
    customFields?: Array<{ key: string; field_value: string }>
  }): Promise<GHLContact> {
    const body: Record<string, unknown> = {
      locationId: this.locationId,
    }
    if (data.email) body.email = data.email
    if (data.phone) body.phone = data.phone
    if (data.firstName) body.firstName = data.firstName
    if (data.lastName) body.lastName = data.lastName
    if (data.tags?.length) body.tags = data.tags
    if (data.customFields?.length) body.customFields = data.customFields

    const response = await this.request<{ contact: GHLContact }>('/contacts/', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    return response.contact
  }

  // ===========================================================================
  // PAYMENTS API METHODS
  // ===========================================================================

  /**
   * Get payment transactions
   * Docs: https://highlevel.stoplight.io/docs/integrations/3f1c1b8f72850-list-transactions
   * Note: Uses offset-based pagination (not cursor-based like contacts)
   */
  async getTransactions(params?: {
    limit?: number
    offset?: number
    contactId?: string
    startDate?: string
    endDate?: string
    status?: 'succeeded' | 'pending' | 'failed' | 'refunded'
    entitySourceType?: string
  }): Promise<GHLTransactionsResponse> {
    const searchParams = new URLSearchParams({
      altId: this.locationId,
      altType: 'location',
      limit: String(params?.limit || 100),
    })

    if (params?.offset) {
      searchParams.set('offset', String(params.offset))
    }
    if (params?.contactId) {
      searchParams.set('contactId', params.contactId)
    }
    if (params?.startDate) {
      searchParams.set('startAt', params.startDate)
    }
    if (params?.endDate) {
      searchParams.set('endAt', params.endDate)
    }
    if (params?.status) {
      searchParams.set('status', params.status)
    }
    if (params?.entitySourceType) {
      searchParams.set('entitySourceType', params.entitySourceType)
    }

    return this.request<GHLTransactionsResponse>(
      `/payments/transactions?${searchParams.toString()}`
    )
  }

  /**
   * Get all transactions with offset-based pagination
   */
  async getAllTransactions(params?: {
    startDate?: string
    endDate?: string
    status?: 'succeeded' | 'pending' | 'failed' | 'refunded'
    maxTransactions?: number
  }): Promise<GHLTransaction[]> {
    const allTransactions: GHLTransaction[] = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const response = await this.getTransactions({
        limit: 100,
        offset,
        startDate: params?.startDate,
        endDate: params?.endDate,
        status: params?.status,
      })

      allTransactions.push(...response.data)

      // Check max limit
      if (params?.maxTransactions && allTransactions.length >= params.maxTransactions) {
        return allTransactions.slice(0, params.maxTransactions)
      }

      if (response.data.length < 100) {
        hasMore = false
      } else {
        offset += 100
      }
    }

    return allTransactions
  }

  /**
   * Get invoices
   * Docs: https://highlevel.stoplight.io/docs/integrations/e66e7c0c80c28-list-invoices
   */
  async getInvoices(params?: {
    limit?: number
    offset?: number
    status?: 'draft' | 'sent' | 'viewed' | 'paid' | 'partially-paid' | 'void'
    contactId?: string
    startDate?: string
    endDate?: string
  }): Promise<GHLInvoicesResponse> {
    const searchParams = new URLSearchParams({
      altId: this.locationId,
      altType: 'location',
      limit: String(params?.limit || 100),
      offset: String(params?.offset || 0),
    })

    if (params?.status) {
      searchParams.set('status', params.status)
    }
    if (params?.contactId) {
      searchParams.set('contactId', params.contactId)
    }
    if (params?.startDate) {
      searchParams.set('startAt', params.startDate)
    }
    if (params?.endDate) {
      searchParams.set('endAt', params.endDate)
    }

    return this.request<GHLInvoicesResponse>(
      `/payments/invoices?${searchParams.toString()}`
    )
  }

  /**
   * Get all paid invoices with pagination
   */
  async getAllPaidInvoices(params?: {
    startDate?: string
    endDate?: string
    maxInvoices?: number
  }): Promise<GHLInvoice[]> {
    const allInvoices: GHLInvoice[] = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const response = await this.getInvoices({
        limit: 100,
        offset,
        status: 'paid',
        startDate: params?.startDate,
        endDate: params?.endDate,
      })

      allInvoices.push(...response.invoices)

      // Check max limit
      if (params?.maxInvoices && allInvoices.length >= params.maxInvoices) {
        return allInvoices.slice(0, params.maxInvoices)
      }

      if (response.invoices.length < 100) {
        hasMore = false
      } else {
        offset += 100
      }
    }

    return allInvoices
  }

  // ===========================================================================
  // MESSAGING API METHODS
  // ===========================================================================

  /**
   * Send an email via GHL Conversations API
   * Docs: https://highlevel.stoplight.io/docs/integrations/1739a3c8e4e1f-send-a-new-message
   */
  async sendEmail(params: {
    contactId: string
    subject: string
    body: string
    html?: string
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await this.request<{
        messageId?: string
        message?: { id: string }
      }>('/conversations/messages', {
        method: 'POST',
        body: JSON.stringify({
          type: 'Email',
          contactId: params.contactId,
          subject: params.subject,
          message: params.body,
          html: params.html || params.body,
        }),
      })

      return {
        success: true,
        messageId: response.messageId || response.message?.id,
      }
    } catch (error) {
      console.error('[GHL] Email send failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      }
    }
  }

  /**
   * Send an SMS via GHL Conversations API
   * Docs: https://highlevel.stoplight.io/docs/integrations/1739a3c8e4e1f-send-a-new-message
   */
  async sendSMS(params: {
    contactId: string
    message: string
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await this.request<{
        messageId?: string
        message?: { id: string }
      }>('/conversations/messages', {
        method: 'POST',
        body: JSON.stringify({
          type: 'SMS',
          contactId: params.contactId,
          message: params.message,
        }),
      })

      return {
        success: true,
        messageId: response.messageId || response.message?.id,
      }
    } catch (error) {
      console.error('[GHL] SMS send failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send SMS',
      }
    }
  }
}

export const ghlClient = new GHLClient()
