-- Fix final XP events table missing columns

-- Add missing submission_id column to xp_events table
ALTER TABLE xp_events 
ADD COLUMN IF NOT EXISTS submission_id INTEGER REFERENCES submissions(submission_id);

-- Update the existing source_id column to be submission_id for existing records
UPDATE xp_events 
SET submission_id = source_id 
WHERE source_type = 'submission' AND submission_id IS NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_xp_events_submission_id ON xp_events(submission_id);

-- Force refresh the schema cache
NOTIFY pgrst, 'reload schema';

-- Show the complete xp_events table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'xp_events' 
ORDER BY ordinal_position;