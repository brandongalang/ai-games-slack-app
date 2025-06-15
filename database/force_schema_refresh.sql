-- Force complete schema refresh for Supabase

-- First, let's verify the column exists in the actual database
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'xp_events' AND column_name = 'submission_id';

-- Add the column again with IF NOT EXISTS (safe if it already exists)
ALTER TABLE xp_events 
ADD COLUMN IF NOT EXISTS submission_id INTEGER;

-- Make sure it has the foreign key constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'xp_events_submission_id_fkey'
    ) THEN
        ALTER TABLE xp_events 
        ADD CONSTRAINT xp_events_submission_id_fkey 
        FOREIGN KEY (submission_id) REFERENCES submissions(submission_id);
    END IF;
END $$;

-- Force PostgREST to reload its schema cache
-- This requires superuser privileges, but we can try
NOTIFY pgrst, 'reload schema';

-- Alternative: Update the table comment to force cache invalidation
COMMENT ON TABLE xp_events IS 'XP events table - updated ' || NOW();

-- Show all columns to verify
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'xp_events' 
ORDER BY ordinal_position;

-- Show table constraints
SELECT 
    constraint_name,
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'xp_events';