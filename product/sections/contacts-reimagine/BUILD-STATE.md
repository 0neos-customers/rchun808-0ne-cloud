# Contacts Page Reimagining - BUILD-STATE

> 100% contact matching with matched/unmatched tabs, manual GHL matching, and synthetic contact creation.

**Status:** In Progress
**Started:** 2026-02-18

---

## Phase Summary

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Schema migration + type updates | [ ] |
| Phase 2 | Contact discovery + mapper + hand-raiser fix | [ ] |
| Phase 3 | API endpoints (GET filters, PATCH manual match, POST synthetic) | [ ] |
| Phase 4 | Frontend UI (tabs, edit dialog, synthetic button, inbox deep link) | [ ] |

---

## Phase 1: Schema Migration + Type Updates

**Commit:** `Phase 1: Schema migration for contacts page reimagining`

### Tasks
- [ ] Create `packages/db/schemas/036-contacts-reimagine.sql`
  - Make `ghl_contact_id` nullable
  - Add `contact_type`, `email`, `phone`, `updated_at` columns
  - Create indexes for unmatched + contact_type queries
  - Backfill `contact_type` from `skool_members`
  - Backfill `email` from `skool_members`
  - Backfill missing DM contacts into `dm_contact_mappings`
- [ ] Update `ContactMappingRow` in `types.ts` — nullable `ghl_contact_id`, add new fields
- [ ] Update `ContactMapping` domain type — same changes
- [ ] Update `MapContactResult.matchMethod` — add `'manual'`

### Files
- `packages/db/schemas/036-contacts-reimagine.sql` (NEW)
- `apps/web/src/features/dm-sync/types.ts` (modify)

---

## Phase 2: Contact Discovery + Mapper + Hand-Raiser Fix

**Commit:** `Phase 2: Auto-discover contacts and fix hand-raiser dedup`

### Tasks
- [ ] Contact mapper: create unmatched entries when no email found
- [ ] Contact mapper: add `contact_type` and `email` to `cacheMapping()`
- [ ] Export `parseDisplayName()` for reuse
- [ ] Push-messages: auto-discover contacts from inbound DMs
- [ ] Hand-raiser: only write dedup record when GHL contact found

### Files
- `apps/web/src/features/dm-sync/lib/contact-mapper.ts` (modify)
- `apps/web/src/app/api/extension/push-messages/route.ts` (modify)
- `apps/web/src/app/api/extension/push-hand-raiser-commenters/route.ts` (modify)

---

## Phase 3: API Endpoints

**Commit:** `Phase 3: Contacts API with match filters + manual match + synthetic creation`

### Tasks
- [ ] GET `/api/dm-sync/contacts` — add `match_status` and `contact_type` filters
- [ ] GET contacts — add `email`, `phone`, `contact_type`, `skool_conversation_id` to response
- [ ] GET contacts — update summary with `matched_contacts` and `unmatched_contacts`
- [ ] PATCH `/api/dm-sync/contacts/[skoolUserId]` — manual match endpoint
- [ ] POST `/api/dm-sync/contacts/[skoolUserId]/synthetic` — synthetic creation endpoint

### Files
- `apps/web/src/app/api/dm-sync/contacts/route.ts` (modify)
- `apps/web/src/app/api/dm-sync/contacts/[skoolUserId]/route.ts` (NEW)
- `apps/web/src/app/api/dm-sync/contacts/[skoolUserId]/synthetic/route.ts` (NEW)

---

## Phase 4: Frontend UI

**Commit:** `Phase 4: Contacts page with matched/unmatched tabs, edit dialog, synthetic creation`

### Tasks
- [ ] Update `use-contact-activity.ts` — add `matchStatus` param, update types
- [ ] Create `use-contact-mutations.ts` — `useManualMatch()` + `useSyntheticCreate()`
- [ ] Create `ContactEditDialog.tsx` — edit dialog for matched/unmatched contacts
- [ ] Refactor `contacts/page.tsx` — matched/unmatched tabs, 5 action items per row
- [ ] Inbox deep link — add `searchParams` support to inbox page

### Action Items Per Contact Row
1. **Inbox** (I) — deep link to `/skool-sync/inbox?conversation=xxx`
2. **Skool** (S) — existing Skool profile link
3. **GHL** (G) — GHL contact link (matched only)
4. **Edit** (pencil) — opens ContactEditDialog
5. **Synthetic** (zap) — creates GHL contact (unmatched only, 100% MANUAL)

### Files
- `apps/web/src/features/dm-sync/hooks/use-contact-activity.ts` (modify)
- `apps/web/src/features/dm-sync/hooks/use-contact-mutations.ts` (NEW)
- `apps/web/src/features/dm-sync/components/ContactEditDialog.tsx` (NEW)
- `apps/web/src/app/skool-sync/contacts/page.tsx` (major refactor)
- `apps/web/src/app/skool-sync/inbox/page.tsx` (minor)

---

## Critical Constraints

- **Synthetic creation is 100% MANUAL** — only on user click, NEVER auto-created
- **Schema: `ghl_contact_id` must become nullable** — this is the core blocker
- **Extension-first architecture** — Skool API calls only from Chrome extension
