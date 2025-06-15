-- Fix submissions table to match what the code expects

-- Add missing columns to submissions table
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS output_sample TEXT,
ADD COLUMN IF NOT EXISTS output_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS parent_submission_id INTEGER REFERENCES submissions(submission_id);

-- Fix badges table to have user_id column
ALTER TABLE badges 
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(user_id);

-- Create user_badges junction table (better approach)
CREATE TABLE IF NOT EXISTS user_badges (
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    badge_id INTEGER REFERENCES badges(badge_id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, badge_id)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_parent ON submissions(parent_submission_id);

-- Success message
SELECT 'Submissions schema fixed successfully! 🔧' as status;