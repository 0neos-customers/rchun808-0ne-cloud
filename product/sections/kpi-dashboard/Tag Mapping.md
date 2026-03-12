# KPI Dashboard - Tag Mapping

> **Last Updated:** 2026-02-05
> **Source:** `02 - Projects/0ne-System/Cloud/GHL-TAG-MAPPING.md`

---

## Funnel Stages (Confirmed)

| Stage | GHL Tag | Notes |
|-------|---------|-------|
| Member | `skool - completed registration` | Base entry point (Skool registration) |
| Hand Raiser | `skool - hand raised` | Expressed interest (workshop, help form) |
| Qualified (Premium) | `skool - vip not qualified` | Self-qualified - needs credit repair |
| Qualified (VIP) | `skool - vip qualified` | Self-qualified - good credit |
| Offer Made | `skool - offer made` | Sent offer doc |
| Offer Seen | `skool - offer viewed` | Viewed (tracked with GHL trigger links) |
| VIP | `skool - vip tier` | Paid VIP tier |
| Premium | `skool - premium tier` | Paid Premium tier |

---

## Credit Status

| Status | GHL Tag |
|--------|---------|
| Good Credit | `skool - vip qualified` |
| Needs Credit Repair | `skool - vip not qualified` |

---

## Exclusion Tags

| Reason | GHL Tag | Notes |
|--------|---------|-------|
| Lost/Not Interested | `business funding - not interested` | |
| Refunded | `business funding - refunded` | |
| Churned | `skool - churned` | Canceled paid membership |
| Fully Churned | `skool - fully churned` | Left community entirely |

---

## Funnel Flow

```
                    ┌─────────────┐
                    │   Member    │
                    │ (skool reg) │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ Hand Raiser │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
       ┌──────▼──────┐          ┌──────▼──────┐
       │  Qualified  │          │  Qualified  │
       │  (Premium)  │          │    (VIP)    │
       │ needs credit│          │ good credit │
       └──────┬──────┘          └──────┬──────┘
              │                         │
              └────────────┬────────────┘
                           │
                    ┌──────▼──────┐
                    │ Offer Made  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ Offer Seen  │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
       ┌──────▼──────┐          ┌──────▼──────┐
       │   Premium   │          │     VIP     │
       │ (paid tier) │          │ (paid tier) │
       └─────────────┘          └─────────────┘
```

---

## Implementation

Config file: `apps/web/src/features/kpi/lib/config.ts`

- `TAG_MAPPINGS` - Maps GHL tags to funnel stages
- `CREDIT_STATUS_TAGS` - Credit path determination
- `EXCLUDE_TAGS` - Contacts to hide from reporting
- `FUNNEL_STAGE_ORDER` - Priority order (highest wins)
