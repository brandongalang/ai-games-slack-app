# AI Games Slack App Documentation

Complete documentation for the AI Games Slack App - a competitive AI prompt community platform.

## Quick Links

### 📚 Documentation Index
- **[Admin Setup Guide](ADMIN_SETUP.md)** - Complete setup and configuration
- **[User Guide](USER_GUIDE.md)** - End-user documentation and features
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment and maintenance
- **[Slack Configuration](SLACK_CONFIG.md)** - Detailed Slack app setup
- **[Environment Configuration](ENV_CONFIG.md)** - Environment variables and settings

### 🎯 Quick Start
1. Follow the [Admin Setup Guide](ADMIN_SETUP.md) for complete installation
2. Configure your Slack app using [Slack Configuration](SLACK_CONFIG.md)
3. Set up environment variables with [Environment Configuration](ENV_CONFIG.md)
4. Deploy using the [Deployment Guide](DEPLOYMENT.md)
5. Share the [User Guide](USER_GUIDE.md) with your community

## What is AI Games?

AI Games transforms your Slack workspace into a competitive AI prompt community where members:

- 🚀 **Submit AI prompts and workflows** to earn XP and compete
- 🏆 **Climb leaderboards** through quality submissions and consistency  
- 🔥 **Build daily streaks** for bonus XP and achievements
- 🎯 **Participate in weekly challenges** with themed competitions
- 🏅 **Earn badges** for various accomplishments and milestones
- 📊 **Track personal analytics** and progress over time
- 🤝 **Engage with community** through comments and collaboration
- 📧 **Receive weekly digests** with highlights and insights

## Key Features

### 🎮 Gamification System
- **XP Points**: Earn 10-100+ XP per submission based on quality
- **Daily Streaks**: Build consistency with streak bonuses up to 50%
- **Leaderboards**: Global, seasonal, and monthly rankings
- **Badges**: 20+ achievement badges for various accomplishments
- **Seasons**: 12-week competitive periods with fresh starts

### 🤖 AI-Powered Content
- **LLM Integration**: Claude and OpenAI support for content generation
- **Weekly Digests**: Automated community and personal summaries
- **Quality Scoring**: AI-assisted evaluation of submission quality
- **Smart Recommendations**: Personalized tips and suggestions

### 👥 Community Features
- **Interactive Home Tab**: Personalized dashboard for each user
- **Comment System**: Helpful feedback and community engagement
- **Weekly Challenges**: Themed competitions and special events
- **Onboarding Flow**: Guided introduction for new users
- **Notification Preferences**: Customizable alerts and updates

### 🔧 Admin Tools
- **Season Management**: Control competition cycles and themes
- **User Management**: Moderate community and manage permissions
- **Analytics Dashboard**: Track engagement and community health
- **Digest Controls**: Manage automated content delivery
- **Security Logging**: Comprehensive audit trail

## Architecture Overview

### Core Components
- **Slack Bot**: Handles commands, events, and interactions
- **Database**: Supabase/PostgreSQL for data persistence  
- **LLM Services**: AI content generation and analysis
- **Scheduler**: Automated digest delivery and maintenance
- **Analytics**: User engagement and community metrics

### Tech Stack
- **Backend**: Node.js with TypeScript
- **Framework**: Slack Bolt SDK
- **Database**: Supabase (PostgreSQL)
- **AI**: Anthropic Claude / OpenAI GPT
- **Deployment**: Docker containerization
- **Monitoring**: Health checks and logging

## Getting Started

### For Administrators

1. **Read Prerequisites**: Check [Admin Setup Guide](ADMIN_SETUP.md#prerequisites)
2. **Create Slack App**: Follow [Slack Configuration](SLACK_CONFIG.md#app-manifest)
3. **Set Up Database**: Configure [Supabase or PostgreSQL](ADMIN_SETUP.md#database-setup)
4. **Configure Environment**: Use [Environment Guide](ENV_CONFIG.md)
5. **Deploy Application**: Choose from [Deployment Options](DEPLOYMENT.md#deployment-options)

### For Users

1. **Complete Onboarding**: Follow the 5-step guided process
2. **Submit First Prompt**: Use `/submit` to earn your first XP
3. **Explore Features**: Check leaderboards and set preferences
4. **Join Community**: Participate in challenges and discussions
5. **Build Streaks**: Submit daily for consistency bonuses

## Command Reference

### User Commands
| Command | Description | Example |
|---------|-------------|---------|
| `/submit` | Submit AI prompt for XP | `/submit Create a prompt for better emails` |
| `/status` | View personal statistics | `/status` or `/status @user` |
| `/leaderboard` | Show current rankings | `/leaderboard season 20` |
| `/streak` | Check submission streak | `/streak` |
| `/preferences` | Manage notifications | `/preferences update` |
| `/help` | Get command help | `/help submit` |

### Admin Commands  
| Command | Description | Example |
|---------|-------------|---------|
| `/season` | Manage seasons | `/season start name:"Season 2"` |
| `/digest` | Control digests | `/digest generate community` |

## Configuration Files

### Environment Variables
Key configuration settings in `.env`:

```bash
# Required
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_SIGNING_SECRET=your-secret
SUPABASE_URL=https://project.supabase.co
ANTHROPIC_API_KEY=sk-ant-your-key

# Optional
ADMIN_SLACK_IDS=U123,U456
SLACK_DIGEST_CHANNEL=C123456
NODE_ENV=production
```

### Database Schema
Main tables:
- `users` - User profiles and stats
- `submissions` - AI prompt submissions  
- `xp_events` - XP tracking and history
- `seasons` - Competition periods
- `digest_schedules` - Automated content delivery

## Security Considerations

### Data Protection
- Environment variables for sensitive data
- Request signature verification
- Rate limiting and input validation
- Secure database connections

### Access Control  
- Admin role management
- User permission validation
- Audit logging for admin actions
- Secure API key handling

### Privacy Compliance
- User data retention policies
- Optional analytics participation
- Data export capabilities
- Clear privacy documentation

## Monitoring and Maintenance

### Health Monitoring
- Application health checks at `/health`
- Database connection monitoring
- External API status verification
- Performance metrics collection

### Automated Maintenance
- Daily digest generation and delivery
- Weekly challenge management  
- Seasonal competition cycles
- Database cleanup and optimization

### Backup Strategy
- Daily database backups
- Configuration backup
- Disaster recovery procedures
- Backup verification testing

## Support and Troubleshooting

### Common Issues
- **Commands not responding**: Check bot permissions and channel access
- **XP not awarded**: Verify submission quality and duplicate checking
- **Streak not updating**: Confirm timezone and submission timing
- **Missing notifications**: Review user preferences and Slack settings

### Getting Help
1. **Check Documentation**: Review relevant guide sections
2. **Health Check**: Verify system status at `/health`
3. **Logs Review**: Check application logs for errors
4. **Community Support**: Ask in community channels
5. **Admin Contact**: Reach out to workspace administrators

### Development Resources
- **API Documentation**: Slack Bolt SDK and Supabase docs
- **LLM Guides**: Anthropic and OpenAI documentation
- **Deployment Platforms**: Railway, Render, Heroku guides
- **Monitoring Tools**: Health check and logging setup

## Contributing

### Development Setup
1. Clone repository and install dependencies
2. Copy `.env.example` to `.env` and configure
3. Set up development database
4. Run in development mode with hot reload

### Code Standards
- TypeScript for type safety
- ESLint for code quality
- Comprehensive error handling
- Security-first approach

### Testing
- Unit tests for core functions
- Integration tests for Slack interactions
- Load testing for performance
- Security testing for vulnerabilities

## Version History

### Latest Features
- ✅ Complete onboarding system
- ✅ Season management with XP decay
- ✅ AI-powered digest generation  
- ✅ Comprehensive badge system
- ✅ Personal analytics dashboard
- ✅ Scheduled digest delivery
- ✅ Security audit logging

### Roadmap
- Mobile app companion
- Advanced analytics dashboard
- Team-based competitions
- Integration marketplace
- Advanced AI features

## License and Terms

This application is designed for internal workspace use. Ensure compliance with:
- Slack's Terms of Service and API policies
- Your organization's data governance policies  
- Applicable privacy regulations (GDPR, CCPA, etc.)
- LLM provider terms and usage policies

---

**Ready to get started?** Begin with the [Admin Setup Guide](ADMIN_SETUP.md) to configure your AI Games community!