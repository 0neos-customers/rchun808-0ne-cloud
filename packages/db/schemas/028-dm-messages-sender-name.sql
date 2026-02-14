-- =============================================
-- DM MESSAGES: ADD SENDER_NAME COLUMN
-- =============================================
-- Migration for Skool-GHL DM Sync extension messages
-- Adds sender_name column for better contact matching
-- Run in Supabase SQL Editor

-- Add sender_name column for better contact matching when lookup fails
ALTER TABLE dm_messages ADD COLUMN IF NOT EXISTS sender_name TEXT;

-- Create index for finding extension-captured messages needing GHL sync
CREATE INDEX IF NOT EXISTS idx_dm_messages_pending_ghl_sync
ON dm_messages(user_id)
WHERE ghl_message_id IS NULL AND status = 'pending';

-- Comment for documentation
COMMENT ON COLUMN dm_messages.sender_name IS 'Sender display name from extension (for contact matching when skool_user_id lookup fails)';
