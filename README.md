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

## Development Progress

This project uses TypeScript and the Slack Bolt framework.

### Task List (5/26 Complete - 19%)

#### ✅ Completed Tasks
- **Task 1**: Project Setup and Initialization
- **Task 2**: Database Schema Implementation  
- **Task 3**: Implement `/submit` Slash Command and Modal
- **Task 4**: Basic XP Awarding for Submission
- **Task 6**: Setup Cloud Run for LLM Services

#### 🔄 In Progress Tasks
- **Task 5**: Implement Slack Home Tab - Personal View (Basic)
- **Task 7**: Implement LLM Clarity Scorer
- **Task 11**: Implement 'Remix this' Message Shortcut

#### 📋 Pending Tasks
- **Task 8**: Implement Weekly Prompt Challenge
- **Task 9**: Implement Streak Calculation & Daily Nudge DM
- **Task 10**: Implement `/status` Slash Command
- **Task 12**: Implement LLM Similarity/Remix Detector
- **Task 13**: Implement Full XP Event Logic
- **Task 14**: Implement LLM Helpful Comment Judge
- **Task 15**: Enhance Home Tab & /status with Full Data
- **Task 16**: Implement Team Leaderboard on Home Tab
- **Task 17**: Implement Badge System & Slack Profile Update
- **Task 18**: Implement Prompt Library MVP
- **Task 19**: Implement LLM Digest Writer
- **Task 20**: Implement Scheduled Digest Posts
- **Task 21**: Implement Season Management Logic
- **Task 22**: Implement User Onboarding and Notification Preferences
- **Task 23**: Finalize Security and Privacy Features
- **Task 24**: Containerize Application and Setup Deployment
- **Task 25**: Create Onboarding Documentation and Admin Config
- **Task 26**: Comprehensive Testing, Bug Fixing, and Optimization

### Project Structure

```
ai-games-slack-app/
├── src/                    # Main Slack app
│   ├── app.ts             # Bolt.js application entry point
│   ├── database/          # Supabase client and types
│   └── services/          # Business logic services
├── llm-services/          # LLM microservice for Cloud Run
│   ├── src/
│   │   ├── routes/        # API endpoints (clarity, similarity, digest)
│   │   └── middleware/    # Authentication middleware
│   └── Dockerfile         # Container configuration
├── database/              # Database schema and migrations
│   └── migrations/        # SQL migration files
└── README.md
```

### Getting Started

1. Set up Supabase project and run database migrations
2. Create Slack App and configure OAuth scopes
3. Deploy LLM services to Cloud Run
4. Configure environment variables
5. Run the main Slack app