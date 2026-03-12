# Data Model: 0ne Cloud

## Overview

This data model defines the core entities and relationships across the 0ne platform. Each mini-app has its own namespaced tables, but they share common patterns and reference entities.

---

## Shared Entities

### User (Managed by Clerk)

The user entity is managed externally by Clerk. We store only:
- `clerk_user_id` - Reference to Clerk user
- `permissions` - Stored in Clerk's publicMetadata

**Permissions Structure:**
```typescript
{
  isAdmin: boolean
  apps: {
    kpi: boolean
    prospector: boolean
    skoolSync: boolean
  }
}
```

---

## Platform Foundation Entities

### App
Represents a mini-app in the platform.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique app identifier (e.g., 'kpi', 'prospector') |
| name | string | Display name |
| description | string | Short description |
| icon | string | Icon identifier |
| route | string | URL path |
| enabled | boolean | Whether app is active globally |

---

## KPI Dashboard Entities

### Contact
Current state of a person in the funnel.

| Field                 | Type      | Description                                        |
| --------------------- | --------- | -------------------------------------------------- |
| id                    | uuid      | Primary key                                        |
| ghl_contact_id        | string    | GoHighLevel reference                              |
| skool_user_id         | string    | Skool reference (optional)                         |
| current_stage         | enum      | lead, hand_raiser, qualified, vip, premium, funded |
| credit_status         | enum      | good, bad, unknown                                 |
| lead_age              | integer   | Days since became lead                             |
| client_age            | integer   | Days since became client                           |
| source                | string    | meta_ads, youtube, organic, referral               |
| campaign              | string    | Campaign identifier                                |
| hand_raiser_type      | string    | workshop, help, general                            |
| became_lead_at        | timestamp | When entered funnel                                |
| became_hand_raiser_at | timestamp | When raised hand                                   |
| became_qualified_at   | timestamp | When qualified                                     |
| became_client_at      | timestamp | When converted                                     |
| became_funded_at      | timestamp | When funded                                        |

### Event
Immutable event log for time-series analysis.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| contact_id | uuid | Reference to contact |
| event_type | string | tag_added, stage_changed, payment, funded |
| event_data | jsonb | Flexible payload |
| source | string | Attribution |
| campaign | string | Campaign reference |
| created_at | timestamp | When event occurred |

### Cohort Snapshot
Point-in-time metrics for cohort analysis.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| contact_id | uuid | Reference to contact |
| snapshot_type | enum | epl, ltv, revenue |
| snapshot_day | integer | 1, 7, 14, 35, 65, 95, 185, 370 |
| value | decimal | Metric value |

### Campaign
Marketing campaigns and workshops.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| name | string | Display name |
| slug | string | URL-safe identifier |
| type | enum | workshop, evergreen, challenge |
| start_date | date | Campaign start |
| end_date | date | Campaign end |
| ad_budget | decimal | Planned spend |
| revenue_target | decimal | Target revenue |
| is_active | boolean | Currently running |

### Ad Metrics
Daily advertising performance.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| date | date | Metrics date |
| platform | enum | meta, youtube, google |
| campaign_id | uuid | Campaign reference |
| spend | decimal | Money spent |
| impressions | integer | Views |
| clicks | integer | Clicks |
| cpm | decimal | Cost per 1000 impressions |
| cpc | decimal | Cost per click |
| ctr | decimal | Click-through rate |

### Revenue
Income tracking.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| contact_id | uuid | Related contact (optional) |
| amount | decimal | Revenue amount |
| type | enum | vip_setup, success_fee, premium, other |
| description | string | Notes |
| source | enum | ghl, stripe, relay, manual |
| transaction_date | date | When received |
| campaign_id | uuid | Attribution |

### Expense
Cost tracking.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| name | string | Description |
| category | enum | labor, software, marketing, operations |
| amount | decimal | Cost |
| frequency | enum | one_time, monthly, annual |
| start_date | date | When started |
| end_date | date | When ended (null = ongoing) |
| expense_date | date | For one-time expenses |
| is_active | boolean | Currently active |

### Daily Aggregate
Pre-computed daily metrics for dashboard speed.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| date | date | Aggregate date |
| campaign_id | uuid | Campaign (null = all) |
| source | string | Source (null = all) |
| new_leads | integer | Leads that day |
| new_hand_raisers | integer | Hand-raisers that day |
| new_qualified | integer | Qualified that day |
| new_vip | integer | VIP signups |
| new_premium | integer | Premium signups |
| new_funded | integer | Funded clients |
| total_revenue | decimal | Revenue that day |
| ad_spend | decimal | Ad spend that day |
| expenses | decimal | Other expenses |
| total_funded_amount | decimal | Total funding secured |

---

## Facebook Prospector Entities

### Prospect
A potential client found in Facebook groups.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| name | string | Full name |
| facebook_profile_url | string | Facebook profile link |
| found_in_group | string | Which group found in |
| status | enum | new, contacted, engaged, qualified, synced, not_interested |
| notes | text | Free-form notes |
| ghl_contact_id | string | After synced to GHL |
| created_at | timestamp | When added |
| last_contacted_at | timestamp | Last outreach |

### Prospect Group
Facebook groups being monitored.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| name | string | Group name |
| url | string | Group URL |
| prospect_count | integer | Prospects found |
| is_active | boolean | Currently monitoring |

---

## Skool-GHL Sync Entities

### Skool Member
A member of the Skool community.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| skool_user_id | string | Skool identifier |
| name | string | Display name |
| email | string | Email if available |
| ghl_contact_id | string | Linked GHL contact |
| sync_status | enum | unlinked, linked, error |
| last_activity_at | timestamp | Most recent activity |
| engagement_score | integer | Calculated engagement |

### Sync Event
Log of sync operations.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| skool_member_id | uuid | Member reference |
| event_type | enum | message_synced, contact_created, contact_updated, error |
| payload | jsonb | Event details |
| created_at | timestamp | When synced |

---

## Entity Relationships

```
┌─────────────┐     ┌─────────────┐
│   Contact   │────▶│    Event    │
└─────────────┘     └─────────────┘
       │
       │            ┌─────────────┐
       ├───────────▶│  Cohort     │
       │            │  Snapshot   │
       │            └─────────────┘
       │
       │            ┌─────────────┐
       └───────────▶│   Revenue   │
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Campaign   │
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Ad Metrics  │
                    └─────────────┘

┌─────────────┐     ┌─────────────┐
│  Prospect   │────▶│  Prospect   │
└─────────────┘     │   Group     │
       │            └─────────────┘
       │
       ▼
┌─────────────┐
│   Contact   │ (when synced to GHL)
└─────────────┘

┌─────────────┐     ┌─────────────┐
│Skool Member │────▶│ Sync Event  │
└─────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│   Contact   │ (when linked)
└─────────────┘
```

---

## Naming Conventions

- **Tables:** snake_case, plural (e.g., `contacts`, `ad_metrics`)
- **Columns:** snake_case (e.g., `created_at`, `ghl_contact_id`)
- **Enums:** snake_case values (e.g., `hand_raiser`, `not_interested`)
- **Foreign Keys:** `{entity}_id` (e.g., `contact_id`, `campaign_id`)
- **Timestamps:** Always with timezone (`TIMESTAMPTZ`)
