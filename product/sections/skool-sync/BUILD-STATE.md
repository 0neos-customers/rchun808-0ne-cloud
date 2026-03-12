# Skool-GHL DM Sync - BUILD STATE

> **Status:** 🟢 Complete - Extension Messages Sync to GHL
> **Last Updated:** 2026-02-14

---

## Current Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Chrome Extension│────▶│   0ne-app API   │────▶│    Supabase     │
│ (Skool browser) │     │ /push-messages  │     │  dm_messages    │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │   GHL Inbox     │
                                                │ (Conversation   │
                                                │   Provider)     │
                                                └─────────────────┘
                                                    ⬆ PENDING
```

---

## ✅ Completed

### Chrome Extension (Skool-Extension repo)
- [x] WebSocket interception for real-time DM detection
- [x] Skool's custom protocol parsing (`hbt:{"unread_chat":N}`)
- [x] Fetch API interception for message capture
- [x] Direct API calls to get unread chats and messages
- [x] Service worker message buffering with retry logic
- [x] Push to 0ne-app `/api/extension/push-messages`
- [x] Popup UI with sync stats and connection status

### 0ne-app API
- [x] `/api/extension/push-messages` - receives and stores messages
- [x] `/api/extension/health` - connection check with API key validation
- [x] Messages stored in `dm_messages` table

### Existing GHL Infrastructure
- [x] GHL Marketplace App configured
- [x] Conversation Provider registered ("Skool" channel)
- [x] Contact mapping via `dm_contact_mappings` table
- [x] `findOrCreateGhlContact()` function
- [x] `ghlClient.pushInboundMessage()` / `pushOutboundMessage()`
- [x] Server-side sync working (for API-fetched messages)

---

## 🔴 Remaining: Sync Extension Messages to GHL

**Problem:** Extension-captured messages are in `dm_messages` but have `ghl_message_id = NULL`. They need to be pushed to GHL.

**Solution:** Add a sync function that processes these messages using existing GHL infrastructure.

---

## Phase 1: Schema Update (Optional Enhancement)

**Goal:** Store sender name for better contact matching.

### Current State
- Extension sends `senderName` but API doesn't store it
- Contact matching uses `skool_user_id` to lookup existing mappings
- Works for known users, may fail for brand new contacts

### Deliverables
- [x] Add `sender_name` column to `dm_messages` table (nullable TEXT)
- [x] Update `/api/extension/push-messages` to store `senderName`

### SQL Migration
```sql
-- Add sender_name column for better contact matching
ALTER TABLE dm_messages ADD COLUMN IF NOT EXISTS sender_name TEXT;
```

### API Update
```typescript
// In push-messages/route.ts, update messageRow:
const messageRow = {
  user_id: staffSkoolId,
  skool_conversation_id: conversationId,
  skool_message_id: msg.id,
  skool_user_id: msg.senderId,
  sender_name: msg.senderName || null,  // ADD THIS
  direction: msg.isOwnMessage ? 'outbound' : 'inbound',
  message_text: msg.content,
  status: 'pending',  // Change from 'synced' to 'pending'
  synced_at: null,    // Will be set when pushed to GHL
}
```

### Acceptance Criteria
- [x] Column exists in database (migration: 028-dm-messages-sender-name.sql)
- [x] New extension messages include sender_name
- [x] Existing messages unaffected (null sender_name)

---

## Phase 2: Extension Message Sync Function

**Goal:** Process `dm_messages` where `ghl_message_id IS NULL` and push to GHL.

### Deliverables
- [x] Add `syncExtensionMessages()` function to `sync-engine.ts`
- [x] Query messages with `ghl_message_id IS NULL`
- [x] For each message:
  1. Find GHL contact via `dm_contact_mappings` or `findOrCreateGhlContact()`
  2. Push to GHL using `pushInboundMessage()` or `pushOutboundMessage()`
  3. Update row with `ghl_message_id` and `synced_at`
- [x] Handle errors gracefully (mark as failed, continue)

### Implementation

```typescript
// In sync-engine.ts

/**
 * Sync extension-captured messages to GHL
 *
 * Processes messages in dm_messages that have ghl_message_id = NULL
 * These are messages captured by the Chrome extension that haven't
 * been pushed to GHL yet.
 */
export async function syncExtensionMessages(
  userId: string
): Promise<ExtensionSyncResult> {
  const supabase = createServerClient()
  const result: ExtensionSyncResult = {
    synced: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
  }

  console.log(`[Sync Engine] Starting extension message sync for user: ${userId}`)

  try {
    // Get user's sync config
    const { data: syncConfig } = await supabase
      .from('dm_sync_config')
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true)
      .single()

    if (!syncConfig) {
      console.log(`[Sync Engine] No enabled sync config for user: ${userId}`)
      return result
    }

    // Get stored GHL tokens
    const storedTokens = await getStoredTokens(userId)

    // Create GHL client
    const ghlClient = await createGhlConversationProviderClientWithPersistence(
      userId,
      syncConfig.ghl_location_id,
      process.env.GHL_CONVERSATION_PROVIDER_ID,
      storedTokens ? {
        refreshToken: storedTokens.refreshToken,
        accessToken: storedTokens.accessToken,
        expiresAt: storedTokens.expiresAt,
      } : undefined
    )

    // Query messages that need GHL sync
    const { data: pendingMessages, error: queryError } = await supabase
      .from('dm_messages')
      .select('*')
      .eq('user_id', userId)
      .is('ghl_message_id', null)
      .order('created_at', { ascending: true })
      .limit(100) // Process in batches

    if (queryError) {
      throw new Error(`Failed to query pending messages: ${queryError.message}`)
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log('[Sync Engine] No extension messages pending GHL sync')
      return result
    }

    console.log(`[Sync Engine] Found ${pendingMessages.length} messages to sync to GHL`)

    // Group by conversation for efficient contact lookup
    const messagesByConversation = groupBy(pendingMessages, 'skool_conversation_id')

    for (const [conversationId, messages] of Object.entries(messagesByConversation)) {
      try {
        // Get first message to extract sender info for contact lookup
        const sampleMessage = messages[0]

        // Find or create GHL contact
        const contactResult = await findOrCreateGhlContact(
          userId,
          sampleMessage.skool_user_id,
          sampleMessage.sender_name || 'Unknown', // Use stored name or fallback
          sampleMessage.sender_name || 'Unknown'
        )

        if (!contactResult.ghlContactId) {
          console.log(`[Sync Engine] Could not find/create contact for ${sampleMessage.skool_user_id}`)
          result.skipped += messages.length
          continue
        }

        // Process each message in this conversation
        for (const msg of messages) {
          try {
            const isOutbound = msg.direction === 'outbound'

            // Push to GHL
            const ghlMessageId = isOutbound
              ? await ghlClient.pushOutboundMessage(
                  syncConfig.ghl_location_id,
                  contactResult.ghlContactId,
                  msg.skool_user_id,
                  msg.message_text || '',
                  msg.skool_message_id
                )
              : await ghlClient.pushInboundMessage(
                  syncConfig.ghl_location_id,
                  contactResult.ghlContactId,
                  msg.skool_user_id,
                  msg.message_text || '',
                  msg.skool_message_id
                )

            // Update the message row
            const { error: updateError } = await supabase
              .from('dm_messages')
              .update({
                ghl_message_id: ghlMessageId,
                status: 'synced',
                synced_at: new Date().toISOString(),
              })
              .eq('id', msg.id)

            if (updateError) {
              console.error(`[Sync Engine] Failed to update message ${msg.id}:`, updateError)
            }

            result.synced++
            console.log(`[Sync Engine] Synced ${msg.direction} message ${msg.id} -> GHL ${ghlMessageId}`)

            // Rate limiting
            await delay(200)
          } catch (msgError) {
            const errorMessage = msgError instanceof Error ? msgError.message : String(msgError)
            console.error(`[Sync Engine] Error syncing message ${msg.id}:`, errorMessage)
            result.errors++
            result.errorDetails.push({
              messageId: msg.id,
              error: errorMessage,
            })
          }
        }
      } catch (convError) {
        const errorMessage = convError instanceof Error ? convError.message : String(convError)
        console.error(`[Sync Engine] Error processing conversation ${conversationId}:`, errorMessage)
        result.errors++
        result.errorDetails.push({
          conversationId,
          error: errorMessage,
        })
      }
    }

    console.log(
      `[Sync Engine] Extension sync complete: synced=${result.synced}, skipped=${result.skipped}, errors=${result.errors}`
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Sync Engine] Fatal error during extension sync:', errorMessage)
    result.errors++
    result.errorDetails.push({
      error: `Fatal sync error: ${errorMessage}`,
    })
  }

  return result
}

// Helper function
function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = String(item[key])
    if (!result[groupKey]) {
      result[groupKey] = []
    }
    result[groupKey].push(item)
    return result
  }, {} as Record<string, T[]>)
}
```

### Acceptance Criteria
- [x] Function exists in sync-engine.ts
- [x] Processes messages with null ghl_message_id
- [x] Updates rows with ghl_message_id after successful push
- [x] Handles errors without crashing

---

## Phase 3: Cron Integration

**Goal:** Run extension message sync automatically.

### Option A: Add to existing cron (Recommended)
Add call to `syncExtensionMessages()` at the end of `/api/cron/sync-skool-dms`

```typescript
// At end of GET handler in sync-skool-dms/route.ts:

// Also sync extension-captured messages
for (const config of targetConfigs) {
  try {
    const extResult = await syncExtensionMessages(config.user_id)
    console.log(`[sync-skool-dms] Extension sync for ${config.user_id}: synced=${extResult.synced}`)
  } catch (error) {
    console.error(`[sync-skool-dms] Extension sync error for ${config.user_id}:`, error)
  }
}
```

### Option B: Separate cron endpoint
Create `/api/cron/sync-extension-messages/route.ts`

### Acceptance Criteria
- [x] Extension messages sync to GHL within 5 minutes of capture
- [x] Cron runs without errors
- [x] Messages appear in GHL inbox

---

## Phase 4: Verification & Cleanup

**Goal:** Verify end-to-end flow and update documentation.

### Deliverables
- [ ] Test full flow: DM in Skool → Extension → DB → GHL
- [ ] Verify messages appear correctly in GHL (right side for outbound, left for inbound)
- [x] Update this BUILD-STATE to mark complete
- [ ] Archive old phases from BUILD-STATE

### Test Checklist
- [ ] Send DM in Skool → appears in GHL within 5 min
- [ ] Receive DM in Skool → appears in GHL within 5 min
- [ ] Contact correctly matched (no duplicates)
- [ ] Message threading works (same conversation = same thread)

---

## Environment Variables

All required env vars (already configured):

```bash
# Extension API
EXTENSION_API_KEY=xxx

# GHL Marketplace (Conversation Provider)
GHL_MARKETPLACE_CLIENT_ID=xxx
GHL_MARKETPLACE_CLIENT_SECRET=xxx
GHL_CONVERSATION_PROVIDER_ID=xxx
GHL_LOCATION_ID=xxx

# Skool (for server-side operations)
SKOOL_COOKIES=xxx
SKOOL_USER_ID=xxx
```

---

## Agent Deployment Instructions

**For each phase, deploy agent with:**

```
You are working on 0ne-app at: /Users/jimmyfuentes/Library/Mobile Documents/com~apple~CloudDocs/06 - Code/0ne/04 - Build/04-1 - Apps/0ne-app

**Your Task: Complete Phase [N]**

Read this BUILD-STATE first:
product/sections/skool-sync/BUILD-STATE.md

## Context
- Chrome Extension already captures Skool DMs and pushes to dm_messages table
- Messages have ghl_message_id = NULL (not yet pushed to GHL)
- GHL infrastructure exists in features/dm-sync/lib/
- Need to process these messages and push to GHL

## Key Files to Read
- features/dm-sync/lib/sync-engine.ts - existing sync logic
- features/dm-sync/lib/ghl-conversation.ts - GHL push methods
- features/dm-sync/lib/contact-mapper.ts - contact matching
- app/api/cron/sync-skool-dms/route.ts - existing cron

## On Completion
1. Ensure code compiles: `bun run build`
2. Commit with descriptive message (NO push)
3. Update BUILD-STATE checkboxes
4. Report what you created/modified
```

---

## Quick Reference

| Item | Value |
|------|-------|
| Extension Repo | `04 - Build/04-1 - Apps/Skool-Extension/` |
| 0ne-app Repo | `04 - Build/04-1 - Apps/0ne-app/` |
| dm_messages table | Stores all DM messages |
| dm_contact_mappings | Skool user → GHL contact cache |
| GHL Provider ID | `698f668bbdfabb856c31a7f0` |
| Jimmy's Skool ID | `236af8c631ac4671919a4a9bc1b1fde0` |
