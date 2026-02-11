-- =============================================================================
-- SKOOL POST STATUS - FUNCTION UPDATES
-- Update helper functions to filter out drafts
-- Run: psql "$DATABASE_URL" -f packages/db/schemas/skool-post-status-functions.sql
-- =============================================================================

-- Update get_next_post_for_variation_group to filter by status
-- Only returns approved or active posts (never drafts)
CREATE OR REPLACE FUNCTION get_next_post_for_variation_group(
  p_variation_group_id UUID
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  body TEXT,
  image_url TEXT,
  video_url TEXT,
  use_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pl.id,
    pl.title,
    pl.body,
    pl.image_url,
    pl.video_url,
    pl.use_count
  FROM skool_post_library pl
  WHERE pl.variation_group_id = p_variation_group_id
    AND pl.is_active = true
    AND pl.status IN ('approved', 'active')  -- Filter out drafts
  ORDER BY pl.last_used_at NULLS FIRST, pl.use_count ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Update get_variation_group_post_count to have an optional status filter
-- By default, only counts approved/active posts
CREATE OR REPLACE FUNCTION get_variation_group_post_count(
  p_variation_group_id UUID,
  p_include_drafts BOOLEAN DEFAULT false
)
RETURNS INTEGER AS $$
DECLARE
  post_count INTEGER;
BEGIN
  IF p_include_drafts THEN
    SELECT COUNT(*)::INTEGER INTO post_count
    FROM skool_post_library
    WHERE variation_group_id = p_variation_group_id
      AND is_active = true;
  ELSE
    SELECT COUNT(*)::INTEGER INTO post_count
    FROM skool_post_library
    WHERE variation_group_id = p_variation_group_id
      AND is_active = true
      AND status IN ('approved', 'active');
  END IF;
  RETURN post_count;
END;
$$ LANGUAGE plpgsql;
