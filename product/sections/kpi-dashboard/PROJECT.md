# KPI Dashboard - Strategy & KPIs

**Migrated from:** `02 - Projects/KPI-Dashboard/PROJECT.md`
**Date:** 2026-02-04

---

## Overview

Build a KPI dashboard to track Fruitful Funding business metrics across the entire customer lifecycle.

---

## Your Funnel (from Strategy Docs)

```
Meta Ads → Skool Join → Nurture (Posts) → Hand Raiser → DM Conversation
    → Sell by Chat → Offer Doc Sent → Premium/VIP → Onboard → Fund → Refer
```

**Key insight from Hormozi analysis:** Your success metrics are TBD. You can't diagnose constraints without numbers.

---

## KPIs by Funnel Stage

### 1. MARKET TO LEAD (Awareness → Interest)

**Goal:** Generate interest, turn strangers into leads

| KPI | What It Tells You | Source | Your List |
|-----|-------------------|--------|-----------|
| **Ad Spend** | Investment in acquisition | Meta Ads | ✅ |
| **Impressions** | Reach/awareness | Meta Ads | |
| **CPM** | Cost efficiency of reach | Meta Ads | |
| **CTR** | Ad resonance | Meta Ads | |
| **Link Clicks** | Interest generated | Meta Ads | |
| **Cost Per Click (CPC)** | Efficiency of interest | Meta Ads | |
| **Skool Page Views** | Top of funnel volume | Skool/Analytics | |
| **Skool Joins** (this week vs last) | Lead acquisition | Skool | ✅ (Members) |
| **Cost Per Skool Join** | True CPL | Calculated | |
| **Content Published** | Volume (the "MORE" check) | Manual | |
| **YouTube Views/Subs** | Content reach | YouTube | |

### 2. LEAD TO SALE (Interest → Purchase)

**Goal:** Convert Skool members into Premium/VIP customers

#### 2A. Nurture & Engagement
| KPI | What It Tells You | Source | Your List |
|-----|-------------------|--------|-----------|
| **Skool Members** (total) | Audience size | Skool | ✅ |
| **Active Members** (30-day) | Engaged audience | Skool | |
| **Post Engagement Rate** | Content resonance | Skool | |
| **Email Delivered** | List health | GHL | ✅ |
| **Email Opens** (this month vs last) | Subject line performance | GHL | ✅ |
| **Email Click Rate** | Content resonance | GHL | |

#### 2B. Hand Raiser → Conversation
| KPI | What It Tells You | Source | Your List |
|-----|-------------------|--------|-----------|
| **Hand Raiser Comments** | Interest signals | Skool (manual) | |
| **New Chat Starts** | Conversations initiated | GHL/Skool | ✅ |
| **DM Response Rate** | Engagement quality | GHL | |
| **Conversations Active** | Pipeline health | GHL | |

#### 2C. Sales Conversion
| KPI | What It Tells You | Source | Your List |
|-----|-------------------|--------|-----------|
| **VSL Opt-ins** (this week vs last) | Funnel interest | GHL | ✅ |
| **Offer Docs Sent** | Sales activity | GHL/Manual | |
| **Applications** (this week vs last) | Intent to buy | GHL | ✅ |
| **Appointments/Calls** (this week vs last) | Sales conversations | GHL | ✅ |
| **Workshop Registrations** (this month vs last) | Event interest | GHL | ✅ |
| **Workshop Show-up Rate** | Registration quality | GHL | |
| **VIP Offers Made** | Sales attempts | Manual | |
| **Premium Conversions** | Low-tier sales | GHL/Stripe | |
| **VIP Conversions** | High-tier sales | GHL/Stripe | |
| **Close Rate (Text Sales)** | Sales effectiveness | Calculated | |
| **Avg Deal Size** | Revenue per customer | Calculated | |

### 3. SALE TO DELIVERY (Purchase → Onboarding)

**Goal:** Seamlessly onboard and prepare for delivery

| KPI | What It Tells You | Source | Your List |
|-----|-------------------|--------|-----------|
| **Premium Members** (total) | Recurring revenue base | Stripe/Skool | |
| **VIP Clients** (active) | High-value client count | GHL | |
| **Onboarding Completion Rate** | Delivery readiness | GHL | |
| **Days to Onboard** | Speed to value | GHL | |
| **Churn Rate** (Premium) | Retention health | Stripe | |

### 4. DELIVERY TO SUCCESS (Onboarding → Value)

**Goal:** Deliver promised results

| KPI | What It Tells You | Source | Your List |
|-----|-------------------|--------|-----------|
| **Clients in Pipeline** | Delivery workload | GHL | |
| **Funding Secured** (this month) | Core result delivery | Manual | |
| **Avg Funding Amount** | Client value delivered | Manual | |
| **Pass Rate** | Success rate | Manual | |
| **Days to Funding** | Speed to result | Manual | |
| **Client NPS/CSAT** | Satisfaction | Survey | |

### 5. SUCCESS TO LEAD (Advocacy)

**Goal:** Turn success into referrals

| KPI | What It Tells You | Source | Your List |
|-----|-------------------|--------|-----------|
| **Testimonials Collected** | Social proof assets | Manual | |
| **Case Studies Published** | Proof content | Manual | |
| **Referrals Received** | Word of mouth | GHL | |
| **Upsells (Premium → VIP)** | Expansion revenue | Stripe | |

---

## Financial KPIs (The Math)

From Hormozi: "You can't run constraint diagnosis without metrics."

| KPI | Target | Formula | Notes |
|-----|--------|---------|-------|
| **Revenue MTD** | $20K/mo = $240K/yr | | 2x 2025 |
| **Revenue YTD** | Track to $240K | | |
| **VIPs Needed/Month** | ~5 | $40K gross ÷ ~$7,900 avg | Assuming 50/50 split |
| **CAC** | | Ad Spend ÷ New Customers | |
| **LTV** | | Avg revenue per customer lifetime | |
| **LTV:CAC Ratio** | 3:1 minimum | | |
| **30-Day Gross Profit** | | Revenue - COGS in first 30 days | |
| **Payback Period** | <30 days ideal | Days to recoup CAC | |
| **Gross Margin** | | (Revenue - COGS) ÷ Revenue | |
| **MRR** (Premium) | | Premium members × $100 | |

---

## Constraint Diagnosis KPIs (Mozi Six)

Track these to identify your current constraint:

| Constraint | Diagnostic Metric | Question |
|------------|-------------------|----------|
| **MORE** | Volume metrics (content, outreach, offers) | Have we done this 100 times? |
| **METRICS** | Data completeness | Are all KPIs populated? |
| **MARKET** | Skool join rate plateau | Have we saturated our channels? |
| **MODEL - Leads** | Cost per Skool join, lead volume | Can we afford leads? |
| **MODEL - Sales** | Close rate, show-up rate | Can we convert? |
| **MODEL - LTV** | Avg funding amount, churn | Are customers worth enough? |
| **MONEY** | Runway, cash flow | Can we afford to scale? |
| **MANPOWER** | Capacity utilization | Is Jimmy the bottleneck? |

---

## Data Sources Summary

| Source | KPIs | Collection Method |
|--------|------|-------------------|
| **GHL** | Most funnel metrics | API sync (hourly) |
| **Meta Ads** | Ad performance | API sync (daily) |
| **Skool** | Community metrics | Manual or Skoot extension |
| **Stripe** | Revenue, churn | Webhook or manual |
| **YouTube** | Content metrics | Manual |
| **Manual** | Funding results, testimonials | Weekly entry |
