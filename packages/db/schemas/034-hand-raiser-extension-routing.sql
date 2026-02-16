-- =============================================
-- Migration 034: Hand-Raiser Extension Routing
-- =============================================
-- Enables extension-based DM routing for hand-raiser campaigns
-- Run in Supabase SQL Editor or via psql

-- 1. Make dm_template nullable (allow GHL-only mode)
-- Campaigns without dm_template will only tag GHL contacts
ALTER TABLE dm_hand_raiser_campaigns
ALTER COLUMN dm_template DROP NOT NULL;

-- 2. Add source column to dm_messages for routing
-- Values: 'ghl' (from GHL), 'hand-raiser', 'manual'
ALTER TABLE dm_messages
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'ghl';

COMMENT ON COLUMN dm_messages.source IS 'Message source: ghl (from GHL), hand-raiser, manual';

-- 3. Index for extension polling (picks up hand-raiser messages)
-- Extension queries: direction='outbound' AND status='pending' AND source='hand-raiser'
CREATE INDEX IF NOT EXISTS idx_dm_messages_extension_outbound
ON dm_messages (user_id, direction, status, source)
WHERE direction = 'outbound' AND status = 'pending';
