import { NextResponse } from 'next/server'
import { db, rawSql } from '@0ne/db/server'
import { contacts } from '@0ne/db/server'
import { GHLClient } from '@/features/kpi/lib/ghl-client'
import {
  TAG_MAPPINGS,
  CREDIT_STATUS_TAGS,
  EXCLUDE_TAGS,
  CUSTOM_FIELD_KEYS,
} from '@/features/kpi/lib/config'
import { SyncLogger } from '@/lib/sync-log'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const fullSync = searchParams.get('full') === 'true'
  const maxContacts = parseInt(searchParams.get('limit') || '0') || undefined

  // Start sync logging
  const syncLog = new SyncLogger('ghl_contacts')
  await syncLog.start({ mode: fullSync ? 'full' : 'incremental', maxContacts })

  try {
    const ghl = new GHLClient()

    // Full sync: get ALL contacts; Regular sync: last 2 hours
    let allContacts
    if (fullSync) {
      allContacts = await ghl.getAllContacts(100, maxContacts)
    } else {
      const since = new Date(Date.now() - 2 * 60 * 60 * 1000)
      allContacts = await ghl.getContactsUpdatedSince(since)
    }

    let synced = 0
    let errors = 0
    let skipped = 0

    // Batch process for efficiency
    const BATCH_SIZE = 50
    const contactsToUpsert: Array<{
      ghlContactId: string
      email: string | null
      phone: string | null
      firstName: string | null
      lastName: string | null
      currentStage: string
      stages: string[]
      creditStatus: string
      leadAge: number
      clientAge: number
      updatedAt: Date
    }> = []

    for (const contact of allContacts) {
      try {
        const tags = (contact.tags || []).map((t) => t.toLowerCase())
        // Get ALL stages this contact has tags for (tags accumulate)
        const allStages = ghl.mapTagsToAllStages(tags, TAG_MAPPINGS)
        // Primary stage = furthest in funnel (first in allStages since FUNNEL_STAGE_ORDER is highest first)
        const stage = allStages[0] || null

        // NOTE: Previously excluded churned/refunded contacts, but Jimmy wants to match GHL exactly
        // Churned contacts still count in their historical funnel stages
        // To exclude churned again, uncomment below:
        // if (tags.some((t) => EXCLUDE_TAGS.some((ex) => t.includes(ex.toLowerCase())))) {
        //   skipped++
        //   continue
        // }

        // Check if contact has Skool registration tag (for matching purposes)
        const hasSkoolTag = tags.some((t) => t.includes('skool - completed registration'))

        // Skip contacts not in funnel AND without Skool tag (cold prospects)
        if (allStages.length === 0 && !hasSkoolTag) {
          skipped++
          continue
        }

        // If they have Skool tag but no funnel stage, default to 'member'
        const effectiveStage = stage || (hasSkoolTag ? 'member' : null)
        const effectiveStages = allStages.length > 0 ? allStages : (hasSkoolTag ? ['member'] : [])

        let creditStatus = 'unknown'
        if (tags.some((t) => CREDIT_STATUS_TAGS.good.some((g) => t.includes(g.toLowerCase())))) {
          creditStatus = 'good'
        } else if (tags.some((t) => CREDIT_STATUS_TAGS.bad.some((b) => t.includes(b.toLowerCase())))) {
          creditStatus = 'bad'
        }

        const leadAge = ghl.getCustomFieldValue(contact, CUSTOM_FIELD_KEYS.leadAge) as number
        const clientAge = ghl.getCustomFieldValue(contact, CUSTOM_FIELD_KEYS.clientAge) as number

        contactsToUpsert.push({
          ghlContactId: contact.id,
          email: contact.email || null,
          phone: contact.phone || null,
          firstName: contact.firstName || null,
          lastName: contact.lastName || null,
          currentStage: effectiveStage!,
          stages: effectiveStages,
          creditStatus: creditStatus,
          leadAge: leadAge || 0,
          clientAge: clientAge || 0,
          updatedAt: new Date(),
        })

        // Batch upsert every BATCH_SIZE contacts
        if (contactsToUpsert.length >= BATCH_SIZE) {
          const batchToInsert = [...contactsToUpsert] // Copy for debugging
          try {
            const data = await db
              .insert(contacts)
              .values(contactsToUpsert)
              .onConflictDoUpdate({
                target: [contacts.ghlContactId],
                set: {
                  email: rawSql`excluded."email"`,
                  phone: rawSql`excluded."phone"`,
                  firstName: rawSql`excluded."first_name"`,
                  lastName: rawSql`excluded."last_name"`,
                  currentStage: rawSql`excluded."current_stage"`,
                  stages: rawSql`excluded."stages"`,
                  creditStatus: rawSql`excluded."credit_status"`,
                  leadAge: rawSql`excluded."lead_age"`,
                  clientAge: rawSql`excluded."client_age"`,
                  updatedAt: rawSql`now()`,
                },
              })
              .returning({ id: contacts.id })

            const insertedCount = data.length
            synced += insertedCount
            console.log(`Batch upserted: ${insertedCount}/${batchToInsert.length}`)
          } catch (batchError) {
            console.error('Batch upsert error:', batchError, 'First contact in batch:', batchToInsert[0]?.ghlContactId)
            errors += contactsToUpsert.length
          }
          contactsToUpsert.length = 0 // Clear batch

          // Log progress for large syncs
          if (fullSync && synced % 500 === 0) {
            console.log(`Sync progress: ${synced}/${allContacts.length}`)
          }
        }
      } catch (contactError) {
        console.error(`Error processing contact ${contact.id}:`, contactError)
        errors++
      }
    }

    // Upsert remaining contacts
    if (contactsToUpsert.length > 0) {
      try {
        const data = await db
          .insert(contacts)
          .values(contactsToUpsert)
          .onConflictDoUpdate({
            target: [contacts.ghlContactId],
            set: {
              email: rawSql`excluded."email"`,
              phone: rawSql`excluded."phone"`,
              firstName: rawSql`excluded."first_name"`,
              lastName: rawSql`excluded."last_name"`,
              currentStage: rawSql`excluded."current_stage"`,
              stages: rawSql`excluded."stages"`,
              creditStatus: rawSql`excluded."credit_status"`,
              leadAge: rawSql`excluded."lead_age"`,
              clientAge: rawSql`excluded."client_age"`,
              updatedAt: rawSql`now()`,
            },
          })
          .returning({ id: contacts.id })

        const insertedCount = data.length
        synced += insertedCount
        console.log(`Final batch upserted: ${insertedCount}/${contactsToUpsert.length}`)
      } catch (batchError) {
        console.error('Final batch upsert error:', batchError)
        errors += contactsToUpsert.length
      }
    }

    // Complete sync logging
    await syncLog.complete(synced, { skipped, errors, total: allContacts.length })

    return NextResponse.json({
      success: true,
      synced,
      skipped,
      errors,
      total: allContacts.length,
      mode: fullSync ? 'full' : 'incremental',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Sync error:', error)
    // Log sync failure
    await syncLog.fail(String(error))
    return NextResponse.json(
      { error: 'Sync failed', details: String(error) },
      { status: 500 }
    )
  }
}
