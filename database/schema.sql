-- AI Games Slack App Database Schema
-- Run this in Supabase SQL Editor to create all required tables

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    slack_id VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    total_xp INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_submission_date DATE,
    streak_freeze_tokens INTEGER DEFAULT 0,
    badges JSONB DEFAULT '[]'::jsonb,
    notification_preferences JSONB DEFAULT '{
        "streak_reminders": true,
        "weekly_digest": true,
        "badge_notifications": true,
        "challenge_notifications": true
    }'::jsonb,
    onboarding_completed BOOLEAN DEFAULT false,
    onboarding_step INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seasons table
CREATE TABLE IF NOT EXISTS seasons (
    season_id SERIAL PRIMARY KEY,
    season_number INTEGER UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'ended')),
    xp_decay_rate DECIMAL(3,2) DEFAULT 0.95,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
    submission_id SERIAL PRIMARY KEY,
    author_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(200),
    prompt_text TEXT NOT NULL,
    submission_type VARCHAR(50) DEFAULT 'general',
    tags TEXT[],
    clarity_score DECIMAL(3,1),
    creativity_score DECIMAL(3,1),
    usefulness_score DECIMAL(3,1),
    overall_score DECIMAL(3,1),
    xp_awarded INTEGER DEFAULT 0,
    season_id INTEGER REFERENCES seasons(season_id),
    week_number INTEGER,
    is_challenge_response BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- XP Events table
CREATE TABLE IF NOT EXISTS xp_events (
    event_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    xp_value INTEGER NOT NULL,
    multiplier DECIMAL(3,2) DEFAULT 1.00,
    source_id INTEGER, -- submission_id or other source
    source_type VARCHAR(50), -- 'submission', 'streak', 'badge', etc.
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    comment_id SERIAL PRIMARY KEY,
    submission_id INTEGER REFERENCES submissions(submission_id) ON DELETE CASCADE,
    author_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_helpful BOOLEAN DEFAULT false,
    helpfulness_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Weekly Challenges table
CREATE TABLE IF NOT EXISTS weekly_challenges (
    challenge_id SERIAL PRIMARY KEY,
    season_id INTEGER REFERENCES seasons(season_id),
    week_number INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    prompt_text TEXT NOT NULL,
    category VARCHAR(100),
    difficulty_level VARCHAR(20) DEFAULT 'medium',
    bonus_xp INTEGER DEFAULT 25,
    is_active BOOLEAN DEFAULT false,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(season_id, week_number)
);

-- Digest Schedules table
CREATE TABLE IF NOT EXISTS digest_schedules (
    id VARCHAR(100) PRIMARY KEY,
    type VARCHAR(20) NOT NULL CHECK (type IN ('community', 'personal')),
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
    day_of_week INTEGER, -- 0 = Sunday, 1 = Monday, etc.
    time_of_day VARCHAR(5) NOT NULL, -- HH:MM format
    timezone VARCHAR(50) DEFAULT 'UTC',
    enabled BOOLEAN DEFAULT true,
    channel_id VARCHAR(50), -- For community digests
    last_run TIMESTAMP WITH TIME ZONE,
    next_run TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Digest Deliveries table
CREATE TABLE IF NOT EXISTS digest_deliveries (
    delivery_id SERIAL PRIMARY KEY,
    schedule_id VARCHAR(100) REFERENCES digest_schedules(id),
    digest_type VARCHAR(20) NOT NULL,
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('channel', 'user')),
    recipient_id VARCHAR(50) NOT NULL,
    user_id INTEGER REFERENCES users(user_id),
    digest_content TEXT NOT NULL,
    delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed')),
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    delivered_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security Events table
CREATE TABLE IF NOT EXISTS security_events (
    event_id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    user_id VARCHAR(50), -- Slack user ID
    ip_address INET,
    user_agent TEXT,
    description TEXT NOT NULL,
    risk_level VARCHAR(20) DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_slack_id ON users(slack_id);
CREATE INDEX IF NOT EXISTS idx_users_total_xp ON users(total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_author_created ON submissions(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_season ON submissions(season_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_events_user_created ON xp_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_submission ON comments(submission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_digest_schedules_next_run ON digest_schedules(next_run) WHERE enabled = true;

-- Create update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_seasons_updated_at BEFORE UPDATE ON seasons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_digest_schedules_updated_at BEFORE UPDATE ON digest_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial season
INSERT INTO seasons (season_number, name, description, start_date, status) 
VALUES (1, 'Season 1', 'Welcome to AI Games! The first competitive season for AI prompt creators.', NOW(), 'active')
ON CONFLICT (season_number) DO NOTHING;

-- Insert sample weekly challenge
INSERT INTO weekly_challenges (season_id, week_number, title, prompt_text, category, is_active, start_date) 
VALUES (
    1, 
    1, 
    'Email Enhancement Prompts', 
    'Create an AI prompt that helps users write better emails by analyzing tone, clarity, and persuasiveness. Your prompt should provide specific suggestions for improvement.',
    'productivity',
    true,
    NOW()
) ON CONFLICT (season_id, week_number) DO NOTHING;

-- Enable Row Level Security (RLS) for better security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access (your app will use service_role key)
CREATE POLICY "Allow service role full access" ON users FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON submissions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON xp_events FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON comments FOR ALL USING (auth.role() = 'service_role');

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Success message
SELECT 'AI Games database schema created successfully! 🎮' as status;