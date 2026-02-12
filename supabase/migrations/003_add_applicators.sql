-- Add applicators table for managing spray operators
CREATE TABLE IF NOT EXISTS applicators (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE
);

-- Enable RLS (same pattern as other tables)
ALTER TABLE applicators ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access (same as other tables in this app)
CREATE POLICY "Allow anonymous select" ON applicators FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert" ON applicators FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update" ON applicators FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous delete" ON applicators FOR DELETE USING (true);
