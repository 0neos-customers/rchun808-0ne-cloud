-- =============================================
-- CONTACTS REIMAGINE MIGRATION
-- Make ghl_contact_id nullable, add contact_type/email/phone/updated_at
-- Backfill existing data from skool_members and dm_messages
-- =============================================

-- 1. Make ghl_contact_id nullable (the core blocker)
ALTER TABLE dm_contact_mappings ALTER COLUMN ghl_contact_id DROP NOT NULL;

-- 2. Add new columns
ALTER TABLE dm_contact_mappings ADD COLUMN IF NOT EXISTS contact_type TEXT DEFAULT 'unknown';
ALTER TABLE dm_contact_mappings ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE dm_contact_mappings ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE dm_contact_mappings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. Indexes for new query patterns
CREATE INDEX IF NOT EXISTS idx_dcm_unmatched
  ON dm_contact_mappings(clerk_user_id) WHERE ghl_contact_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_dcm_contact_type
  ON dm_contact_mappings(contact_type);

-- 4. Backfill contact_type for existing rows
UPDATE dm_contact_mappings dcm
SET contact_type = CASE
  WHEN EXISTS (SELECT 1 FROM skool_members sm WHERE sm.skool_user_id = dcm.skool_user_id)
  THEN 'community_member'
  ELSE 'dm_contact'
END
WHERE dcm.contact_type IS NULL OR dcm.contact_type = 'unknown';

-- 5. Backfill email from skool_members
UPDATE dm_contact_mappings dcm
SET email = sm.email
FROM skool_members sm
WHERE sm.skool_user_id = dcm.skool_user_id
  AND sm.email IS NOT NULL AND dcm.email IS NULL;

-- 6. Backfill: Create entries for DM contacts not yet in dm_contact_mappings
INSERT INTO dm_contact_mappings (clerk_user_id, skool_user_id, skool_display_name, ghl_contact_id, match_method, contact_type, email, created_at)
SELECT DISTINCT ON (m.clerk_user_id, m.skool_user_id)
  m.clerk_user_id,
  m.skool_user_id,
  COALESCE(
    (SELECT sender_name FROM dm_messages WHERE skool_user_id = m.skool_user_id AND sender_name IS NOT NULL AND sender_name != 'Unknown' ORDER BY created_at DESC LIMIT 1),
    NULL
  ),
  sm.ghl_contact_id,
  CASE WHEN sm.ghl_contact_id IS NOT NULL THEN 'skool_members' ELSE NULL END,
  CASE WHEN sm.skool_user_id IS NOT NULL THEN 'community_member' ELSE 'dm_contact' END,
  sm.email,
  NOW()
FROM dm_messages m
LEFT JOIN skool_members sm ON sm.skool_user_id = m.skool_user_id
WHERE NOT EXISTS (
  SELECT 1 FROM dm_contact_mappings dcm
  WHERE dcm.clerk_user_id = m.clerk_user_id AND dcm.skool_user_id = m.skool_user_id
)
AND m.skool_user_id NOT IN (SELECT skool_user_id FROM staff_users)
AND m.direction = 'inbound'
ORDER BY m.clerk_user_id, m.skool_user_id, m.created_at DESC;
