# Skool Inbox - BUILD-STATE

> **Status:** Complete
> **Created:** 2026-02-16
> **Completed:** 2026-02-16

---

## Summary

iMessage-style inbox UI in 0ne-app for viewing and responding to Skool DM conversations. Messages sent from inbox route through the Chrome extension for Skool delivery, then sync to GHL conversation view.

---

## Architecture

### Data Flow (Read)
```
dm_messages (existing table)
       │
       ▼
GET /api/dm-sync/conversations
  → Groups by skool_conversation_id
  → Returns: participant, last message, counts
       │
       ▼
ConversationList → click → ConversationDetail
```

### Data Flow (Send)
```
User types message in inbox
       │
       ▼
POST /api/dm-sync/conversations/[id]/send
  → Insert dm_messages: status='pending', direction='outbound'
       │
       ▼
Extension polls GET /api/extension/get-pending
  → Picks up pending outbound message
       │
       ▼
Extension sends via Skool UI
       │
       ▼
POST /api/extension/confirm-sent
  → Updates status='synced'
       │
       ▼
Cron: sync-skool-dms
  → Pushes to GHL conversation
```

---

## Completed Phases

### Phase 1: API - List Conversations ✅
- [x] Created `GET /api/dm-sync/conversations`
- [x] Groups messages by conversation_id
- [x] Returns participant info, last message, counts
- [x] Search and status filtering
- [x] Pagination support

### Phase 2: API - Conversation Detail ✅
- [x] Created `GET /api/dm-sync/conversations/[id]`
- [x] Returns all messages chronologically
- [x] Includes participant with GHL contact link
- [x] Pagination for history

### Phase 3: API - Send Message ✅
- [x] Created `POST /api/dm-sync/conversations/[id]/send`
- [x] Inserts pending outbound message
- [x] Generates synthetic message ID
- [x] Extension picks up via existing get-pending flow

### Phase 4: Hooks + Types ✅
- [x] Created `useConversations` hook
- [x] Created `useConversationDetail` hook
- [x] Added conversation types to types.ts
- [x] Exported from index.ts

### Phase 5: UI - ConversationList ✅
- [x] Search input with debounce
- [x] Status filter tabs (All, Pending, Synced)
- [x] Scrollable conversation list
- [x] ConversationItem with avatar, preview, badge

### Phase 6: UI - ConversationDetail + MessageBubble ✅
- [x] Header with participant info and external links
- [x] Message thread with auto-scroll
- [x] MessageBubble with direction-aware styling
- [x] Input with send button
- [x] Status indicators (synced, pending, failed)

### Phase 7: UI - Inbox Page ✅
- [x] Two-panel layout
- [x] ConversationList on left (w-80)
- [x] ConversationDetail on right (flex-1)
- [x] Empty state when no selection
- [x] Staff Skool ID fetched from settings

### Phase 8: Navigation + Polish ✅
- [x] Added Inbox to skool-sync navigation (first item)
- [x] Components exported from index.ts
- [x] TypeScript passes

---

## Files Created/Modified

| File | Action |
|------|--------|
| `apps/web/src/app/api/dm-sync/conversations/route.ts` | Created |
| `apps/web/src/app/api/dm-sync/conversations/[id]/route.ts` | Created |
| `apps/web/src/app/api/dm-sync/conversations/[id]/send/route.ts` | Created |
| `apps/web/src/features/dm-sync/hooks/use-conversations.ts` | Created |
| `apps/web/src/features/dm-sync/hooks/use-conversation-detail.ts` | Created |
| `apps/web/src/features/dm-sync/types.ts` | Modified |
| `apps/web/src/features/dm-sync/index.ts` | Modified |
| `apps/web/src/features/dm-sync/components/ConversationList.tsx` | Created |
| `apps/web/src/features/dm-sync/components/ConversationItem.tsx` | Created |
| `apps/web/src/features/dm-sync/components/ConversationDetail.tsx` | Created |
| `apps/web/src/features/dm-sync/components/MessageBubble.tsx` | Created |
| `apps/web/src/app/skool-sync/inbox/page.tsx` | Created |
| `apps/web/src/lib/apps.ts` | Modified |

---

## Verification

1. Navigate to `/skool-sync/inbox`
2. Verify conversations load in list
3. Click conversation, verify messages load
4. Compare conversations against Skool UI for accuracy
5. Send a test message, verify:
   - Appears in inbox as pending
   - Extension picks it up
   - Delivers to Skool
   - Status updates to synced
   - Appears in GHL conversation
6. Test search and filter functionality

---

## Integration Points

| Route | Purpose | Status |
|-------|---------|--------|
| `GET /api/extension/get-pending` | Extension polls for outbound messages | EXISTS |
| `POST /api/extension/confirm-sent` | Extension confirms delivery | EXISTS |
| `GET /api/cron/sync-skool-dms` | Syncs to GHL conversations | EXISTS |
