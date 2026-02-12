-- Add sub_fields column to fields table for multi-device sync
-- sub_fields stores an array of SubField objects as JSONB:
-- [{ id, name, acres, crop, cropYear }, ...]

ALTER TABLE fields ADD COLUMN IF NOT EXISTS sub_fields JSONB DEFAULT '[]';

-- Backfill comment: After running this migration, existing fields will have
-- sub_fields = [] (empty array). Users will need to re-save fields from the
-- device that has sub-fields in localStorage to sync them to Supabase.
