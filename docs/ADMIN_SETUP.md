# AI Games Slack App - Admin Setup Guide

This comprehensive guide will walk you through setting up and configuring the AI Games Slack App for your workspace.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Slack App Configuration](#slack-app-configuration)
3. [Database Setup](#database-setup)
4. [Environment Configuration](#environment-configuration)
5. [LLM Provider Setup](#llm-provider-setup)
6. [Deployment](#deployment)
7. [Initial Admin Configuration](#initial-admin-configuration)
8. [Verification and Testing](#verification-and-testing)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

Before starting, ensure you have:

- **Slack Workspace Admin Access**: You need admin permissions to create and configure Slack apps
- **Database**: Supabase account and project (or PostgreSQL database)
- **LLM Provider**: Anthropic Claude API key or OpenAI API key
- **Hosting Environment**: Server, VPS, or container platform for deployment
- **Domain** (optional): For webhook endpoints if using HTTP mode instead of Socket Mode

## Slack App Configuration

### 1. Create Slack App

1. Go to [Slack API Dashboard](https://api.slack.com/apps)
2. Click "Create New App" → "From an app manifest"
3. Select your workspace
4. Use this app manifest:

```yaml
display_information:
  name: AI Games
  description: Competitive AI prompt community with XP, streaks, and leaderboards
  background_color: "#4A154B"
features:
  bot_user:
    display_name: AI Games
    always_online: true
  home_tab:
    home_tab_enabled: true
    messages_tab_enabled: false
  slash_commands:
    - command: /submit
      description: Submit an AI prompt or workflow
      usage_hint: "[prompt text or attachment]"
      should_escape: false
    - command: /leaderboard
      description: View the current leaderboard
      usage_hint: "[global|season|monthly]"
      should_escape: false
    - command: /streak
      description: Check your current streak status
      should_escape: false
    - command: /status
      description: View your detailed stats and progress
      should_escape: false
    - command: /season
      description: Admin command for season management
      usage_hint: "[start|end|status|leaderboard|reset|create|update]"
      should_escape: false
    - command: /digest
      description: Admin command for digest management
      usage_hint: "[generate|send|schedule|analytics]"
      should_escape: false
    - command: /preferences
      description: Manage your notification preferences
      usage_hint: "[view|update]"
      should_escape: false
oauth_config:
  scopes:
    bot:
      - app_mentions:read
      - channels:history
      - channels:read
      - chat:write
      - chat:write.public
      - commands
      - files:read
      - groups:history
      - groups:read
      - im:history
      - im:read
      - im:write
      - mpim:history
      - mpim:read
      - mpim:write
      - reactions:read
      - reactions:write
      - team:read
      - users:read
      - users:write
      - users.profile:read
      - users.profile:write
settings:
  event_subscriptions:
    bot_events:
      - app_home_opened
      - app_mention
      - file_shared
      - message.channels
      - message.groups
      - message.im
      - message.mpim
      - reaction_added
      - reaction_removed
  interactivity:
    is_enabled: true
  org_deploy_enabled: false
  socket_mode_enabled: true
  token_rotation_enabled: false
```

### 2. Configure OAuth & Permissions

1. Navigate to "OAuth & Permissions"
2. Under "Scopes", verify all required bot token scopes are listed (they should auto-populate from the manifest)
3. Install the app to your workspace
4. Copy the "Bot User OAuth Token" - you'll need this for `SLACK_BOT_TOKEN`

### 3. Enable Socket Mode (Recommended)

1. Go to "Socket Mode" in the sidebar
2. Enable Socket Mode
3. Generate and copy the App-Level Token - you'll need this for `SLACK_APP_TOKEN`
4. Required scopes for App-Level Token: `connections:write`

### 4. Configure Event Subscriptions

If using HTTP mode instead of Socket Mode:

1. Go to "Event Subscriptions"
2. Enable Events
3. Set Request URL to: `https://your-domain.com/slack/events`
4. Subscribe to bot events listed in the manifest above

### 5. Set App Home

1. Go to "App Home"
2. Enable "Home Tab" 
3. Disable "Messages Tab" (not needed for this app)

## Database Setup

### Using Supabase (Recommended)

1. Create a Supabase account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Project Settings → API
4. Copy the Project URL and anon/service_role keys
5. Run the database schema setup:

```sql
-- Run this in the Supabase SQL Editor
-- Copy the contents from database/schema.sql
-- (The schema file should be created separately with all table definitions)
```

### Using PostgreSQL

1. Set up a PostgreSQL database
2. Create a database user with full permissions
3. Run the schema setup script
4. Ensure your database is accessible from your hosting environment

## Environment Configuration

Create a `.env` file in your project root with these required variables:

```bash
# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_APP_TOKEN=xapp-your-app-token-here  # Only needed for Socket Mode

# Database Configuration (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# LLM Provider (Choose one)
ANTHROPIC_API_KEY=your-claude-api-key-here
# OR
OPENAI_API_KEY=your-openai-api-key-here
LLM_PROVIDER=claude  # or 'openai'

# Application Configuration
NODE_ENV=production
PORT=3000
SCHEDULER_API_KEY=your-secure-random-key-for-cron-jobs

# Optional: Specific channel for digests
SLACK_DIGEST_CHANNEL=general

# Optional: Admin user Slack IDs (comma-separated)
ADMIN_SLACK_IDS=U01234567,U09876543

# Security
BCRYPT_ROUNDS=12
JWT_SECRET=your-jwt-secret-for-session-management
```

## LLM Provider Setup

### Option 1: Anthropic Claude (Recommended)

1. Sign up at [console.anthropic.com](https://console.anthropic.com)
2. Generate an API key
3. Set `ANTHROPIC_API_KEY` and `LLM_PROVIDER=claude`

### Option 2: OpenAI

1. Sign up at [platform.openai.com](https://platform.openai.com)
2. Generate an API key
3. Set `OPENAI_API_KEY` and `LLM_PROVIDER=openai`

## Deployment

### Option 1: Docker Deployment

1. Build the Docker image:
```bash
docker build -t ai-games-slack-app .
```

2. Run with environment variables:
```bash
docker run -d \
  --name ai-games-app \
  --env-file .env \
  -p 3000:3000 \
  ai-games-slack-app
```

### Option 2: Node.js Deployment

1. Install dependencies:
```bash
npm install
```

2. Build the application:
```bash
npm run build
```

3. Start the application:
```bash
npm start
```

## Initial Admin Configuration

### 1. Verify Installation

1. Invite the bot to your desired channels
2. Check that the bot appears online in your workspace
3. Test the `/status` command to verify basic functionality

### 2. Initialize Database Tables

The app will automatically create necessary database tables on first run. If you need to manually initialize:

```bash
curl -X POST http://localhost:3000/scheduler/initialize-digests \
  -H "Authorization: Bearer YOUR_SCHEDULER_API_KEY"
```

### 3. Set Up First Season

Use the `/season` command to create your first season:

```
/season create name:"Season 1" description:"Welcome to AI Games!" duration:90
```

### 4. Configure Weekly Challenges

Add challenges for the current week:

```
/season challenge add week:1 prompt:"Create an AI prompt that helps users write better emails" category:"productivity"
```

### 5. Set Up Digest Scheduling

The digest system initializes automatically, but you can verify:

```bash
curl -X GET http://localhost:3000/scheduler/digest-analytics \
  -H "Authorization: Bearer YOUR_SCHEDULER_API_KEY"
```

## Verification and Testing

### 1. Basic Functionality Tests

- [ ] `/submit` command works and accepts prompts
- [ ] `/leaderboard` displays properly
- [ ] `/streak` shows streak information
- [ ] `/status` displays user statistics
- [ ] App Home tab loads with user data

### 2. Admin Function Tests

- [ ] `/season` commands work for admins
- [ ] `/digest` commands generate content
- [ ] Scheduler endpoints respond correctly
- [ ] Database tables are populated

### 3. Integration Tests

- [ ] XP is awarded for submissions
- [ ] Streaks calculate correctly
- [ ] Badges are awarded appropriately
- [ ] Leaderboard updates in real-time
- [ ] Notifications work as expected

## Troubleshooting

### Common Issues

#### Bot Not Responding
- Verify Socket Mode is enabled and App-Level Token is correct
- Check that bot is invited to the channel
- Ensure `SLACK_BOT_TOKEN` is valid

#### Database Connection Errors
- Verify Supabase credentials are correct
- Check that database tables exist
- Ensure network connectivity to database

#### LLM API Errors
- Verify API key is valid and has credits
- Check rate limits haven't been exceeded
- Ensure correct provider is configured

#### Permission Errors
- Verify bot has necessary OAuth scopes
- Check that admin Slack IDs are configured correctly
- Ensure bot is in channels where commands are used

### Logs and Monitoring

Check application logs for detailed error information:

```bash
# Docker
docker logs ai-games-app

# Node.js
npm run logs
```

### Health Check

The app provides a health endpoint:

```bash
curl http://localhost:3000/health
```

## Security Considerations

1. **Environment Variables**: Never commit `.env` files to version control
2. **API Keys**: Rotate API keys regularly
3. **Database Access**: Use read-only credentials where possible
4. **Network Security**: Implement proper firewall rules
5. **Updates**: Keep dependencies updated for security patches

## Support

For additional support:

1. Check the [User Documentation](USER_GUIDE.md)
2. Review [Deployment Guide](DEPLOYMENT.md)
3. Check application logs for specific error messages
4. Verify all environment variables are correctly set

---

**Next Steps**: After completing this setup, proceed to the [User Guide](USER_GUIDE.md) to learn about day-to-day operations and user management.