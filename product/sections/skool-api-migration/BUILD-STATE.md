# Skool API Migration (Extension-First) — Build State

> **Purpose:** Migrate ALL remaining server-side Skool API calls to the Chrome extension. AWS WAF blocks server-side calls — the extension is the sole Skool data collector.
> **Status:** Complete
> **Created:** 2026-02-17

---

## Quick Resume

**Last Updated:** 2026-02-17
**Current Phase:** All phases complete
**Blocker:** None — ready for end-to-end testing

**Why this is needed:**
AWS WAF blocks ALL server-side Skool API calls (cookie IP-matching). Several crons and API routes still attempt server-side calls and are broken since ~Feb 10. The hand-raiser campaign is Jimmy's immediate priority — it can't detect post commenters.

---

## ⚠️ CRITICAL: Multi-Agent Sequential Deployment

**This feature MUST use the multi-agent workflow per CLAUDE.md.**

### The Rule: Each Phase = 1 Agent

```
DO NOT build multiple phases in a single session.
DO NOT skip the agent workflow for "simple" phases.
ALWAYS spawn a Task agent for each phase.
Phases run SEQUENTIALLY — never simultaneously.
```

### How to Deploy a Phase

1. Main session reads this BUILD-STATE
2. Main session spawns a Task agent with the phase-specific prompt (see Agent Prompt Template below)
3. Agent completes phase → commits (NO push) → returns
4. Main session updates BUILD-STATE checkboxes
5. Repeat for next phase

### Phase Completion Checklist (per phase)

- [ ] Code complete
- [ ] Extension builds: `cd "03 - BUILD/03-1 - Apps/Skool-Extension" && bun run build`
- [ ] 0ne-app builds (if modified): `cd "03 - BUILD/03-1 - Apps/0ne-app/apps/web" && bun run build`
- [ ] Commit with descriptive message: `Phase {N}: {description}`
- [ ] Update this BUILD-STATE's checkboxes
- [ ] NO push (Jimmy will push)

### Before Deploying Phases, Ask:

> "Deploy all phases now, or pause between each?"

---

## Phase Roadmap

| Phase | Priority | Description | Repo(s) | Status |
|-------|----------|-------------|---------|--------|
| 1 | P0 | Hand-raiser comment polling (extension) | Extension | ✅ |
| 2 | P0 | Hand-raiser server endpoints + cron no-op | 0ne-app | ✅ |
| 3 | P0 | Post-Now redirect + categories via extension | Both | ✅ |
| 4 | P1 | Revenue + MRR via extension | Both | ✅ |
| 5 | P1 | Monthly member history via extension | Both | ✅ |
| 6 | P1 | Full member sync enhancement | Both | ✅ |
| 7 | P2 | Kill dead crons + test endpoints | 0ne-app | ✅ |
| 8 | P2 | KPI about-analytics fallback removal | 0ne-app | ✅ |

**Execution order:** Strictly sequential: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

---

## P0 — Actively Broken (Phases 1-3)

### Phase 1: Hand-Raiser Comment Polling (Extension)

**Goal:** Extension polls for active hand-raiser campaigns, fetches post comments from Skool in-tab, and pushes new commenters to the server.

| Task | Status | Description |
|------|--------|-------------|
| 1.1 | ✅ | Add types: `HandRaiserCampaignInfo`, `HandRaiserCommenter`, request/response types to `src/types/index.ts` |
| 1.2 | ✅ | Add `getHandRaiserCampaigns()` to `src/lib/api-client.ts` — `GET /api/extension/get-hand-raiser-campaigns` |
| 1.3 | ✅ | Add `pushHandRaiserCommenters()` to `src/lib/api-client.ts` — `POST /api/extension/push-hand-raiser-commenters` |
| 1.4 | ✅ | Add `ALARM_POLL_HAND_RAISERS` alarm (every 15 minutes) to `service-worker.ts` |
| 1.5 | ✅ | Implement `fetchCommentsInTab(slug, postId)` using `chrome.scripting.executeScript` pattern |
| 1.6 | ✅ | Implement `pollHandRaisers()` — fetch campaigns, parse post URLs, fetch comments, push commenters |
| 1.7 | ✅ | Wire `ALARM_POLL_HAND_RAISERS` into alarm handler |

**Skool Comments API:** `GET /groups/{slug}/posts/{postId}/comments`
```json
{ "comments": [{ "id": "...", "userId": "...", "user": { "id": "...", "name": "johndoe", "displayName": "John Doe" }, "content": "I'm interested!", "createdAt": "2026-02-16T10:00:00Z" }] }
```

**Post URL parsing:** `www.skool.com/{communitySlug}/{slug}-{postId}` — last segment after final `-` is postId. Also supports `/{communitySlug}/post/{postId}`.

**Files:**
- `src/types/index.ts`
- `src/lib/api-client.ts`
- `src/background/service-worker.ts`

---

### Phase 2: Hand-Raiser Server Endpoints + Cron No-Op (0ne-app)

**Goal:** Server receives commenters from extension, handles GHL tagging + dedup. Kill the broken cron.

| Task | Status | Description |
|------|--------|-------------|
| 2.1 | ✅ | Create `GET /api/extension/get-hand-raiser-campaigns` — returns active campaigns for authenticated user |
| 2.2 | ✅ | Create `POST /api/extension/push-hand-raiser-commenters` — processes commenters with GHL tagging + dedup |
| 2.3 | ✅ | Convert `hand-raiser-check` cron to no-op with explanatory message |

**`GET /api/extension/get-hand-raiser-campaigns` response:**
```json
{
  "success": true,
  "campaigns": [{
    "id": "uuid",
    "postUrl": "https://www.skool.com/fruitful/post-slug-abc123",
    "skoolPostId": "abc123",
    "communitySlug": "fruitful",
    "keywordFilter": "interested,yes",
    "ghlTag": "hand-raiser",
    "dmTemplate": null
  }]
}
```

**`POST /api/extension/push-hand-raiser-commenters` body:**
```json
{
  "staffSkoolId": "236af...",
  "commenters": [{
    "campaignId": "uuid",
    "skoolUserId": "user123",
    "username": "johndoe",
    "displayName": "John Doe",
    "commentContent": "I'm interested!",
    "commentCreatedAt": "2026-02-16T10:00:00Z"
  }]
}
```

**Server processing per commenter** (extracted from `processHandRaiserCampaign()` in `sync-engine.ts:1060`):
1. Check `dm_hand_raiser_sent` for dedup (campaign_id + skool_user_id) — skip if exists
2. Apply keyword_filter if campaign has one
3. `findOrCreateGhlContact()` from `features/dm-sync/lib/contact-mapper.ts`
4. `tagGhlContact()` from `features/dm-sync/lib/sync-engine.ts:1227` — GHL API, works server-side
5. If `dm_template` has content → `interpolateTemplate()` → queue DM in `dm_messages` with `source: 'hand-raiser'`
6. Insert dedup record into `dm_hand_raiser_sent`

**Auth:** Use `validateExtensionAuth()` dual-auth pattern (Clerk + Bearer)

**Files:**
- `apps/web/src/app/api/extension/get-hand-raiser-campaigns/route.ts` (NEW)
- `apps/web/src/app/api/extension/push-hand-raiser-commenters/route.ts` (NEW)
- `apps/web/src/app/api/cron/hand-raiser-check/route.ts` (MODIFY → no-op)

---

### Phase 3: Post-Now Redirect + Categories via Extension

**Goal:** Fix Post Now (calls Skool API server-side) and categories fetch (scrapes Skool HTML server-side).

| Task | Status | Description |
|------|--------|-------------|
| 3.1 | ✅ | Modify `post-now/route.ts` — queue for extension instead of direct Skool API (set `status: 'approved', scheduled_at: NOW()`) |
| 3.2 | ✅ | Modify `categories/route.ts` — remove Skool API fallback, DB-only with static fallback |
| 3.3 | ✅ | Create `POST /api/extension/push-categories` endpoint |
| 3.4 | ✅ | Add `fetchCategoriesInTab()` to extension service worker |
| 3.5 | ✅ | Add `pushCategories()` to extension api-client |

**Post Now redirect:** Set `scheduled_at = NOW()` so extension's get-scheduled-posts poll (every 60s) picks it up immediately. Return `{ success: true, queued: true }`.

**Categories endpoint:** `POST /api/extension/push-categories` receives `{ groupSlug, categories: [{ id, name, position }] }` and upserts to DB cache.

**Files:**
- 0ne-app: `apps/web/src/app/api/skool/oneoff-posts/post-now/route.ts` (MODIFY)
- 0ne-app: `apps/web/src/app/api/skool/categories/route.ts` (MODIFY)
- 0ne-app: `apps/web/src/app/api/extension/push-categories/route.ts` (NEW)
- Extension: `src/background/service-worker.ts` (ADD fetchCategoriesInTab)
- Extension: `src/lib/api-client.ts` (ADD pushCategories)

---

## P1 — Broken Crons (Phases 4-6)

### Phase 4: Revenue + MRR via Extension

**Goal:** Extension captures MRR and membership product data from dead `sync-skool` cron.

| Task | Status | Description |
|------|--------|-------------|
| 4.1 | ✅ | Add `membership-products?model=subscription` fetch to `fetchAnalyticsInTab()` |
| 4.2 | ✅ | Add `analytics?chart=mrr` fetch to `fetchAnalyticsInTab()` |
| 4.3 | ✅ | Extract metrics: `membership_free_members`, `membership_paid_members`, `mrr_total`, `mrr_new`, `mrr_churn`, `mrr_upgrade`, `mrr_downgrade`, `mrr_reactivation` |

**Files:**
- Extension: `src/background/service-worker.ts` (MODIFY fetchAnalyticsInTab + pollAnalytics)

---

### Phase 5: Monthly Member History via Extension

**Goal:** Extension fetches `analytics?chart=members&range=all` for monthly member breakdown. Replace dead `sync-member-history` cron.

| Task | Status | Description |
|------|--------|-------------|
| 5.1 | ✅ | Add `analytics?chart=members&range=all` fetch to `fetchAnalyticsInTab()` |
| 5.2 | ✅ | Extract monthly metrics: `monthly_new_members`, `monthly_existing_members`, `monthly_churned_members`, `monthly_total_members` |
| 5.3 | ✅ | Add `monthly_*` handler in `push-analytics/route.ts` → upsert `skool_members_monthly` |

**Skool response format:** `{ chart_data: { items: [{ date: "2025-01", new: 45, existing: 200, churned: 10, total: 235 }] } }`

**Files:**
- Extension: `src/background/service-worker.ts` (MODIFY)
- 0ne-app: `apps/web/src/app/api/extension/push-analytics/route.ts` (MODIFY)

---

### Phase 6: Full Member Sync Enhancement

**Goal:** Extension paginates all members (currently fetches one page). Capture full metadata.

| Task | Status | Description |
|------|--------|-------------|
| 6.1 | ✅ | Modify `fetchMembersInTab()` to paginate: `GET /groups/{slug}/members?limit=50&page=N` |
| 6.2 | ✅ | Add 300ms rate limit between pages |
| 6.3 | ✅ | Push full batch to existing `push-members` endpoint |
| 6.4 | ✅ | Ensure `push-members/route.ts` handles additional fields (email, survey data) |

**Files:**
- Extension: `src/background/service-worker.ts` (MODIFY fetchMembersInTab)
- Extension: `src/types/index.ts` (UPDATE if new fields)
- 0ne-app: `apps/web/src/app/api/extension/push-members/route.ts` (MODIFY if needed)

---

## P2 — Cleanup (Phases 7-8)

### Phase 7: Kill Dead Crons + Test Endpoints

**Goal:** Remove all broken Skool-dependent crons and test endpoints.

| Task | Status | Description |
|------|--------|-------------|
| 7.1 | ✅ | Remove `hand-raiser-check` from `vercel.json` crons |
| 7.2 | ✅ | Remove `send-pending-dms` from `vercel.json` crons |
| 7.3 | ✅ | No-op `sync-about-analytics` cron |
| 7.4 | ✅ | No-op `sync-member-history` cron |
| 7.5 | ✅ | Delete `api/test-skool-charts/` directory |
| 7.6 | ✅ | Delete `api/test-skool-profile/` directory |
| 7.7 | ✅ | Update root `product/BUILD-STATE.md` architecture note |

**Files:**
- `vercel.json`
- `apps/web/src/app/api/cron/sync-about-analytics/route.ts`
- `apps/web/src/app/api/cron/sync-member-history/route.ts`
- `apps/web/src/app/api/test-skool-charts/` (DELETE)
- `apps/web/src/app/api/test-skool-profile/` (DELETE)
- `product/BUILD-STATE.md`

---

### Phase 8: KPI About-Analytics Fallback Removal

**Goal:** Remove Skool API fallback from about-analytics route. DB-only.

| Task | Status | Description |
|------|--------|-------------|
| 8.1 | ✅ | Remove `fetchDailyFromSkoolAPI()` and `fetchMonthlyFromSkoolAPI()` |
| 8.2 | ✅ | Remove `getSkoolClient()` import/usage |
| 8.3 | ✅ | Return DB data only with graceful empty state |

**Files:**
- `apps/web/src/app/api/kpi/about-analytics/route.ts`

---

## Agent Prompt Template

```
Deploy Phase {N} of the Skool API Migration (Extension-First).

## Context
- Extension location: 03 - BUILD/03-1 - Apps/Skool-Extension/
- 0ne-app location: 03 - BUILD/03-1 - Apps/0ne-app/
- BUILD-STATE: product/sections/skool-api-migration/BUILD-STATE.md
- Extension CLAUDE.md: 03 - BUILD/03-1 - Apps/Skool-Extension/CLAUDE.md

## Your Phase Tasks
{Copy task table from the phase section in BUILD-STATE}

## Key Files to Read First
{List the files from the phase section}

## Reusable Patterns
- Extension polling: See `ALARM_POLL_ANALYTICS` + `pollAnalytics()` pattern in service-worker.ts
- Extension in-tab fetch: See `fetchAnalyticsInTab()` using `chrome.scripting.executeScript` in service-worker.ts
- Server auth: Use `validateExtensionAuth()` dual-auth pattern from push-analytics/route.ts
- Server GHL tagging: `findOrCreateGhlContact()` from features/dm-sync/lib/contact-mapper.ts
- Server GHL tagging: `tagGhlContact()` logic from features/dm-sync/lib/sync-engine.ts:1227

## Success Criteria
{Copy from phase description}

## On Completion
1. Ensure extension builds: cd "03 - BUILD/03-1 - Apps/Skool-Extension" && bun run build
2. If 0ne-app changes: verify no type errors
3. Commit with message: "Phase {N}: {description}"
4. Return summary of what was created/modified
5. DO NOT PUSH (Jimmy will push)
```

---

## Verification (End-to-End — After All Phases)

1. Open Skool tab in Chrome with extension active
2. Verify hand-raiser campaigns detect new commenters → GHL contacts get tagged
3. Verify Post Now queues for extension and publishes within 60s
4. Verify categories load in scheduler UI from DB cache
5. Check `skool_analytics` for revenue/MRR metrics
6. Check `skool_members_monthly` for historical member data
7. Check `skool_members` for full paginated member list
8. Verify no Skool API calls in Vercel function logs
9. Verify vercel.json has no Skool-dependent crons
