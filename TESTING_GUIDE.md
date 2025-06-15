# 🧪 AI Games Slack App - Testing Guide

## Quick Start Testing (15 minutes)

### Option 1: Full Integration Testing

1. **Set up Slack App** (5 min)
   - Go to https://api.slack.com/apps
   - Create new app "AI Games Test"
   - Enable Socket Mode
   - Install to your workspace

2. **Set up Supabase** (5 min)
   - Go to https://supabase.com
   - Create new project
   - Run migration files from `database/migrations/`

3. **Configure Environment** (3 min)
   ```bash
   cp .env.example .env
   # Edit .env with your keys
   npm install
   npm run dev
   ```

4. **Test Commands** (2 min)
   - `/submit` - Submit your first prompt
   - `/library` - Browse the prompt library
   - `/status` - Check your stats

### Option 2: Code Quality Testing (5 minutes)

```bash
# Test compilation
npm run build

# Test linting (if available)
npm run lint

# Test core logic
node test-script.js
```

## 🎯 Key Features to Test

### Core Gamification (Tasks 1-12) ✅
- [x] Submit prompts with `/submit`
- [x] Earn XP and track streaks
- [x] View leaderboards and analytics
- [x] Get personalized insights

### AI-Powered Features (Tasks 13-15) ✅  
- [x] Duplicate detection on submissions
- [x] Comment helpfulness analysis
- [x] Prompt clarity scoring with XP adjustments
- [x] Comprehensive status dashboard

### Prompt Library (Task 18) 🆕
- [x] Search prompts with `/library search`
- [x] Browse by category with `/library browse`
- [x] Favorite and collect prompts
- [x] Auto-promotion of quality content

## 📊 Current Status

**Completed**: 18/26 tasks (69%)

**Ready for testing**:
- User registration and XP system
- Submission and remix workflows  
- LLM-powered quality analysis
- Comprehensive analytics and insights
- Prompt library with search and collections
- Real-time leaderboards and streaks

**Still in development**:
- Badge system (Task 17)
- Digest generation (Tasks 19-20)
- Season management (Task 21)
- User onboarding (Task 22)

## 🔧 Troubleshooting

**Common issues**:
1. **TypeScript errors**: Run `npm run build` to check
2. **Missing environment variables**: Copy `.env.example` to `.env`
3. **Database connection**: Ensure Supabase migrations are run
4. **Slack permissions**: Check bot scopes and Socket Mode

**Database schema**:
- All tables are created via migrations
- Auto-promotion triggers are set up
- Sample collections are pre-populated

**LLM Features**:
- Works with Gemini, OpenAI, or Claude via LiteLLM
- Fallback scoring when LLM unavailable
- All analysis stored for admin review

## 🚀 Production Deployment

When ready for production:
1. Deploy to Cloud Run (Task 24)
2. Set up proper security (Task 23)  
3. Add comprehensive testing (Task 26)
4. Create admin documentation (Task 25)