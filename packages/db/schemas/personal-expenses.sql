-- Personal Expenses tracking tables
-- Phase 1: Foundation schema for personal expense management

-- Main expenses table
CREATE TABLE IF NOT EXISTS personal_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  amount DECIMAL(10,2) NOT NULL,
  frequency TEXT DEFAULT 'one_time',  -- 'one_time', 'monthly', 'annual'
  expense_date DATE,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_personal_expenses_category ON personal_expenses(category);
CREATE INDEX idx_personal_expenses_date ON personal_expenses(expense_date);
CREATE INDEX idx_personal_expenses_active ON personal_expenses(is_active);

-- Categories lookup table
CREATE TABLE IF NOT EXISTS personal_expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  color TEXT,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default categories (minimal set)
INSERT INTO personal_expense_categories (name, slug, color, display_order) VALUES
  ('Housing', 'housing', '#3b82f6', 1),
  ('Food', 'food', '#22c55e', 2),
  ('Transportation', 'transportation', '#f59e0b', 3),
  ('Subscriptions', 'subscriptions', '#8b5cf6', 4)
ON CONFLICT (name) DO NOTHING;

-- RLS policies (same pattern as existing tables)
ALTER TABLE personal_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON personal_expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON personal_expense_categories FOR ALL USING (true) WITH CHECK (true);
