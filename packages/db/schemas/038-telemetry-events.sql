-- 038: Telemetry events from 0ne Doctor and Install Wizard
-- Captures structured results from every doctor run and install across deployments.

CREATE TABLE IF NOT EXISTS telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('doctor', 'install')),
  platform TEXT,           -- darwin, win32, linux
  arch TEXT,               -- arm64, x64
  os_version TEXT,
  bun_version TEXT,
  one_version TEXT,
  principal_name TEXT,
  results JSONB NOT NULL,  -- full CheckResult[] or LogEntry[]
  summary JSONB,           -- pass/fail/warn/skip counts
  system_info JSONB,       -- ONE_DIR, PROJECT_ROOT, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying by event type and time
CREATE INDEX IF NOT EXISTS idx_telemetry_events_type_created
  ON telemetry_events (event_type, created_at DESC);

-- Index for filtering by principal (multi-user installs)
CREATE INDEX IF NOT EXISTS idx_telemetry_events_principal
  ON telemetry_events (principal_name)
  WHERE principal_name IS NOT NULL;
