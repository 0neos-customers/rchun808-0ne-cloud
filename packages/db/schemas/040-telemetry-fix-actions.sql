-- 040: Fix action capture for telemetry events
-- Stores the resolution journey (before -> action -> after) for every auto-fix

ALTER TABLE telemetry_events
  ADD COLUMN fix_actions JSONB,
  ADD COLUMN fix_summary JSONB;

-- Index for querying events that have fixes
CREATE INDEX idx_telemetry_events_has_fixes ON telemetry_events ((fix_summary IS NOT NULL));
