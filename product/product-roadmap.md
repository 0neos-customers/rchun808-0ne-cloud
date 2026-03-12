# Product Roadmap: 0ne Cloud

## Development Sections

0ne Cloud is organized into distinct sections that can be designed and built independently. Each section represents a self-contained area of functionality.

---

## Section 0: Platform Foundation

**Description:** The shared infrastructure that all mini-apps depend on. Authentication, permissions, home dashboard, and settings.

**Key Screens:**
- Home Dashboard (app tiles)
- Sign In / Sign Up
- User Settings
- Admin: User Management
- Admin: Permission Management

**Status:** In Progress (auth and basic structure working)

---

## Section 1: KPI Dashboard

**Description:** Real-time business intelligence showing funnel metrics, cohort analysis, and financial KPIs. Pulls data from GHL, Meta Ads, and Supabase.

**Key Screens:**
- Dashboard Overview (headline metrics)
- Funnel View (stage breakdown with conversion rates)
- Cohort Analysis (EPL/LTV by time bucket)
- Campaign Performance (per-campaign breakdown)
- Revenue & Expenses (P&L view)

**Data Sources:**
- GoHighLevel API (contacts, tags, opportunities)
- Meta Ads API (spend, impressions, clicks)
- Supabase (aggregated metrics, events, snapshots)

**Status:** Schema created, UI stubbed

---

## Section 2: Facebook Prospector

**Description:** Tool for finding and tracking potential clients in Facebook groups. Systematizes the prospecting workflow.

**Key Screens:**
- Prospect List (searchable, filterable table)
- Prospect Profile (details, notes, history)
- Add Prospect (manual entry form)
- Group Tracker (which groups being monitored)

**Workflow:**
1. Find prospect in Facebook group
2. Add to Prospector with context
3. Track engagement status
4. When qualified, sync to GHL

**Status:** Not started

---

## Section 3: Skool-GHL Sync

**Description:** Bridges Skool community activity with GoHighLevel CRM. Ensures relationship context flows between platforms.

**Key Screens:**
- Sync Dashboard (connection status, recent activity)
- Member List (Skool members with GHL link status)
- Sync Log (history of synced messages/events)
- Settings (sync preferences, field mapping)

**Workflow:**
1. Monitor Skool for DM activity
2. Match to GHL contact (or create)
3. Sync conversation context
4. Update engagement score

**Status:** Not started

---

## Build Order

| Priority | Section | Rationale |
|----------|---------|-----------|
| 1 | Platform Foundation | Everything depends on this |
| 2 | KPI Dashboard | Highest daily value, data already exists |
| 3 | Facebook Prospector | Systematizes current manual workflow |
| 4 | Skool-GHL Sync | Automation layer, less urgent |

---

## Future Sections (Candidates)

These may be added to the Everything App as needs arise:

- **Content Scheduler** - Queue and schedule social posts
- **Client Portal** - Client-facing status dashboard
- **Playbook Tracker** - Track implementation of business playbooks
- **Meeting Prep** - Auto-generate context for upcoming calls

---

## Section Interdependencies

```
Platform Foundation
       │
       ├── KPI Dashboard (uses shared auth, design system)
       │
       ├── Facebook Prospector (uses shared auth, design system, GHL integration)
       │
       └── Skool-GHL Sync (uses shared auth, design system, GHL integration)
```

All sections share:
- Clerk authentication
- Supabase database connection
- DesignOS design tokens
- Shared UI component library
