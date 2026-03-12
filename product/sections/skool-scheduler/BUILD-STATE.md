# Skool Post Scheduler - Build State

> **Last Updated:** 2026-02-09
> **Status:** In Progress - Sidebar Added, HTML Issue Fixed, Ready for Import

---

## Overview

The Skool Post Scheduler automates community post publishing with rotating content variations. This replaces the Make.com workflow with a native solution inside 0ne-app.

---

## Implementation Status

### Phase 1: Database Schema ✅ COMPLETE
- [x] Created `packages/db/schemas/skool-scheduler.sql`
  - `skool_scheduled_posts` - Schedule slots (7 records)
  - `skool_post_library` - Post variations (88 records)
  - `skool_post_execution_log` - Audit trail
- [x] Created TypeScript types at `packages/db/src/types/scheduler.ts`
- [x] Helper functions: `get_next_post_for_schedule()`, `mark_post_used()`, `get_due_schedules()`

### Phase 2: Skool Post API ✅ COMPLETE
- [x] Created `apps/web/src/features/skool/lib/post-client.ts`
  - `uploadFileFromUrl()` - Upload images to Skool
  - `createPost()` - Create community posts
  - `getCategories()` - Fetch category labels
  - `discoverEndpoints()` - Helper for API discovery

**Note:** The exact Skool API endpoints need to be confirmed via browser DevTools. The implementation tries multiple likely endpoints.

### Phase 3: Navigation & Pages ✅ COMPLETE
- [x] Updated `apps/web/src/lib/apps.ts` - Added Skool Scheduler app
- [x] Updated `packages/auth/src/permissions.ts` - Added `skoolScheduler` to AppId
- [x] Created page shells:
  - `/skool` - Redirects to scheduler
  - `/skool/scheduler` - Schedule management
  - `/skool/posts` - Post library
  - `/skool/log` - Execution history

### Phase 4: Cron Job ✅ COMPLETE
- [x] Created `apps/web/src/app/api/cron/skool-post-scheduler/route.ts`
- [x] Registered in `apps/web/src/features/settings/lib/cron-registry.ts`
- [x] Added `skool_posts` to SyncType in `apps/web/src/lib/sync-log.ts`

**Cron Logic:**
1. Get current time in ET (America/New_York)
2. Find schedulers due (day_of_week + time window + not run today)
3. For each: select oldest unused post → upload image → create post → log execution

### Phase 5: API Routes ✅ COMPLETE
- [x] `POST/GET/PUT/DELETE /api/skool/schedulers` - CRUD for schedule slots
- [x] `POST/GET/PUT/DELETE /api/skool/posts` - CRUD for post library
- [x] `GET/POST /api/skool/execution-log` - Execution history
- [x] `GET /api/skool/categories` - Fetch Skool categories

### Phase 6: UI Components ✅ COMPLETE
- [x] Data fetching hooks:
  - `use-schedulers.ts`
  - `use-post-library.ts`
  - `use-execution-log.ts`
  - `use-categories.ts`
- [x] Dialog components:
  - `SchedulerDialog.tsx` - Create/edit schedules
  - `PostDialog.tsx` - Create/edit posts
  - `ConfirmDialog.tsx` - Delete confirmation
  - `PostPreviewPopover.tsx` - Content preview
- [x] Updated page components with full UI

### Phase 7: Data Import ✅ COMPLETE
- [x] Created `scripts/import-skool-scheduler.ts`
- [x] Created `packages/db/schemas/skool-scheduler-constraints.sql`
- [x] Added `import:scheduler` script to package.json

---

## Files Created

### Database
- `packages/db/schemas/skool-scheduler.sql`
- `packages/db/schemas/skool-scheduler-constraints.sql`
- `packages/db/src/types/scheduler.ts`

### API Routes
- `apps/web/src/app/api/cron/skool-post-scheduler/route.ts`
- `apps/web/src/app/api/skool/schedulers/route.ts`
- `apps/web/src/app/api/skool/posts/route.ts`
- `apps/web/src/app/api/skool/execution-log/route.ts`
- `apps/web/src/app/api/skool/categories/route.ts`

### Pages
- `apps/web/src/app/skool/layout.tsx`
- `apps/web/src/app/skool/page.tsx`
- `apps/web/src/app/skool/scheduler/page.tsx`
- `apps/web/src/app/skool/posts/page.tsx`
- `apps/web/src/app/skool/log/page.tsx`

### Features/Components
- `apps/web/src/features/skool/lib/post-client.ts`
- `apps/web/src/features/skool/hooks/use-schedulers.ts`
- `apps/web/src/features/skool/hooks/use-post-library.ts`
- `apps/web/src/features/skool/hooks/use-execution-log.ts`
- `apps/web/src/features/skool/hooks/use-categories.ts`
- `apps/web/src/features/skool/components/SchedulerDialog.tsx`
- `apps/web/src/features/skool/components/PostDialog.tsx`
- `apps/web/src/features/skool/components/ConfirmDialog.tsx`
- `apps/web/src/features/skool/components/PostPreviewPopover.tsx`

### Scripts
- `scripts/import-skool-scheduler.ts`

---

## Next Steps (Testing)

### 1. Deploy Database Schema
```bash
psql "$DATABASE_URL" -f packages/db/schemas/skool-scheduler.sql
psql "$DATABASE_URL" -f packages/db/schemas/skool-scheduler-constraints.sql
```

### 2. Import CSV Data
```bash
cd /Users/jimmyfuentes/Library/Mobile\ Documents/com\~apple\~CloudDocs/06\ -\ Code/0ne/03\ -\ BUILD/03-1\ -\ Apps/0ne-app
bun run import:scheduler
```

### 3. Test UI
1. Run `bun dev` in apps/web
2. Navigate to `/skool/scheduler`
3. Verify schedulers display
4. Navigate to `/skool/posts`
5. Verify posts display with filtering

### 4. Discover Skool API Endpoints
The post creation endpoints need confirmation. Use browser DevTools:
1. Open Skool in browser, go to group community
2. Open DevTools > Network tab
3. Create a new post
4. Note the POST request URL and payload
5. Update `apps/web/src/features/skool/lib/post-client.ts`

### 5. Test Cron Job
```bash
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/skool-post-scheduler"
```

### 6. Set Up Vercel Cron
Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/skool-post-scheduler",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

---

## Categories Reference

| Category | Schedule Slots |
|----------|---------------|
| The Money Room | Sunday 09:00, Monday 09:00, Monday 18:55 |
| Funding Club | Tuesday 09:00, Tuesday 18:55 |
| Funding Hot Seat | Wednesday 09:00, Wednesday 18:55 |

---

## Known Limitations

1. ~~**Skool API endpoints not confirmed**~~ ✅ **CONFIRMED** - POST /posts?follow=true with WAF token

2. **Category IDs** - Need to map category names to Skool label IDs:
   - Example confirmed: `a1957af7925046f2871bae44f68e0208`

3. **Image upload** - Endpoint confirmed as POST /files, needs testing with actual image

## API Notes (Confirmed 2026-02-09)

**Post Creation:**
- Endpoint: `POST https://api2.skool.com/posts?follow=true`
- Required header: `x-aws-waf-token` (extracted from cookies)
- **IMPORTANT: Skool does NOT support HTML** - Content displays as literal text
- Use plain text with markdown-style links: `[Link Text](https://example.com)`
- Payload structure:
```json
{
  "post_type": "generic",
  "group_id": "...",
  "metadata": {
    "title": "...",
    "content": "Plain text with [markdown links](https://example.com)",
    "attachments": "",
    "labels": "category_id",
    "action": 0,
    "video_ids": ""
  }
}
```

---

## Session Status (2026-02-09)

### Completed This Session:
- [x] Added Skool Scheduler to sidebar navigation (Sidebar.tsx)
- [x] Documented that Skool does NOT support HTML (plain text only)

### Ready for Next Steps:
1. **Run database migrations** (if not done):
   ```bash
   psql "$DATABASE_URL" -f packages/db/schemas/skool-scheduler.sql
   psql "$DATABASE_URL" -f packages/db/schemas/skool-scheduler-constraints.sql
   ```

2. **Import CSV data**:
   ```bash
   cd "04 - Build/04-1 - Apps/0ne-app"
   bun run import:scheduler
   ```

3. **Enable skoolScheduler permission** for your user in Clerk

4. **Test the UI** at `/skool/scheduler`
