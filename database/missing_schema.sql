-- Additional Schema Fixes for AI Games Slack App

-- Fix 1: Add slack_user_id column to users table (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'slack_user_id') THEN
        ALTER TABLE users ADD COLUMN slack_user_id VARCHAR(50) UNIQUE;
        -- Copy slack_id to slack_user_id for existing records
        UPDATE users SET slack_user_id = slack_id WHERE slack_user_id IS NULL;
        -- Make it NOT NULL after copying
        ALTER TABLE users ALTER COLUMN slack_user_id SET NOT NULL;
    END IF;
END $$;

-- Fix 2: Create badges table
CREATE TABLE IF NOT EXISTS badges (
    badge_id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    xp_requirement INTEGER DEFAULT 0,
    icon VARCHAR(50),
    category VARCHAR(50) DEFAULT 'general',
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fix 3: Create get_leaderboard function
CREATE OR REPLACE FUNCTION get_leaderboard(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    user_id INTEGER,
    slack_user_id VARCHAR(50),
    username VARCHAR(100),
    total_xp INTEGER,
    current_streak INTEGER,
    rank BIGINT,
    badges JSONB
) 
LANGUAGE sql
AS $$
    SELECT 
        u.user_id,
        u.slack_user_id,
        u.display_name as username,
        u.total_xp,
        u.current_streak,
        ROW_NUMBER() OVER (ORDER BY u.total_xp DESC, u.user_id ASC) as rank,
        u.badges
    FROM users u 
    ORDER BY u.total_xp DESC, u.user_id ASC
    LIMIT limit_count;
$$;

-- Fix 4: Insert default badges
INSERT INTO badges (name, description, xp_requirement, icon, category) VALUES
('First Steps', 'Submit your first prompt', 10, '👶', 'milestone'),
('Rising Star', 'Earn 100 XP', 100, '⭐', 'xp'),
('XP Warrior', 'Earn 500 XP', 500, '⚔️', 'xp'),
('XP Legend', 'Earn 2000 XP', 2000, '👑', 'xp'),
('XP Master', 'Earn 5000 XP', 5000, '💎', 'xp'),
('Streak Starter', 'Maintain a 3-day streak', 0, '🔥', 'streak'),
('Streak Master', 'Maintain a 7-day streak', 0, '🚀', 'streak'),
('Social Butterfly', 'Comment on 10 submissions', 0, '🦋', 'social'),
('Helpful Hand', 'Receive 10 helpful votes', 0, '🤝', 'social'),
('Challenge Champion', 'Complete 5 weekly challenges', 0, '🏆', 'challenge')
ON CONFLICT (name) DO NOTHING;

-- Fix 5: Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_users_slack_user_id ON users(slack_user_id);
CREATE INDEX IF NOT EXISTS idx_badges_name ON badges(name);

-- Success message
SELECT 'Missing schema components added successfully! 🎯' as status;