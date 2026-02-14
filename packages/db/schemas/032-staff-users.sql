-- =============================================
-- STAFF USERS TABLE
-- =============================================
-- Phase 5: Multi-Staff Support for Skool-GHL DM Sync
-- Links Skool staff users to GHL users for message attribution
-- Run in Supabase SQL Editor

-- =============================================
-- STAFF USERS TABLE
-- Maps Skool staff members to GHL users
-- =============================================
CREATE TABLE IF NOT EXISTS staff_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,  -- 0ne-app user (Clerk ID) - the account owner
  skool_user_id TEXT UNIQUE NOT NULL,  -- Skool user ID (must be unique across system)
  skool_username TEXT,  -- Skool @username
  display_name TEXT NOT NULL,  -- Display name for prefixes (e.g., "Jimmy", "Juan")
  ghl_user_id TEXT,  -- GHL user ID for outbound routing
  is_default BOOLEAN DEFAULT FALSE,  -- Is this the default staff for fallback routing?
  is_active BOOLEAN DEFAULT TRUE,  -- Active flag
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ADD STAFF COLUMNS TO DM_MESSAGES
-- =============================================
-- These track which staff member sent/received each message
ALTER TABLE dm_messages ADD COLUMN IF NOT EXISTS staff_skool_id TEXT;
ALTER TABLE dm_messages ADD COLUMN IF NOT EXISTS staff_display_name TEXT;

-- =============================================
-- ADD GHL USER TRACKING TO DM_MESSAGES
-- For outbound messages from GHL, track which GHL user sent it
-- =============================================
ALTER TABLE dm_messages ADD COLUMN IF NOT EXISTS ghl_user_id TEXT;

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_staff_users_user_id ON staff_users(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_users_ghl_user_id ON staff_users(ghl_user_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_staff ON dm_messages(staff_skool_id);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;

-- Service role full access (auth handled via Clerk)
CREATE POLICY "Service role full access" ON staff_users FOR ALL USING (true);

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================
CREATE TRIGGER update_staff_users_updated_at
  BEFORE UPDATE ON staff_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON TABLE staff_users IS 'Maps Skool staff users to GHL users for multi-staff DM attribution';
COMMENT ON COLUMN staff_users.user_id IS '0ne-app account owner (Clerk ID)';
COMMENT ON COLUMN staff_users.skool_user_id IS 'Skool user ID for this staff member';
COMMENT ON COLUMN staff_users.display_name IS 'Name shown in message prefixes (e.g., Jimmy)';
COMMENT ON COLUMN staff_users.ghl_user_id IS 'GHL user ID for outbound routing';
COMMENT ON COLUMN staff_users.is_default IS 'Default staff for fallback routing when no match found';
COMMENT ON COLUMN dm_messages.staff_skool_id IS 'Skool ID of staff member who sent/received message';
COMMENT ON COLUMN dm_messages.staff_display_name IS 'Display name of staff at time of sync';
COMMENT ON COLUMN dm_messages.ghl_user_id IS 'GHL user ID who sent outbound message (from webhook)';
