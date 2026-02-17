-- =============================================
-- 035: RENAME user_id COLUMNS FOR CLARITY
-- =============================================
-- Problem: "user_id" is ambiguous - some tables use it for Clerk IDs,
-- others for Skool staff IDs. This migration renames them to be explicit:
--   clerk_user_id  = Clerk authentication ID (user_xxx format)
--   staff_skool_id = Skool user ID identifying a staff member
--
-- Run in Supabase SQL Editor
-- =============================================

BEGIN;

-- =============================================
-- PART 1: DM tables (user_id → clerk_user_id)
-- These all store the Clerk user ID of the account owner
-- =============================================

ALTER TABLE dm_sync_config RENAME COLUMN user_id TO clerk_user_id;
ALTER TABLE dm_contact_mappings RENAME COLUMN user_id TO clerk_user_id;
ALTER TABLE dm_messages RENAME COLUMN user_id TO clerk_user_id;
ALTER TABLE dm_hand_raiser_campaigns RENAME COLUMN user_id TO clerk_user_id;

-- =============================================
-- PART 2: Staff & notification tables (user_id → clerk_user_id)
-- =============================================

ALTER TABLE staff_users RENAME COLUMN user_id TO clerk_user_id;
ALTER TABLE notification_preferences RENAME COLUMN user_id TO clerk_user_id;

-- =============================================
-- PART 3: Skool data tables (user_id → staff_skool_id)
-- These store the Skool user ID of the staff member who owns the data
-- =============================================

-- skool_members already has no user_id column (uses skool_user_id natively)
ALTER TABLE skool_kpis RENAME COLUMN user_id TO staff_skool_id;
ALTER TABLE skool_analytics RENAME COLUMN user_id TO staff_skool_id;

-- =============================================
-- PART 4: Column comments describing what each renamed column stores
-- =============================================

-- DM tables
COMMENT ON COLUMN dm_sync_config.clerk_user_id IS 'Clerk authentication ID (user_xxx) - the 0ne-app account owner';
COMMENT ON COLUMN dm_contact_mappings.clerk_user_id IS 'Clerk authentication ID (user_xxx) - the 0ne-app account owner';
COMMENT ON COLUMN dm_messages.clerk_user_id IS 'Clerk authentication ID (user_xxx) - the 0ne-app account owner';
COMMENT ON COLUMN dm_hand_raiser_campaigns.clerk_user_id IS 'Clerk authentication ID (user_xxx) - the 0ne-app account owner';

-- Staff & notification tables
COMMENT ON COLUMN staff_users.clerk_user_id IS 'Clerk authentication ID (user_xxx) - the 0ne-app account owner';
COMMENT ON COLUMN notification_preferences.clerk_user_id IS 'Clerk authentication ID (user_xxx) - the 0ne-app account owner';

-- Skool data tables
COMMENT ON COLUMN skool_kpis.staff_skool_id IS 'Skool user ID of the staff member who owns/manages this data';
COMMENT ON COLUMN skool_analytics.staff_skool_id IS 'Skool user ID of the staff member who owns/manages this data';

-- =============================================
-- PART 5: Data backfill for dm_messages
-- Fix the mixed-ID bug: some dm_messages rows have a Skool user ID
-- in clerk_user_id instead of a Clerk ID. This backfill corrects them
-- by looking up the Clerk ID from staff_users via skool_user_id.
-- =============================================

UPDATE dm_messages
SET clerk_user_id = s.clerk_user_id
FROM staff_users s
WHERE dm_messages.staff_skool_id = s.skool_user_id
  AND dm_messages.clerk_user_id NOT LIKE 'user_%';

COMMIT;

-- =============================================
-- ROLLBACK (reverse all renames):
-- =============================================
-- BEGIN;
-- ALTER TABLE dm_sync_config RENAME COLUMN clerk_user_id TO user_id;
-- ALTER TABLE dm_contact_mappings RENAME COLUMN clerk_user_id TO user_id;
-- ALTER TABLE dm_messages RENAME COLUMN clerk_user_id TO user_id;
-- ALTER TABLE dm_hand_raiser_campaigns RENAME COLUMN clerk_user_id TO user_id;
-- ALTER TABLE staff_users RENAME COLUMN clerk_user_id TO user_id;
-- ALTER TABLE notification_preferences RENAME COLUMN clerk_user_id TO user_id;
-- ALTER TABLE skool_kpis RENAME COLUMN staff_skool_id TO user_id;
-- ALTER TABLE skool_analytics RENAME COLUMN staff_skool_id TO user_id;
-- COMMIT;
