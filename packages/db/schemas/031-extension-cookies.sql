-- =============================================
-- EXTENSION COOKIES STORAGE
-- =============================================
-- Stores encrypted Skool cookies per staff member
-- Enables server-side API calls using staff credentials
-- Run in Supabase SQL Editor

-- =============================================
-- EXTENSION COOKIES TABLE
-- Stores encrypted cookies for each staff member
-- =============================================
CREATE TABLE IF NOT EXISTS extension_cookies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_skool_id TEXT NOT NULL,
  cookies_encrypted TEXT NOT NULL,        -- Encrypted cookie string (IV:encrypted format)
  auth_token_expires_at TIMESTAMPTZ,      -- JWT expiry from auth_token
  session_cookie_present BOOLEAN DEFAULT false,  -- Track if session cookie was captured
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_skool_id)
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_extension_cookies_staff ON extension_cookies(staff_skool_id);
CREATE INDEX IF NOT EXISTS idx_extension_cookies_expiry ON extension_cookies(auth_token_expires_at);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE extension_cookies ENABLE ROW LEVEL SECURITY;

-- Service role full access (auth handled via API key)
CREATE POLICY "Service role full access" ON extension_cookies FOR ALL USING (true);

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION update_extension_cookies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_extension_cookies_updated_at
  BEFORE UPDATE ON extension_cookies
  FOR EACH ROW
  EXECUTE FUNCTION update_extension_cookies_updated_at();

-- =============================================
-- HELPER FUNCTION: Get cookies expiring soon
-- Returns staff members whose cookies expire within N hours
-- =============================================
CREATE OR REPLACE FUNCTION get_expiring_cookies(hours_threshold INTEGER DEFAULT 24)
RETURNS TABLE (
  staff_skool_id TEXT,
  auth_token_expires_at TIMESTAMPTZ,
  hours_until_expiry NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ec.staff_skool_id,
    ec.auth_token_expires_at,
    EXTRACT(EPOCH FROM (ec.auth_token_expires_at - NOW())) / 3600 as hours_until_expiry
  FROM extension_cookies ec
  WHERE ec.auth_token_expires_at IS NOT NULL
    AND ec.auth_token_expires_at <= NOW() + (hours_threshold || ' hours')::INTERVAL
    AND ec.auth_token_expires_at > NOW()
  ORDER BY ec.auth_token_expires_at ASC;
END;
$$ LANGUAGE plpgsql;
