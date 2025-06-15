-- Fix XP events table missing columns

-- Add missing season_id column to xp_events table
ALTER TABLE xp_events 
ADD COLUMN IF NOT EXISTS season_id INTEGER REFERENCES seasons(season_id);

-- Create onboarding_progress table if it doesn't exist
CREATE TABLE IF NOT EXISTS onboarding_progress (
    progress_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    step_name VARCHAR(100) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(user_id, step_name)
);

-- Check if your user exists and create if not
INSERT INTO users (
    slack_id, 
    slack_user_id, 
    display_name, 
    total_xp, 
    current_streak, 
    onboarding_completed
) VALUES (
    'U08PV86BTFH',
    'U08PV86BTFH',
    'Admin User',
    100,
    1,
    true
) ON CONFLICT (slack_id) DO UPDATE SET
    slack_user_id = 'U08PV86BTFH',
    display_name = 'Admin User',
    onboarding_completed = true;

-- Refresh the schema cache by touching the table
COMMENT ON TABLE xp_events IS 'Stores XP events for users';

-- Show the xp_events table structure to verify
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'xp_events' 
ORDER BY ordinal_position;