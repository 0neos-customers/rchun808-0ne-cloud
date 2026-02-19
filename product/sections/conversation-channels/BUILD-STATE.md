# Conversation Channel Management - Build State

> Multi-staff DM resolution: resolve placeholder channel IDs before sending outbound messages

## Status: 🔄 Active

**Created:** 2026-02-18

---

## Problem

1. Hand-raiser messages use placeholder IDs (`hr-pending-{userId}`) that never resolve to real Skool channel IDs
2. No channel resolution before sending — extension assumes `skool_conversation_id` is already valid
3. No persistent channel storage — resolved channels aren't cached for reuse
4. No multi-staff support — different staff create different Skool channels per contact

## Solution

Cache resolved Skool channel IDs per staff+user pair. Extension resolves placeholders before sending via `POST api2.skool.com/users/{userId}/chat-request?g={communityId}`.

---

## Phases

### Phase 0: BUILD-STATE Documentation
- [x] Create this BUILD-STATE file
- [x] Update root BUILD-STATE.md

### Phase 1: Database Schema Migration
- [ ] SQL migration `037-contact-channels.sql` — `contact_channels` table + `skool_community_id` column
- [ ] TypeScript type updates in `features/dm-sync/types.ts`

### Phase 3: Server API Changes (before Phase 2)
- [ ] `POST /api/extension/push-channel` — cache resolved channel IDs
- [ ] Update `GET /api/extension/get-pending` — enrich with `skool_community_id`, check cached channels
- [ ] Update `POST /api/extension/confirm-sent` — accept `resolvedChannelId`
- [ ] Update `GET /api/dm-sync/contacts` — join `contact_channels` for channel status

### Phase 2: Extension Channel Resolution
- [ ] New message types: `RESOLVE_CHANNEL`, `RESOLVE_CHANNEL_RESULT`
- [ ] Main-world handler: `RESOLVE_CHANNEL_VIA_API` → `chat-request` endpoint
- [ ] DM sender: `resolveChannel()` function
- [ ] Content script: handle `RESOLVE_CHANNEL` from service worker
- [ ] Service worker: detect placeholders, resolve before sending, cache via `pushChannel()`
- [ ] API client: `pushChannel()` function

### Phase 4: Frontend Channel Status
- [ ] Update `ContactActivity` type with `channels` array
- [ ] Add Skool DM deep link icon on contacts page
- [ ] Channel count tooltip for multi-staff contacts
- [ ] Gray out DM icon for unresolved contacts

---

## Data Flow

```
1. Server creates dm_messages with hr-pending-{userId}
2. Extension polls GET /api/extension/get-pending
3. Server checks contact_channels for cached channel → substitutes if found
4. If still placeholder, extension detects hr-pending-* prefix
5. Extension calls POST api2.skool.com/users/{userId}/chat-request?g={communityId}
6. Extension calls POST /api/extension/push-channel to cache it
7. Extension sends message via POST api2.skool.com/channels/{channelId}/messages
8. Extension calls POST /api/extension/confirm-sent with resolvedChannelId
```

## Setup Requirement

`dm_sync_config.skool_community_id` must be populated:
- Get UUID from: `GET api2.skool.com/groups/fruitful/discovery` → `group.id`
- Set via: `UPDATE dm_sync_config SET skool_community_id = '{uuid}' WHERE skool_community_slug = 'fruitful'`
