# Product Overview: 0ne Cloud

## One-Line Description

A unified personal augmentation platform that consolidates all operational tools under one roof - one authentication, one design system, one place to run the business.

---

## Vision

0ne Cloud is the **application layer** of the 0ne system. Just as the 0ne workspace consolidates all knowledge, context, and projects into one place, this app consolidates all **tools and interfaces** into a single deployable platform.

**Prime Directive:** Time is the only truly scarce resource. This platform exists to eliminate context-switching, reduce tool sprawl, and make business operations frictionless.

---

## Problems Solved

### 1. Tool Sprawl
**Pain:** Business operations scattered across GHL, Skool, Meta Ads, spreadsheets, and one-off scripts. Each tool has its own login, its own UI, its own mental overhead.

**Solution:** Single authenticated platform with all operational tools accessible from one home dashboard.

### 2. No Single Source of Truth for Metrics
**Pain:** KPIs live in spreadsheets. Funnel data in GHL. Ad spend in Meta. Revenue in multiple places. Getting the full picture requires opening 5 tabs and manual aggregation.

**Solution:** KPI Dashboard that pulls from all sources and presents unified metrics with cohort analysis, EPL/LTV tracking, and real-time funnel visualization.

### 3. Manual Prospecting
**Pain:** Finding and engaging potential clients in Facebook groups is tedious. Copy-pasting between Facebook and GHL. No systematic approach.

**Solution:** Facebook Prospector that identifies prospects, tracks engagement, and syncs directly to GHL.

### 4. Disconnected Community and CRM
**Pain:** Skool community conversations don't sync to GHL. Relationship context gets lost. Can't see full picture of member engagement.

**Solution:** Skool-GHL Sync that bridges the gap automatically.

### 5. Repeated Infrastructure Setup
**Pain:** Every new tool needs auth, database, hosting setup. Hours lost before writing actual feature code.

**Solution:** Shared infrastructure (Vercel, Supabase, Clerk) with permission-based access. New mini-apps launch in hours, not days.

---

## Core Principles

1. **One Source, Many Apps** - Single infrastructure serving multiple mini-apps
2. **Flexibility Over Rigidity** - Tech stack is a default, not a mandate
3. **Personal First** - Built for Jimmy's augmentation (can spin off to SaaS later)
4. **Rapid Deployment** - New mini-apps should launch in hours
5. **Design Coherence** - DesignOS ensures visual consistency across all apps

---

## Target Users

### Primary: Jimmy Fuentes (Admin)
- Full access to all mini-apps
- Permission management for other users
- The "why" behind everything built

### Secondary: Juan (Team Member)
- Access to specific apps based on role
- Operational usage, not configuration
- First test of multi-user experience

### Future: Additional Team / Clients
- Role-based access
- Potential to spin off specific apps as standalone products

---

## Key Features

### Platform-Level
- **Unified Authentication** - Single Clerk login for all apps
- **App Permission System** - Toggle access per user, per app
- **Home Dashboard** - App tiles showing available tools
- **Settings** - User profile, admin controls, preferences
- **Consistent Design** - DesignOS-powered UI across all apps

### KPI Dashboard
- Real-time funnel metrics (leads → hand-raisers → clients → funded)
- Cohort-based EPL (Earnings Per Lead) tracking at Day 1, 7, 14, 35, 65, 95, 185, 370
- LTV tracking per lead source and campaign
- Ad spend integration (Meta)
- Revenue tracking with attribution
- Good credit / bad credit segmentation

### Facebook Prospector
- Search Facebook groups for prospects
- Track engagement status
- Sync qualified prospects to GHL
- Notes and follow-up tracking

### Skool-GHL Sync
- Bi-directional message sync
- Member activity tracking
- Automatic contact creation/updates in GHL
- Engagement scoring

---

## Success Metrics

- **Operational:** All daily business operations accessible from one platform
- **Time Saved:** < 5 minutes to get full business snapshot (currently 30+)
- **Data Accuracy:** Single source of truth for all metrics
- **Extensibility:** New mini-app deployable in < 2 hours

---

## Technical Foundation

| Component | Technology | Purpose |
|-----------|------------|---------|
| Hosting | Vercel | Single project, routes per app |
| Database | Supabase | One instance, namespaced tables per app |
| Auth | Clerk | Single tenant, role-based permissions |
| Design | DesignOS | Tokens + shared component library |
| Framework | Next.js 16 | App router, server components |
| Language | TypeScript | Type safety throughout |
| Package Manager | Bun | Fast, reliable |
| Styling | Tailwind CSS v4 | Utility-first, design tokens |

---

## Out of Scope (For Now)

- Public-facing marketing site
- Client self-service portal
- Mobile native apps (web responsive is sufficient)
- Third-party integrations beyond GHL/Meta/Skool
- Multi-tenant SaaS architecture
