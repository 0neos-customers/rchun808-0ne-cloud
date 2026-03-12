# KPI Dashboard - Prep Status

> **Coordination File:** Updated by Session 2 (Prep/Planning), read by Session 1 (Build)

**Last Updated:** 2026-02-04 16:35
**Updated By:** Session 2 (Prep/Planning) - GHL data exported via API

---

## How To Use This File

**Session 2 (Prep/Planning):**
- Update this file when you complete configuration tasks
- Mark items as Ready ✅ when Build session can use them
- Document blockers or questions in the Blockers section

**Session 1 (Build):**
- Check this file before implementing GHL-dependent features
- Use placeholder/mock data until items are marked Ready ✅
- Add requests to the "Build Session Needs" section

---

## GHL Configuration

### Tag Mapping

| Funnel Stage | GHL Tags | Status | Notes |
|--------------|----------|--------|-------|
| lead | `lead`, `status - lead`, `skool - membership activated` | ✅ Ready | Primary: `lead` (ID: HpHfrEJVIE79gfLwG9ct) |
| hand_raiser | `skool - hand raised`, `skool - help form submitted`, `workshop - fruitful year hand raiser` | ✅ Ready | Primary: `skool - hand raised` (ID: 6GTfSDTutyfVKSFSiNka) |
| qualified | `status - pitched`, `status - offer made`, `status - offer viewed`, `waitlist - vip qualified` | ✅ Ready | Pitch/offer flow |
| vip | `skool - vip tier`, `client - business funding`, `status - client`, `business funding - signed up` | ✅ Ready | Primary: `skool - vip tier` (ID: bFKYnSMX87xKBJqdnxVG) |
| premium | `skool - premium tier`, `client - credit repair` | ✅ Ready | Primary: `skool - premium tier` (ID: pCyH25ztfEUfxnnf2ReO) |
| funded | `done funding`, `fulfillment - funding completed`, `fulfillment - funding secured` | ✅ Ready | Primary: `done funding` (ID: k1hSflypQwVEYs2BJbai) |

**Additional: Bad Credit Path Tags**
- `status - needs credit repair` (ID: AViPBKQ5CqL7B5jwFLWA)
- `business funding - needs credit repair` (ID: 2BFsmrE0q0MaTMkPzdsF)
- `credit repair` (ID: s3pWSQ81nIrrEhyHl68S)

**Ready for Build:** ✅ YES

### Custom Field Keys

| Field | GHL Key | Status | Notes |
|-------|---------|--------|-------|
| lead_age | `contact.lead_age` | ✅ Ready | NUMERICAL |
| client_age | `contact.days_as_client` | ✅ Ready | NUMERICAL |
| days_to_funding | `contact.days_to_funding_client` | ✅ Ready | NUMERICAL |
| epl_day_1 | `contact.lead_value_day_1` | ✅ Ready | MONETORY |
| epl_day_7 | `contact.lead_value_day_7` | ✅ Ready | MONETORY |
| epl_day_14 | `contact.lead_value_day_14` | ✅ Ready | MONETORY |
| epl_day_35 | `contact.lead_value_day_35` | ✅ Ready | MONETORY |
| epl_day_65 | `contact.lead_value_day_65` | ✅ Ready | MONETORY |
| epl_day_95 | `contact.lead_value_day_95` | ✅ Ready | MONETORY |
| epl_day_185 | `contact.lead_value_day_185` | ✅ Ready | MONETORY |
| epl_day_370 | `contact.lead_value_day_370` | ✅ Ready | MONETORY |

**Client Value (LTV) Fields Also Available:**
| Field | GHL Key | Notes |
|-------|---------|-------|
| ltv_day_1 | `contact.client_value_day_1` | MONETORY |
| ltv_day_7 | `contact.client_value_day_7` | MONETORY |
| ltv_day_14 | `contact.client_value_day_14` | MONETORY |
| ltv_day_35 | `contact.client_value_day_35` | MONETORY |
| ltv_day_65 | `contact.client_value_day_65` | MONETORY |
| ltv_day_95 | `contact.client_value_day_95` | MONETORY |
| ltv_day_185 | `contact.client_value_day_185` | MONETORY |
| ltv_day_370 | `contact.client_value_day_370` | MONETORY |
| client_value_total | `contact.client_value` | MONETORY |

**Ready for Build:** ✅ YES

### API Credentials

| Credential | Status | Notes |
|------------|--------|-------|
| GHL_API_KEY | ✅ Ready | Available in `~/.claude/.env` as `GHL_PRIVATE_INTEGRATION_TOKEN` |
| GHL_LOCATION_ID | ✅ Ready | Available in `~/.claude/.env` as `GHL_LOCATION_ID` |

**Ready for Build:** ✅ YES

**Note:** Copy these to the app's `.env.local` when ready:
```bash
# From ~/.claude/.env
GHL_API_KEY=$GHL_PRIVATE_INTEGRATION_TOKEN
GHL_LOCATION_ID=$GHL_LOCATION_ID
```

---

## Blockers for Build Session

*Items that the Build session cannot proceed without:*

1. ~~**Tag Mapping** - Need exact tag names to implement sync-ghl cron job~~ ✅ RESOLVED
2. ~~**Custom Field Keys** - Need exact keys to read lead_age, client_age, EPL values~~ ✅ RESOLVED

**Current Blockers:** None! GHL configuration is complete.

---

## Build Session Needs

*Items the Build session would like from Prep session:*

1. ~~Tag inventory with exact names~~ ✅ COMPLETE (254 tags documented)
2. ~~Custom field keys~~ ✅ COMPLETE (200+ fields, all cohort fields mapped)
3. GHL workflow screenshots for reference (optional but helpful)

---

## Future Automation Specs

**Status:** Not started

### Planned Automations

- [ ] **Lead Age Workflow** - Verify current GHL workflow is working correctly
- [ ] **Cohort Snapshot Workflow** - Design GHL workflow to capture EPL at milestone days
- [ ] **Credit Path Branching** - Design good credit vs bad credit path triggers
- [ ] **Meta Ads Sync** - Research Meta Marketing API requirements

### Documentation Locations

| Automation | Document | Status |
|------------|----------|--------|
| Lead Age | `GHL-SETUP.md` | ⏳ Not created |
| Cohort Snapshots | `FUTURE-AUTOMATIONS.md` | ⏳ Not created |
| Credit Path | `FUTURE-AUTOMATIONS.md` | ⏳ Not created |
| Meta Ads | `FUTURE-AUTOMATIONS.md` | ⏳ Not created |

---

## Session 2 Task Checklist

### GHL Configuration (Blocking) ✅ ALL COMPLETE
- [x] Export/document full GHL tag inventory (254 tags via API)
- [x] Map tags to funnel stages in table above
- [x] Find custom field keys for lead_age, client_age
- [x] Find custom field keys for EPL snapshot values
- [x] Get GHL API key (already in ~/.claude/.env)
- [x] Get GHL Location ID (already in ~/.claude/.env)

### Future Planning (Non-Blocking)
- [ ] Document current Lead Age workflow
- [ ] Design Cohort Snapshot automation
- [ ] Design Credit Path workflow
- [ ] Research Meta Ads API requirements

---

## How To Start Session 2

In a separate terminal:

```bash
cd "/Users/jimmyfuentes/Library/Mobile Documents/com~apple~CloudDocs/06 - Code/0ne"
claude

# First message:
"Read these files:
- 04 - Build/04-1 - Apps/0ne-app/product/sections/kpi-dashboard/PREP-STATUS.md
- 04 - Build/04-1 - Apps/0ne-app/product/sections/kpi-dashboard/SETUP-CHECKLIST.md

I'm running as the Prep/Planning session for KPI Dashboard.
Help me document GHL tags and custom fields. Do NOT modify any code files."
```

---

## Change Log

| Date | Session | Changes |
|------|---------|---------|
| 2026-02-04 | Build | Initial file creation |
| 2026-02-04 | Prep | GHL tag mapping complete (254 tags via API) |
| 2026-02-04 | Prep | Custom field keys complete (lead_age, days_as_client, all EPL/LTV fields) |
| 2026-02-04 | Prep | API credentials verified (already in ~/.claude/.env) |
| 2026-02-04 | Prep | Discovered company-level KPI custom_values (EPL, totals by cohort day) |
| 2026-02-04 | Prep | Documented questions for Jimmy to finalize tag mapping |

---

## Company-Level KPI Custom Values (DISCOVERED 2026-02-04)

These are **location-level** aggregate metrics (not per-contact):

### Totals
| Field | GHL Key | Current Value |
|-------|---------|---------------|
| Total Leads | `custom_values.total_leads` | 562 |
| Total Clients | `custom_values.total_clients` | 134 |
| Total Funding Clients | `custom_values.total_funding_clients` | 88 |
| Total Funded | `custom_values.total_funded` | *(empty)* |
| Total Revenue | `custom_values.total_revenue` | $155,673 |
| Total Lead Revenue | `custom_values.total_lead_revenue` | $41,456 |
| Total Transactions | `custom_values.total_transactions` | 169 |
| Total Referrals | `custom_values.total_referrals` | 165 |
| Total Referral Revenue | `custom_values.total_referral_revenue` | $45,175.50 |
| Total Referral Earnings | `custom_values.total_referral_earnings` | $9,000 |
| Revenue Per Referral | `custom_values.company_earnings_per_referral` | $273.79 |

### EPL by Cohort Day (Company Averages)
| Day | Field Key | Current EPL |
|-----|-----------|-------------|
| Day 1 | `custom_values.earnings_per_lead_day_001` | $4.67 |
| Day 7 | `custom_values.earnings_per_lead_day_007` | $7.51 |
| Day 14 | `custom_values.earnings_per_lead_day_014` | $8.51 |
| Day 35 | `custom_values.earnings_per_lead_day_035` | $11.13 |
| Day 65 | `custom_values.earnings_per_lead_day_065` | $15.25 |
| Day 95 | `custom_values.earnings_per_lead_day_095` | $18.26 |
| Day 185 | `custom_values.earnings_per_lead_day_185` | $75.18 |
| Day 370 | `custom_values.earnings_per_lead_day_370` | $94.42 |
| Lifetime | `custom_values.earnings_per_lead` | $73.77 |

### Total Leads by Cohort Day
| Day | Field Key | Count |
|-----|-----------|-------|
| Day 1 | `custom_values.total_leads_day_001` | 8,943 |
| Day 7 | `custom_values.total_leads_day_007` | 7,717 |
| Day 14 | `custom_values.total_leads_day_014` | 7,481 |
| Day 35 | `custom_values.total_leads_day_035` | 6,638 |
| Day 65 | `custom_values.total_leads_day_065` | 5,930 |
| Day 95 | `custom_values.total_leads_day_095` | 5,587 |
| Day 185 | `custom_values.total_leads_day_185` | 1,378 |
| Day 370 | `custom_values.total_leads_day_370` | 548 |

### Total Lead Revenue by Cohort Day
| Day | Field Key | Revenue |
|-----|-----------|---------|
| Day 1 | `custom_values.total_lead_revenue_day_001` | $41,749 |
| Day 7 | `custom_values.total_lead_revenue_day_007` | $57,916.50 |
| Day 14 | `custom_values.total_lead_revenue_day_014` | $63,667 |
| Day 35 | `custom_values.total_lead_revenue_day_035` | $73,900.50 |
| Day 65 | `custom_values.total_lead_revenue_day_065` | $90,425.50 |
| Day 95 | `custom_values.total_lead_revenue_day_095` | $102,042.50 |
| Day 185 | `custom_values.total_lead_revenue_day_185` | $103,604 |
| Day 370 | `custom_values.total_lead_revenue_day_370` | $51,646.50 |

### Total Clients by Cohort Day
| Day | Field Key | Count |
|-----|-----------|-------|
| Day 1 | `custom_values.total_clients_day_01` | 135 |
| Day 7 | `custom_values.total_clients_day_07` | 133 |
| Day 14 | `custom_values.total_clients_day_14` | 131 |
| Day 35 | `custom_values.total_clients_day_35` | 125 |
| Day 65 | `custom_values.total_clients_day_65` | 119 |
| Day 95 | `custom_values.total_clients_day_95` | 118 |
| Day 185 | `custom_values.total_clients_day_185` | 105 |
| Day 370 | `custom_values.total_clients_day_370` | 49 |

---

## Questions for Jimmy (Need Answers Before Finalizing)

### Tag Mapping Questions

1. **Lead Stage**: Should `skool - membership activated` be lead, or is `lead` + `status - lead` enough?

2. **Hand Raiser**: Should `status - interested` and `business funding - interested` also count as hand raisers?

3. **Qualified vs Client**: What's the exact boundary? `status - offer made` vs `business funding - signed up`?

4. **Skool Tiers**: How do `skool - standard tier`, `skool - premium tier`, `skool - vip tier` map to your funnel stages?

5. **Company-Level KPIs**: Do you want the dashboard to read these `custom_values`, or should we compute them from contact-level data?

### Other Tags to Consider

**Engagement/Interest signals:**
- `status - interested`
- `business funding - interested`
- `skool - interested`
- `newsletter - interested`

**Bad Credit Path:**
- `status - needs credit repair`
- `business funding - needs credit repair`
- `credit repair`
- `fulfillment - credit repair - active`

**Lost/Churned (for exclusion):**
- `lost`
- `status - not interested`
- `business funding - not interested`
- `business funding - refunded`
- `status - refunded`
- `skool - churned`
- `skool - fully churned`

---

## Full Reference Documentation

For exhaustive tag/field documentation with all IDs and env config templates:
- `02 - Projects/KPI-Dashboard/GHL-TAG-MAPPING.md`

Contains:
- All 254 tag names with IDs
- All custom field keys with data types
- Source attribution tags
- Lost/churned tags for exclusion
- Ready-to-copy .env.local config
