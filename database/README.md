# Database Setup

This directory contains the database schema and migration files for the AI Games Slack app.

## Structure

- `migrations/` - SQL migration files to be run in Supabase
- `001_initial_schema.sql` - Core tables and indexes
- `002_rls_policies.sql` - Row Level Security policies
- `003_seed_data.sql` - Initial seed data

## Setup Instructions

1. **Create a Supabase project** at https://supabase.com

2. **Run migrations in order**:
   - Copy and paste each SQL file content into the Supabase SQL Editor
   - Run them in numerical order (001, 002, 003)

3. **Configure environment variables**:
   ```bash
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

## Key Tables

- **users** - Slack user profiles with XP and streak data
- **submissions** - AI prompts and workflows submitted by users
- **xp_events** - Log of all XP-earning activities
- **seasons** - Time-based competition periods
- **reactions** - User reactions to submissions (helpful, creative, etc.)
- **comments** - Comments and feedback on submissions
- **seed_prompts** - Weekly challenge prompts
- **user_streaks** - Daily activity tracking for streak calculation

## Security

Row Level Security (RLS) is enabled on user-facing tables with policies that:
- Allow users to view all public content
- Restrict updates/deletes to content owners
- Protect user data privacy

## Testing

After setup, verify the schema by:
1. Inserting a test user
2. Creating a test submission
3. Checking that XP events are created properly
4. Verifying RLS policies work as expected