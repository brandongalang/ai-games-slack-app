-- Helper Functions for the AI Games app

-- Function to increment user XP
CREATE OR REPLACE FUNCTION increment_user_xp(user_id INTEGER, xp_amount INTEGER)
RETURNS INTEGER AS $$
DECLARE
    new_total INTEGER;
BEGIN
    UPDATE users 
    SET total_xp = total_xp + xp_amount,
        updated_at = NOW()
    WHERE users.user_id = increment_user_xp.user_id
    RETURNING total_xp INTO new_total;
    
    RETURN new_total;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate current streak for a user
CREATE OR REPLACE FUNCTION calculate_user_streak(user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    current_streak INTEGER := 0;
    check_date DATE := CURRENT_DATE;
    has_activity BOOLEAN;
BEGIN
    LOOP
        -- Check if user had activity on this date
        SELECT EXISTS(
            SELECT 1 FROM user_streaks 
            WHERE user_streaks.user_id = calculate_user_streak.user_id 
            AND streak_date = check_date
        ) INTO has_activity;
        
        -- If no activity, break the streak
        IF NOT has_activity THEN
            EXIT;
        END IF;
        
        -- Increment streak and check previous day
        current_streak := current_streak + 1;
        check_date := check_date - INTERVAL '1 day';
        
        -- Safety check to prevent infinite loops
        IF current_streak > 365 THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN current_streak;
END;
$$ LANGUAGE plpgsql;

-- Function to get top users by XP for leaderboard
CREATE OR REPLACE FUNCTION get_leaderboard(limit_count INTEGER DEFAULT 10)
RETURNS TABLE(
    user_id INTEGER,
    slack_id TEXT,
    display_name TEXT,
    total_xp INTEGER,
    current_streak INTEGER,
    rank INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.user_id,
        u.slack_id,
        u.display_name,
        u.total_xp,
        u.current_streak,
        ROW_NUMBER() OVER (ORDER BY u.total_xp DESC)::INTEGER as rank
    FROM users u
    WHERE u.total_xp > 0
    ORDER BY u.total_xp DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get weekly submission stats
CREATE OR REPLACE FUNCTION get_weekly_stats()
RETURNS TABLE(
    total_submissions INTEGER,
    unique_contributors INTEGER,
    avg_clarity_score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_submissions,
        COUNT(DISTINCT author_id)::INTEGER as unique_contributors,
        AVG(llm_clarity_score) as avg_clarity_score
    FROM submissions 
    WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;