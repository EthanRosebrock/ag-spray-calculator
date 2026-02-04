-- Products
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'liquid',
  unit TEXT NOT NULL,
  default_rate NUMERIC NOT NULL,
  mixing_order INTEGER NOT NULL DEFAULT 1,
  ph_sensitive BOOLEAN DEFAULT FALSE,
  is_custom BOOLEAN DEFAULT FALSE,
  measurement_unit TEXT,
  rate_basis TEXT,
  package_size NUMERIC,
  preferred_containers JSONB DEFAULT '[]'
);

-- Fields
CREATE TABLE IF NOT EXISTS fields (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  field_number TEXT,
  acres NUMERIC NOT NULL,
  carrier_rate NUMERIC NOT NULL DEFAULT 20,
  notes TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  elevation NUMERIC,
  microclimate TEXT,
  boundary JSONB,
  crop TEXT,
  soil_type TEXT,
  legal_description TEXT,
  farm_name TEXT
);

-- Spray records
CREATE TABLE IF NOT EXISTS spray_records (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  field_id TEXT,
  field_name TEXT NOT NULL DEFAULT '',
  field_ids JSONB DEFAULT '[]',
  field_names JSONB DEFAULT '[]',
  operator TEXT NOT NULL DEFAULT '',
  tank_size NUMERIC NOT NULL,
  carrier_rate NUMERIC NOT NULL,
  acres NUMERIC NOT NULL,
  products JSONB NOT NULL DEFAULT '[]',
  total_volume NUMERIC NOT NULL,
  weather JSONB,
  notes TEXT,
  created_at TEXT NOT NULL
);

-- Tender routes
CREATE TABLE IF NOT EXISTS tender_routes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  waypoints JSONB NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

-- Saved pins
CREATE TABLE IF NOT EXISTS saved_pins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  color TEXT NOT NULL DEFAULT '#dc2626',
  notes TEXT,
  is_home BOOLEAN DEFAULT FALSE
);

-- Settings (single-row key-value store)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- Seed default settings (skip if already exist)
INSERT INTO settings (key, value) VALUES
  ('calculator_defaults', '{"tankSize": 300, "carrierRate": 20, "acres": 160}'),
  ('tank_presets', '[200, 300, 500, 750, 1000]'),
  ('carrier_presets', '[10, 15, 20, 25]'),
  ('farm_location', '{"latitude": 41.4389, "longitude": -84.3558, "city": "Defiance", "state": "Ohio", "county": "Defiance County", "timezone": "America/New_York"}')
ON CONFLICT (key) DO NOTHING;

-- Seed default products (IDs match DEFAULT_PRODUCTS in storageService.ts)
INSERT INTO products (id, name, type, unit, default_rate, mixing_order, measurement_unit, rate_basis, ph_sensitive, is_custom) VALUES
  ('default-roundup', 'Roundup PowerMAX', 'liquid', 'fl oz / acre', 32, 2, 'fl_oz', 'per_acre', FALSE, FALSE),
  ('default-atrazine', 'Atrazine 4L', 'liquid', 'qt / acre', 1.5, 3, 'qt', 'per_acre', FALSE, FALSE),
  ('default-ams', 'AMS', 'dry', 'lbs / 100 gal water', 17, 1, 'lbs', 'per_100_gal', FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS with open policies (single user, no auth)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE spray_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tender_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'Allow all') THEN
    EXECUTE 'CREATE POLICY "Allow all" ON products FOR ALL USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fields' AND policyname = 'Allow all') THEN
    EXECUTE 'CREATE POLICY "Allow all" ON fields FOR ALL USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'spray_records' AND policyname = 'Allow all') THEN
    EXECUTE 'CREATE POLICY "Allow all" ON spray_records FOR ALL USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tender_routes' AND policyname = 'Allow all') THEN
    EXECUTE 'CREATE POLICY "Allow all" ON tender_routes FOR ALL USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_pins' AND policyname = 'Allow all') THEN
    EXECUTE 'CREATE POLICY "Allow all" ON saved_pins FOR ALL USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'settings' AND policyname = 'Allow all') THEN
    EXECUTE 'CREATE POLICY "Allow all" ON settings FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;
