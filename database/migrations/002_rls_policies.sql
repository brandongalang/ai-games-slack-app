-- Row Level Security (RLS) Policies
-- Enable RLS on tables and create basic security policies

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

-- Note: seasons and seed_prompts are admin-managed, so no RLS needed initially

-- Users policies
CREATE POLICY "Users can view all profiles" ON users
    FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid()::text = slack_id);

-- Submissions policies
CREATE POLICY "Anyone can view submissions" ON submissions
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own submissions" ON submissions
    FOR INSERT WITH CHECK (auth.uid()::text = (SELECT slack_id FROM users WHERE user_id = author_id));

CREATE POLICY "Users can update their own submissions" ON submissions
    FOR UPDATE USING (auth.uid()::text = (SELECT slack_id FROM users WHERE user_id = author_id));

-- XP Events policies (read-only for users, admin writes)
CREATE POLICY "Users can view their own XP events" ON xp_events
    FOR SELECT USING (auth.uid()::text = (SELECT slack_id FROM users WHERE user_id = xp_events.user_id));

-- Reactions policies
CREATE POLICY "Anyone can view reactions" ON reactions
    FOR SELECT USING (true);

CREATE POLICY "Users can add reactions" ON reactions
    FOR INSERT WITH CHECK (auth.uid()::text = (SELECT slack_id FROM users WHERE user_id = reactor_id));

CREATE POLICY "Users can update their own reactions" ON reactions
    FOR UPDATE USING (auth.uid()::text = (SELECT slack_id FROM users WHERE user_id = reactor_id));

CREATE POLICY "Users can delete their own reactions" ON reactions
    FOR DELETE USING (auth.uid()::text = (SELECT slack_id FROM users WHERE user_id = reactor_id));

-- Comments policies
CREATE POLICY "Anyone can view comments" ON comments
    FOR SELECT USING (true);

CREATE POLICY "Users can add comments" ON comments
    FOR INSERT WITH CHECK (auth.uid()::text = (SELECT slack_id FROM users WHERE user_id = author_id));

CREATE POLICY "Users can update their own comments" ON comments
    FOR UPDATE USING (auth.uid()::text = (SELECT slack_id FROM users WHERE user_id = author_id));

CREATE POLICY "Users can delete their own comments" ON comments
    FOR DELETE USING (auth.uid()::text = (SELECT slack_id FROM users WHERE user_id = author_id));

-- User Streaks policies
CREATE POLICY "Users can view their own streaks" ON user_streaks
    FOR SELECT USING (auth.uid()::text = (SELECT slack_id FROM users WHERE user_id = user_streaks.user_id));