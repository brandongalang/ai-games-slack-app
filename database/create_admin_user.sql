-- Create admin user in the database

INSERT INTO users (
    slack_id, 
    slack_user_id, 
    display_name, 
    total_xp, 
    current_streak, 
    onboarding_completed
) VALUES (
    'U08PV86BTFH',  -- Your Slack user ID
    'U08PV86BTFH',  -- Same as slack_id for compatibility
    'Admin User',   -- You can change this to your real name
    100,            -- Starting XP
    1,              -- Starting streak
    true            -- Skip onboarding
) ON CONFLICT (slack_id) DO UPDATE SET
    slack_user_id = EXCLUDED.slack_user_id,
    display_name = EXCLUDED.display_name,
    onboarding_completed = true;

-- Success message
SELECT 'Admin user created successfully! 👨‍💼' as status;