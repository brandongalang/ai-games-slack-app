-- Seed Data
-- Initial data for testing and bootstrapping the application

-- Insert initial season
INSERT INTO seasons (season_number, start_date, end_date, status) 
VALUES (1, NOW(), NOW() + INTERVAL '3 months', 'active')
ON CONFLICT (season_number) DO NOTHING;

-- Insert sample seed prompts for the first few weeks
INSERT INTO seed_prompts (season_id, week_number, prompt_text, instructions, is_active) VALUES
(1, 1, 'Create a prompt that helps brainstorm creative solutions to everyday problems.', 'Focus on prompts that encourage out-of-the-box thinking and practical application.', true),
(1, 2, 'Design a workflow for analyzing and summarizing complex documents.', 'Think about multi-step processes that break down large texts into digestible insights.', false),
(1, 3, 'Build a prompt that generates engaging social media content.', 'Consider different platforms and audiences in your approach.', false),
(1, 4, 'Create a research assistant prompt for fact-checking and source verification.', 'Focus on accuracy, credibility assessment, and source citation.', false)
ON CONFLICT (season_id, week_number) DO NOTHING;

-- Insert XP event types reference (for documentation)
-- These are the standard XP values used throughout the application
INSERT INTO xp_events (user_id, event_type, xp_value, metadata) VALUES
(NULL, 'REFERENCE_VALUES', 0, '{
  "submission_base": 10,
  "clarity_bonus": 5,
  "first_submission_bonus": 5,
  "weekly_challenge_bonus": 10,
  "helpful_comment": 3,
  "receiving_helpful_reaction": 2,
  "giving_helpful_reaction": 1,
  "streak_milestone_3": 5,
  "streak_milestone_7": 10,
  "streak_milestone_30": 25,
  "remix_original": 8,
  "remix_improved": 12
}'::jsonb)
ON CONFLICT DO NOTHING;