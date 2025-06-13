-- AI Games Database Schema
-- Initial migration for core tables

-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    slack_id TEXT UNIQUE NOT NULL,
    display_name TEXT,
    total_xp INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    badges JSONB DEFAULT '[]'::jsonb,
    season_rank INTEGER,
    notification_preferences JSONB DEFAULT '{"streak_dms": true, "weekly_digest": true}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seasons table
CREATE TABLE IF NOT EXISTS seasons (
    season_id SERIAL PRIMARY KEY,
    season_number INTEGER NOT NULL UNIQUE,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    status TEXT CHECK (status IN ('active', 'paused', 'ended')) DEFAULT 'active',
    decay_factor REAL DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
    submission_id SERIAL PRIMARY KEY,
    author_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    title TEXT,
    prompt_text TEXT NOT NULL,
    description TEXT,
    output_sample TEXT,
    output_url TEXT,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    submission_type TEXT CHECK (submission_type IN ('workflow', 'challenge_response', 'remix')) DEFAULT 'workflow',
    parent_submission_id INTEGER REFERENCES submissions(submission_id) ON DELETE SET NULL,
    llm_clarity_score REAL,
    llm_similarity_score REAL,
    is_promoted_to_library BOOLEAN DEFAULT FALSE,
    season_id INTEGER REFERENCES seasons(season_id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- XP Events table
CREATE TABLE IF NOT EXISTS xp_events (
    event_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    submission_id INTEGER REFERENCES submissions(submission_id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    xp_value INTEGER NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    season_id INTEGER REFERENCES seasons(season_id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reactions table
CREATE TABLE IF NOT EXISTS reactions (
    reaction_id SERIAL PRIMARY KEY,
    submission_id INTEGER REFERENCES submissions(submission_id) ON DELETE CASCADE,
    reactor_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL, -- 'helpful', 'creative', 'clear', etc.
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(submission_id, reactor_id, reaction_type)
);

-- Seed Prompts table (for weekly challenges)
CREATE TABLE IF NOT EXISTS seed_prompts (
    seed_prompt_id SERIAL PRIMARY KEY,
    season_id INTEGER REFERENCES seasons(season_id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    prompt_text TEXT NOT NULL,
    instructions TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(season_id, week_number)
);

-- Comments table (for submission comments/feedback)
CREATE TABLE IF NOT EXISTS comments (
    comment_id SERIAL PRIMARY KEY,
    submission_id INTEGER REFERENCES submissions(submission_id) ON DELETE CASCADE,
    author_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    is_helpful BOOLEAN, -- LLM-determined helpfulness
    parent_comment_id INTEGER REFERENCES comments(comment_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Streaks table (to track daily activity)
CREATE TABLE IF NOT EXISTS user_streaks (
    streak_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    streak_date DATE NOT NULL,
    activity_type TEXT NOT NULL, -- 'submission', 'comment', 'reaction'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, streak_date, activity_type)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_submissions_author_id ON submissions(author_id);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_season_id ON submissions(season_id);
CREATE INDEX IF NOT EXISTS idx_xp_events_user_id ON xp_events(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_events_created_at ON xp_events(created_at);
CREATE INDEX IF NOT EXISTS idx_reactions_submission_id ON reactions(submission_id);
CREATE INDEX IF NOT EXISTS idx_comments_submission_id ON comments(submission_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_user_date ON user_streaks(user_id, streak_date);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();