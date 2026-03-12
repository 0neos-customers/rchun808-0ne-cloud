# Personal Expenses Mini App - Build State

> New "Personal" mini app for tracking personal expenses with manual input, burn rate, and category management.

## Phases

### Phase 1: Foundation (DB + Permissions + Navigation)
- [ ] SQL migration: `personal_expenses` table
- [ ] SQL migration: `personal_expense_categories` table
- [ ] Default categories seeded: Housing, Food, Transportation, Subscriptions
- [ ] RLS policies on both tables
- [ ] `personal` added to AppId in permissions.ts
- [ ] `personal` added to DEFAULT_PERMISSIONS
- [ ] Personal app config in apps.ts (Wallet icon, /personal route)
- [ ] Personal navigation in getAppNavigation (Expenses sub-page)
- [ ] Personal app added to Sidebar.tsx allAppsNavigation

### Phase 2: API Routes
- [ ] GET /api/personal/expenses — list + summary + monthly trends
- [ ] POST /api/personal/expenses — create expense
- [ ] PUT /api/personal/expenses — update expense
- [ ] PATCH /api/personal/expenses — toggle active
- [ ] DELETE /api/personal/expenses — remove expense
- [ ] GET /api/personal/expense-categories — list categories
- [ ] POST /api/personal/expense-categories — create category
- [ ] PUT /api/personal/expense-categories — update category
- [ ] DELETE /api/personal/expense-categories — delete category

### Phase 3: Frontend (Hooks + Page + Dialogs)
- [ ] Feature directory: features/personal/
- [ ] Hook: use-personal-expenses.ts
- [ ] Hook: use-personal-expense-categories.ts
- [ ] Component: ExpenseDialog.tsx (adapted from KPI)
- [ ] Component: CategoryDialog.tsx (adapted from KPI)
- [ ] Page: app/personal/expenses/page.tsx
- [ ] Page: app/personal/page.tsx (overview/redirect)

## Key Files

- `packages/auth/src/permissions.ts` — AppId type
- `apps/web/src/lib/apps.ts` — App config + navigation
- `apps/web/src/components/shell/Sidebar.tsx` — Sidebar navigation
- `packages/db/schemas/kpi.sql` — Reference for schema patterns
- `apps/web/src/app/kpi/expenses/page.tsx` — Reference for UI patterns
- `apps/web/src/features/kpi/hooks/use-kpi-data.ts` — Reference for hooks

## Notes

- Personal categories: Housing, Food, Transportation, Subscriptions (minimal set)
- No business logic: no ad_metrics, no ROI, no channel performance
- Separate tables from business expenses
- Future: Relay.fi banking integration via Plaid for live balance data
