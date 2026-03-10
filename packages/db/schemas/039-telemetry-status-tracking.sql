-- 039: Telemetry status tracking + failure patterns
-- Adds status lifecycle to telemetry_events and pattern detection tables

-- Status tracking columns on telemetry_events
ALTER TABLE telemetry_events
  ADD COLUMN status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'triaged', 'fixed', 'deployed')),
  ADD COLUMN fix_notes TEXT,
  ADD COLUMN fix_commit TEXT,
  ADD COLUMN triaged_at TIMESTAMPTZ,
  ADD COLUMN fixed_at TIMESTAMPTZ,
  ADD COLUMN deployed_at TIMESTAMPTZ;

-- Status change history
CREATE TABLE telemetry_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES telemetry_events(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_telemetry_status_history_event ON telemetry_status_history(event_id);

-- Common failure patterns
CREATE TABLE telemetry_failure_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_key TEXT NOT NULL UNIQUE,
  failure_name TEXT NOT NULL,
  category TEXT,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  known_fix TEXT,
  auto_fixable BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_telemetry_failure_patterns_count ON telemetry_failure_patterns(occurrence_count DESC);
