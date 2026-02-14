-- Skool Analytics Table
-- Stores analytics data captured from Skool admin dashboard via Chrome extension
-- Phase 9: Analytics Sync via Extension

CREATE TABLE IF NOT EXISTS skool_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,           -- Staff Skool user ID
  group_id TEXT NOT NULL,          -- Skool group ID
  post_id TEXT,                    -- NULL for group-level metrics, set for post-level
  metric_type TEXT NOT NULL,       -- 'views', 'engagement', 'comments', 'likes', 'shares', etc.
  metric_value NUMERIC,            -- The numeric value of the metric
  metric_date DATE,                -- The date this metric is for
  recorded_at TIMESTAMPTZ DEFAULT NOW(),  -- When we captured this data
  raw_data JSONB                   -- Store full API response for debugging/future use
);

-- Index for querying group metrics by date range
CREATE INDEX IF NOT EXISTS idx_skool_analytics_group_date
  ON skool_analytics(group_id, metric_date);

-- Index for querying post-level metrics
CREATE INDEX IF NOT EXISTS idx_skool_analytics_post
  ON skool_analytics(post_id) WHERE post_id IS NOT NULL;

-- Index for querying by user
CREATE INDEX IF NOT EXISTS idx_skool_analytics_user
  ON skool_analytics(user_id);

-- Index for querying by metric type
CREATE INDEX IF NOT EXISTS idx_skool_analytics_type
  ON skool_analytics(metric_type, metric_date);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_skool_analytics_group_type_date
  ON skool_analytics(group_id, metric_type, metric_date DESC);

-- Prevent duplicate metrics for the same group/post/type/date combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_skool_analytics_unique
  ON skool_analytics(user_id, group_id, COALESCE(post_id, ''), metric_type, metric_date);
