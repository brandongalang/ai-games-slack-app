-- Add submission_id column to xp_events table
ALTER TABLE xp_events 
ADD COLUMN submission_id INTEGER;

-- Add foreign key constraint
ALTER TABLE xp_events 
ADD CONSTRAINT fk_xp_events_submission_id 
FOREIGN KEY (submission_id) REFERENCES submissions(submission_id);

-- Add index for performance
CREATE INDEX idx_xp_events_submission_id ON xp_events(submission_id);

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'xp_events' 
ORDER BY ordinal_position;