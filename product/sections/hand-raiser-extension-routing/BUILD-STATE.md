# Hand-Raiser Extension Routing - BUILD-STATE

> **Status:** DEPLOYED - Pending Migration
> **Created:** 2026-02-16
> **Last Updated:** 2026-02-16

---

## Summary

Made DM template **optional** in hand-raiser campaigns. When filled in, routes DMs through the **extension** (not cloud cron) for proper Skool credentials. GHL conversation view stays synced.

---

## Architecture

**New Flow (extension-routed):**
```
Hand-raiser detected -> Tag GHL contact (if ghl_tag set)
                     -> Queue DM with source='hand-raiser' (if dm_template set)
                             |
                     Extension polls get-pending (picks up source='hand-raiser')
                             |
                     Extension sends via Skool UI
                             |
                     confirm-sent -> status='synced'
                             |
                     sync-skool-dms cron -> syncs to GHL conversation
```

---

## Deployment Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Database Migration | Code Ready - Run Migration |
| 2 | API: get-pending Query Update | DONE |
| 3 | Sync Engine: Set Source Field | DONE |
| 4 | Cron: Exclude Hand-Raisers | DONE |
| 5 | API + UI: Optional DM Template | DONE |
| 6 | Verification | PENDING |

---

## Phase 1: Database Migration

**File:** `packages/db/schemas/034-hand-raiser-extension-routing.sql`

**Run migration:**
```bash
psql "$DATABASE_URL" -f packages/db/schemas/034-hand-raiser-extension-routing.sql
```

**Changes:**
- [x] `dm_template` column is nullable
- [x] `source` column added to `dm_messages`
- [x] Index for extension polling

---

## Phase 2: get-pending Query

**File:** `apps/web/src/app/api/extension/get-pending/route.ts`

**Change:** Modified query to use `.or('ghl_message_id.not.is.null,source.eq.hand-raiser')` to pick up both GHL messages AND hand-raiser messages.

- [x] Implemented

---

## Phase 3: Set Source Field

**Files:**
- `apps/web/src/features/dm-sync/types.ts` - Added `source` field to DmMessageRow
- `apps/web/src/features/dm-sync/lib/sync-engine.ts` - Set `source: 'hand-raiser'` in processHandRaiserCampaign

- [x] Implemented

---

## Phase 4: Exclude Hand-Raisers from Cloud Cron

**File:** `apps/web/src/features/dm-sync/lib/sync-engine.ts`

**Change:** Added `.neq('source', 'hand-raiser')` to sendPendingMessages() query.

- [x] Implemented

---

## Phase 5: Optional DM Template

**Files:**
- `apps/web/src/app/api/dm-sync/hand-raisers/route.ts` - Removed dm_template requirement
- `apps/web/src/features/dm-sync/components/HandRaiserDialog.tsx` - Updated UI
- `apps/web/src/features/dm-sync/lib/sync-engine.ts` - Only queue DM if template exists
- `apps/web/src/features/dm-sync/hooks/use-hand-raisers.ts` - Made dm_template optional
- `apps/web/src/features/dm-sync/types.ts` - Made dm_template nullable
- `apps/web/src/app/skool-sync/hand-raisers/page.tsx` - Fixed type mapping

**UI Modes:**
- **DM Mode (with template):** Tags GHL + Extension sends Skool DM
- **GHL-Only Mode (without template):** Tags GHL only, use GHL workflows

- [x] Implemented

---

## Phase 6: Verification

**Test Checklist:**

**Test 1: Hand-raiser with DM template**
- [ ] Create campaign with keyword + ghl_tag + dm_template
- [ ] Comment on post with keyword
- [ ] Run hand-raiser-check cron
- [ ] Verify dm_messages has `source='hand-raiser'`, `status='pending'`
- [ ] Open Skool tab (extension active)
- [ ] Verify extension picks up and sends DM
- [ ] Verify `status='synced'` after sending
- [ ] Run sync-skool-dms cron
- [ ] Verify GHL conversation shows the sent message

**Test 2: Hand-raiser without DM template (GHL-only)**
- [ ] Create campaign with keyword + ghl_tag (no dm_template)
- [ ] Comment on post with keyword
- [ ] Run hand-raiser-check cron
- [ ] Verify contact tagged in GHL
- [ ] Verify NO dm_messages created

**Test 3: Cloud cron doesn't touch hand-raisers**
- [ ] Manually insert `source='hand-raiser'` message
- [ ] Run send-pending-dms cron
- [ ] Verify message still `status='pending'` (cron skipped it)

---

## Files Modified

| File | Phase | Change |
|------|-------|--------|
| `packages/db/schemas/034-hand-raiser-extension-routing.sql` | 1 | New migration |
| `apps/web/src/app/api/extension/get-pending/route.ts` | 2 | Include source='hand-raiser' |
| `apps/web/src/features/dm-sync/lib/sync-engine.ts` | 3, 4, 5 | Set source + conditional DM + exclude |
| `apps/web/src/features/dm-sync/types.ts` | 3, 5 | source field + nullable dm_template |
| `apps/web/src/app/api/dm-sync/hand-raisers/route.ts` | 5 | Optional dm_template |
| `apps/web/src/features/dm-sync/components/HandRaiserDialog.tsx` | 5 | UI updates |
| `apps/web/src/features/dm-sync/hooks/use-hand-raisers.ts` | 5 | Optional dm_template |
| `apps/web/src/app/skool-sync/hand-raisers/page.tsx` | 5 | Type fix |

---

## Next Steps

1. Run database migration: `psql "$DATABASE_URL" -f packages/db/schemas/034-hand-raiser-extension-routing.sql`
2. Deploy to production
3. Complete verification checklist
