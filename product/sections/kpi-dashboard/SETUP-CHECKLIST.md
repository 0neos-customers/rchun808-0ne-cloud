# KPI Dashboard - Setup Checklist

**Migrated from:** `02 - Projects/KPI-Dashboard/CREDENTIALS-CHECKLIST.md`
**Date:** 2026-02-04
**Purpose:** Collect everything needed before connecting live data.

---

## Quick Status

| Service  | Status   | Notes               |
| -------- | -------- | ------------------- |
| Supabase | ⬜ Needed | Create project      |
| Clerk    | ✅ Shared | Uses 0ne-app auth   |
| GHL API  | ✅ Ready  | In ~/.claude/.env   |
| GHL Tags | ✅ Ready  | See PREP-STATUS.md  |
| Meta Ads | ⬜ Needed | Phase 3 (can defer) |

---

## 1. Supabase

**Steps:**
1. Go to [supabase.com](https://supabase.com) → Sign in or create account
2. Click "New Project"
3. Name: `0ne-app` (shared with entire app)
4. Database Password: Generate a strong one, save it somewhere
5. Region: Pick closest to you (e.g., `us-east-1`)
6. Wait for project to provision (~2 min)

**Credentials to collect:**

```
NEXT_PUBLIC_SUPABASE_URL=
# Found in: Settings → API → Project URL
# Looks like: https://xxxxxxxxxxxx.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY=
# Found in: Settings → API → anon/public key

SUPABASE_SERVICE_ROLE_KEY=
# Found in: Settings → API → service_role key (secret!)
```

---

## 2. Clerk (Shared)

The 0ne-app already uses Clerk for auth. No separate setup needed for KPI Dashboard.

---

## 3. GHL API

**Steps:**
1. Log into GHL → Settings → Integrations → API Keys
2. Create new API key (or use existing if you have one)
3. Get your Location ID

**Credentials to collect:**

```
GHL_API_KEY=
# Found in: Settings → Integrations → API Keys
# Looks like: pit-xxxxx (Private Integration Token)

GHL_LOCATION_ID=
# Found in: Settings → Business Profile → Location ID
# OR in the URL when you're in a location: /v2/location/XXXXX
```

---

## 4. GHL Tag Inventory

**See:** `PREP-STATUS.md` for full tag mapping status

This is the critical mapping needed to make the funnel work correctly.

**Current assumptions:**

| Funnel Stage | Tags Expected |
|--------------|---------------|
| Lead | `skool_member`, `new_lead` |
| Hand Raiser | `hand_raiser`, `workshop_hr`, `help_hr` |
| Qualified | `qualified`, `good_credit`, `bad_credit` |
| VIP Client | `vip_client`, `vip_paid` |
| Premium | `premium_member` |
| Funded | `funded`, `deal_closed` |

---

## 5. GHL Custom Fields

**See:** `PREP-STATUS.md` for full custom field mapping status

| Field | Internal Key | Example Value |
|-------|-------------|---------------|
| Lead Age | ? | `45` (days) |
| Client Age | ? | `30` (days) |
| EPL Day 1 | ? | `$152.00` |
| EPL Day 7 | ? | `$180.00` |
| etc. | | |

**How to find custom field keys:**
1. GHL → Settings → Custom Fields
2. Click on each field → Look for "Field Key" or "API Key"

---

## 6. Meta Ads API (Phase 3)

Can wait until Phase 3 of development.

**Do you have a Meta Developer App?**
- [ ] Yes, I have one
- [ ] No, need to create

**If yes, credentials needed:**

```
META_APP_ID=
# Found in: developers.facebook.com → Your App → Settings → Basic

META_APP_SECRET=
# Found in: Same page, click "Show" next to App Secret

META_ACCESS_TOKEN=
# This is trickier - needs Marketing API permission

META_AD_ACCOUNT_ID=
# Found in: Business Settings → Ad Accounts
# Looks like: act_123456789
```

---

## Summary Checklist

**Copy this and fill in as you go:**

```env
# ===== SUPABASE =====
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# ===== GHL =====
GHL_API_KEY=
GHL_LOCATION_ID=

# ===== META (Phase 3) =====
META_APP_ID=
META_APP_SECRET=
META_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=

# ===== AUTO-GENERATED =====
CRON_SECRET=will_be_generated
```

---

## Related Files

- **PREP-STATUS.md** - Session 2 coordination (GHL tag mapping progress)
- **ARCHITECTURE.md** - Technical architecture details
- **PROJECT.md** - Strategy and KPI definitions
