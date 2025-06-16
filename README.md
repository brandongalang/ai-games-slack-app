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
- `USE_LOCAL_DB`: Set to `true` to use the local SQLAlchemy database
- `LOCAL_DB_URL`: URL of the local database server (default: http://localhost:8000)
- `LLM_MODEL`: LLM model to use (default: gemini/gemini-1.5-flash)
- `GEMINI_API_KEY`: Your Google Gemini API key for LLM services
- `OPENAI_API_KEY`: Optional OpenAI API key (if using OpenAI models)

## Features

- `/submit` command for sharing AI prompts
- Home tab for personal stats and team leaderboard
- XP and streak tracking
- Weekly challenges and digests
- `/leaderboard` command for viewing top players
- `/status` command for detailed user stats with analytics
- `/analytics` command for advanced user insights
- `/community` command for community-wide statistics
- `/streak` command for detailed streak tracking and leaderboard
- `/xp` command for comprehensive XP breakdown and quality insights
- Real-time leaderboard with live updates
- Advanced analytics tracking (submission frequency, activity trends, preferred categories)
- User insights and personalized recommendations
- Comprehensive streak calculation with bonus XP rewards
- Daily nudge DM system for users at risk of losing streaks
- Automated daily streak processing and maintenance
- Full XP event logic with quality-based bonuses and penalties
- Engagement multipliers and community contribution rewards
- Seasonal XP decay system for competitive balance
- Advanced XP breakdown with quality scoring and daily trends
- `/similarity` admin command for content analysis and management
- `/comments` admin command for comment analysis and management
- LLM-powered duplicate detection and prevention system
- Intelligent remix quality scoring and improvement analysis
- Similarity-based XP bonuses and penalties for content quality
- Automated comment helpfulness detection with LLM analysis
- Quality-based XP rewards for helpful comments and feedback
- LLM-powered prompt clarity scoring with automatic XP adjustments
- `/clarity` admin command for prompt analysis and quality management
- Comprehensive clarity statistics and improvement suggestions
- `/library` command for browsing and searching the curated prompt library
- Smart prompt categorization and tagging system with difficulty levels
- User favorites and collection system for organizing prompts
- Automated promotion of high-quality submissions to library
- Usage analytics and quality scoring for library optimization

## Development Progress

This project uses TypeScript and the Slack Bolt framework.

### Task List (18/26 Complete - 69%)

#### ✅ Completed Tasks
- **Task 1**: Project Setup and Initialization
- **Task 2**: Database Schema Implementation  
- **Task 3**: Implement `/submit` Slash Command and Modal
- **Task 4**: Basic XP Awarding for Submission
- **Task 5**: Implement Slack Home Tab - Personal View (Basic)
- **Task 6**: Setup Cloud Run for LLM Services
- **Task 7**: Implement LLM Clarity Scorer
- **Task 8**: Implement Weekly Prompt Challenge System
- **Task 9**: Implement Real-time Leaderboard System  
- **Task 10**: Implement Advanced User Analytics and Statistics Tracking
- **Task 11**: Implement Comprehensive Streak Calculation and Daily Engagement System
- **Task 12**: Implement Full XP Event Logic with Comprehensive Scoring System
- **Task 13**: Implement LLM Similarity/Remix Detector with intelligent content analysis
- **Task 14**: Implement LLM Helpful Comment Judge
- **Task 15**: Enhance Home Tab & /status with Full Data
- **Task 16**: Implement Team Leaderboard on Home Tab
- **Task 18**: Implement Prompt Library MVP

#### 🔄 In Progress Tasks
- (None currently)

#### 📋 Pending Tasks
- **Task 17**: Implement Badge System & Slack Profile Update
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
5. (Optional) Start the local SQLAlchemy server:
   ```bash
   pip install -r database/requirements.txt
   uvicorn database.local_db:app --reload
   ```
6. Run the main Slack app
