# KPI Dashboard - Architecture

**Migrated from:** `02 - Projects/KPI-Dashboard/ARCHITECTURE.md`
**Date:** 2026-02-04
**Status:** Planning (integrated into 0ne-app)

---

## Executive Summary

A comprehensive KPI dashboard for Fruitful Funding that:
1. Tracks the full customer journey from ad impression to funded deal
2. Supports historical/cohort analysis (Day 1, 7, 14, 35, 65, 95, 185, 370)
3. Handles campaign attribution and source tracking
4. Includes expense tracking for true profitability analysis
5. Integrated into 0ne-app (no standalone deployment)

---

## Funnel Structure

```
                                    ┌─────────────────────────────────────────┐
                                    │            ACQUISITION                   │
                                    │                                          │
    Meta Ads ──────┐                │   Impressions → Clicks → Skool Joins    │
                   │                │                                          │
    YouTube ───────┼───────────────►│   Cost: Ad Spend                        │
                   │                │   KPIs: CPM, CPC, Cost Per Join         │
    Organic ───────┘                │                                          │
                                    └─────────────────┬───────────────────────┘
                                                      │
                                                      ▼
                                    ┌─────────────────────────────────────────┐
                                    │            ENGAGEMENT                    │
                                    │                                          │
                                    │   Skool Members → Hand Raisers          │
                                    │                                          │
                                    │   Types: Workshop HR, Help HR            │
                                    │   KPIs: HR Rate, Cost Per HR            │
                                    └─────────────────┬───────────────────────┘
                                                      │
                                                      ▼
                                    ┌─────────────────────────────────────────┐
                                    │            QUALIFICATION                 │
                                    │                                          │
                                    │   Hand Raiser → DM → Qualification      │
                                    │                                          │
                                    │   KPIs: Response Rate, Qualification %  │
                                    └─────────────────┬───────────────────────┘
                                                      │
                          ┌───────────────────────────┴───────────────────────────┐
                          │                                                       │
                          ▼                                                       ▼
        ┌─────────────────────────────────┐             ┌─────────────────────────────────┐
        │         GOOD CREDIT PATH         │             │         BAD CREDIT PATH          │
        │                                  │             │                                  │
        │   Offer Doc → VIP Enrollment     │             │   Offer Doc → Premium            │
        │                 ↓                │             │                ↓                 │
        │           Onboarding             │             │          Credit Repair           │
        │                 ↓                │             │                ↓                 │
        │           FUNDED!                │             │          (Future VIP)            │
        │                                  │             │                                  │
        │   KPIs: VIP Conv %, Avg Funding  │             │   KPIs: Premium Conv %, MRR     │
        │          Days to Fund, EPL       │             │          Upgrade Rate            │
        └─────────────────────────────────┘             └─────────────────────────────────┘
```

---

## Database Schema (Supabase)

### Core Tables

```sql
-- ============================================
-- CONTACTS (Current state of each person)
-- ============================================
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_contact_id TEXT UNIQUE,
  skool_user_id TEXT,

  -- Current funnel position
  current_stage TEXT, -- 'lead', 'hand_raiser', 'qualified', 'vip', 'premium', 'funded'
  credit_status TEXT, -- 'good', 'bad', 'unknown'

  -- Age tracking (mirrors GHL)
  lead_age INTEGER DEFAULT 0,
  client_age INTEGER DEFAULT 0,

  -- Attribution
  source TEXT, -- 'meta_ads', 'youtube', 'organic', 'referral'
  campaign TEXT, -- 'workshop_jan_2026', 'evergreen'
  hand_raiser_type TEXT, -- 'workshop', 'help', 'general'

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Funnel timestamps (for velocity calculations)
  became_lead_at TIMESTAMPTZ,
  became_hand_raiser_at TIMESTAMPTZ,
  became_qualified_at TIMESTAMPTZ,
  became_client_at TIMESTAMPTZ,
  became_funded_at TIMESTAMPTZ
);

-- ============================================
-- EVENTS (Immutable event log - time series)
-- ============================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id),

  event_type TEXT NOT NULL, -- 'tag_added', 'stage_changed', 'payment', 'funded'
  event_data JSONB, -- Flexible payload

  -- Attribution (denormalized for query speed)
  source TEXT,
  campaign TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- COHORT_SNAPSHOTS (EPL, LTV at Day N)
-- ============================================
CREATE TABLE cohort_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id),

  snapshot_type TEXT NOT NULL, -- 'epl', 'ltv', 'revenue'
  snapshot_day INTEGER NOT NULL, -- 1, 7, 14, 35, 65, 95, 185, 370
  value DECIMAL(10,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(contact_id, snapshot_type, snapshot_day)
);

-- ============================================
-- CAMPAIGNS (Workshop, evergreen, etc.)
-- ============================================
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- 'Fruitful Year Workshop Jan 2026'
  slug TEXT UNIQUE NOT NULL, -- 'workshop_jan_2026'
  type TEXT, -- 'workshop', 'evergreen', 'challenge'

  start_date DATE,
  end_date DATE,

  -- Budget/targets
  ad_budget DECIMAL(10,2),
  revenue_target DECIMAL(10,2),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AD_METRICS (Daily ad performance)
-- ============================================
CREATE TABLE ad_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  platform TEXT DEFAULT 'meta', -- 'meta', 'youtube', 'google'
  campaign_id UUID REFERENCES campaigns(id),

  -- Spend
  spend DECIMAL(10,2),

  -- Volume
  impressions INTEGER,
  clicks INTEGER,

  -- Calculated (stored for speed)
  cpm DECIMAL(10,2), -- Cost per 1000 impressions
  cpc DECIMAL(10,2), -- Cost per click
  ctr DECIMAL(5,4), -- Click-through rate

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(date, platform, campaign_id)
);

-- ============================================
-- EXPENSES (Manual + recurring)
-- ============================================
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- 'Video Editor', 'GHL Subscription'
  category TEXT, -- 'labor', 'software', 'marketing', 'operations'

  -- Amount
  amount DECIMAL(10,2) NOT NULL,
  frequency TEXT DEFAULT 'one_time', -- 'one_time', 'monthly', 'annual'

  -- Date range (for recurring)
  start_date DATE,
  end_date DATE, -- NULL = ongoing

  -- For one-time
  expense_date DATE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- REVENUE (Non-GHL income, e.g., from Relay)
-- ============================================
CREATE TABLE revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id), -- NULL if not tied to specific contact

  amount DECIMAL(10,2) NOT NULL,
  type TEXT, -- 'vip_setup', 'success_fee', 'premium', 'other'
  description TEXT,

  source TEXT DEFAULT 'ghl', -- 'ghl', 'stripe', 'relay', 'manual'
  transaction_date DATE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DAILY_AGGREGATES (Pre-computed for dashboard speed)
-- ============================================
CREATE TABLE daily_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  campaign_id UUID REFERENCES campaigns(id), -- NULL = all campaigns
  source TEXT, -- NULL = all sources

  -- Funnel counts
  new_leads INTEGER DEFAULT 0,
  new_hand_raisers INTEGER DEFAULT 0,
  new_qualified INTEGER DEFAULT 0,
  new_vip INTEGER DEFAULT 0,
  new_premium INTEGER DEFAULT 0,
  new_funded INTEGER DEFAULT 0,

  -- Revenue
  total_revenue DECIMAL(10,2) DEFAULT 0,
  vip_revenue DECIMAL(10,2) DEFAULT 0,
  premium_revenue DECIMAL(10,2) DEFAULT 0,
  success_fee_revenue DECIMAL(10,2) DEFAULT 0,

  -- Costs
  ad_spend DECIMAL(10,2) DEFAULT 0,
  expenses DECIMAL(10,2) DEFAULT 0,

  -- Funding
  total_funded_amount DECIMAL(12,2) DEFAULT 0,
  funded_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(date, campaign_id, source)
);
```

---

## Tag Mappings (Default)

```typescript
const TAG_MAPPINGS = {
  lead: ['skool_member', 'new_lead'],
  hand_raiser: ['hand_raiser', 'workshop_hr', 'help_hr'],
  qualified: ['qualified', 'good_credit', 'bad_credit'],
  vip: ['vip_client', 'vip_paid'],
  premium: ['premium_member'],
  funded: ['funded', 'deal_closed'],
}
```

**Note:** These need to be validated against actual GHL tag names. See `PREP-STATUS.md` for current mapping status.

---

## Cohort Milestones

Days tracked: 1, 7, 14, 35, 65, 95, 185, 370 (mirrors GHL Lead Age workflow)

---

## Data Ingestion Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA COLLECTION                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │   GHL API    │    │  Meta API    │    │   Manual     │                   │
│  │   (Hourly)   │    │   (Daily)    │    │   Entry      │                   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                   │
│         │                   │                   │                            │
│         ▼                   ▼                   ▼                            │
│  ┌─────────────────────────────────────────────────────────────┐            │
│  │                    API ROUTES (CRON)                         │            │
│  │                                                               │            │
│  │  /api/cron/sync-ghl     (hourly)  - Pull contacts, tags     │            │
│  │  /api/cron/sync-meta    (daily)   - Pull ad metrics         │            │
│  │  /api/cron/aggregate    (daily)   - Compute daily_aggregates│            │
│  │  /api/cron/cohort-check (daily)   - Check for cohort snaps  │            │
│  └─────────────────────────────────────────────────────────────┘            │
│                              │                                               │
│                              ▼                                               │
│  ┌─────────────────────────────────────────────────────────────┐            │
│  │                      SUPABASE                                │            │
│  │                                                               │            │
│  │   contacts │ events │ cohort_snapshots │ ad_metrics │ ...   │            │
│  └─────────────────────────────────────────────────────────────┘            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Clerk (shared with 0ne-app)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# GHL
GHL_API_KEY=
GHL_LOCATION_ID=

# Meta
META_APP_ID=
META_APP_SECRET=
META_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=

# Cron secret (verify cron requests)
CRON_SECRET=
```

---

## Related Files

- **Section Spec:** `spec.md`
- **Sample Data:** `sample-data.json`
- **Tests:** `tests.md`
- **Strategy/KPIs:** `PROJECT.md`
- **Setup Checklist:** `SETUP-CHECKLIST.md`
- **Session Coordination:** `PREP-STATUS.md`
