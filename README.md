# AI Games Slack App

A gamified Slack application that encourages AI prompt sharing and collaboration through XP, streaks, and team competitions.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   - Copy `.env.example` to `.env`
   - Fill in your Slack App credentials and other required keys

3. **Build the application:**
   ```bash
   npm run build
   ```

4. **Run in development mode:**
   ```bash
   npm run dev
   ```

## Environment Variables

- `SLACK_BOT_TOKEN`: Your Slack bot token (xoxb-...)
- `SLACK_SIGNING_SECRET`: Your Slack signing secret
- `SLACK_APP_TOKEN`: Your Slack app token (xapp-...)
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `OPENAI_API_KEY`: Your OpenAI API key

## Features

- `/submit` command for sharing AI prompts
- Home tab for personal stats and team leaderboard
- XP and streak tracking
- Weekly challenges and digests

## Development

This project uses TypeScript and the Slack Bolt framework.