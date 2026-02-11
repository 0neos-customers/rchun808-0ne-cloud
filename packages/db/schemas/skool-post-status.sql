-- =============================================================================
-- SKOOL POST STATUS MIGRATION
-- =============================================================================
-- Adds status workflow (draft/approved/active) and source tracking to post library
-- Purpose: Enable external API to create draft posts for review before scheduling
-- =============================================================================

-- Add status field to skool_post_library
-- Values: 'draft' (created by API), 'approved' (ready for scheduling), 'active' (legacy, same as approved)
ALTER TABLE skool_post_library
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
  CHECK (status IN ('draft', 'approved', 'active'));

-- Add source tracking (who created the post)
ALTER TABLE skool_post_library
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'
  CHECK (source IN ('manual', 'api', 'import'));

-- Add approval tracking
ALTER TABLE skool_post_library
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Index for status filtering (used by UI and scheduler)
CREATE INDEX IF NOT EXISTS idx_skool_post_library_status
  ON skool_post_library(status);

-- Composite index for scheduler queries (only approved/active posts)
CREATE INDEX IF NOT EXISTS idx_skool_post_library_schedulable
  ON skool_post_library(status, is_active)
  WHERE status IN ('approved', 'active') AND is_active = true;

-- Update existing posts to 'active' status (already approved legacy posts)
UPDATE skool_post_library SET status = 'active' WHERE status IS NULL;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================
-- Run these after migration to verify:
--
-- SELECT status, COUNT(*) FROM skool_post_library GROUP BY status;
-- Expected: All existing posts should be 'active'
--
-- SELECT source, COUNT(*) FROM skool_post_library GROUP BY source;
-- Expected: All existing posts should be 'manual'
