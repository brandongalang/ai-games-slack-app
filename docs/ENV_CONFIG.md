# Environment Configuration Guide

This document explains all environment variables used by the AI Games Slack App, including required and optional configurations.

## Table of Contents

1. [Quick Setup](#quick-setup)
2. [Required Variables](#required-variables)
3. [Optional Variables](#optional-variables)
4. [Environment-Specific Configurations](#environment-specific-configurations)
5. [Security Best Practices](#security-best-practices)
6. [Validation and Testing](#validation-and-testing)

## Quick Setup

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` with your actual values:
```bash
nano .env  # or your preferred editor
```

3. Validate your configuration:
```bash
npm run validate-env
```

## Required Variables

### Slack Configuration

#### `SLACK_BOT_TOKEN`
- **Format**: `xoxb-XXXXXXXXXX-XXXXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXX`
- **Source**: Slack App Dashboard > OAuth & Permissions > Bot User OAuth Token
- **Purpose**: Authenticate API calls to Slack
- **Example**: `SLACK_BOT_TOKEN=xoxb-XXX-XXX-XXXXXXXXXXXXX`

#### `SLACK_SIGNING_SECRET`
- **Format**: 32-character hexadecimal string
- **Source**: Slack App Dashboard > Basic Information > Signing Secret
- **Purpose**: Verify requests are from Slack
- **Example**: `SLACK_SIGNING_SECRET=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

#### `SLACK_APP_TOKEN` (Socket Mode Only)
- **Format**: `xapp-1-AXXXXXXXXXXX-XXXXXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
- **Source**: Slack App Dashboard > Socket Mode > App-Level Tokens
- **Purpose**: Establish WebSocket connection for Socket Mode
- **Example**: `SLACK_APP_TOKEN=xapp-1-AXXX-XXX-XXXXXXXXXXXXX...`

### Database Configuration

#### Supabase (Recommended)

##### `SUPABASE_URL`
- **Format**: `https://[project-id].supabase.co`
- **Source**: Supabase Dashboard > Project Settings > API > Project URL
- **Purpose**: Connect to Supabase database
- **Example**: `SUPABASE_URL=https://abcdefghijklmnop.supabase.co`

##### `SUPABASE_ANON_KEY`
- **Format**: JWT token (long base64-encoded string)
- **Source**: Supabase Dashboard > Project Settings > API > Project API keys > anon/public
- **Purpose**: Public API access (limited permissions)
- **Example**: `SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

##### `SUPABASE_SERVICE_ROLE_KEY`
- **Format**: JWT token (long base64-encoded string)
- **Source**: Supabase Dashboard > Project Settings > API > Project API keys > service_role
- **Purpose**: Full database access for server operations
- **Security**: ⚠️ **Keep this secret! Has full database access**
- **Example**: `SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

#### PostgreSQL (Alternative)

##### `DATABASE_URL`
- **Format**: `postgresql://username:password@host:port/database`
- **Purpose**: Direct PostgreSQL connection
- **Example**: `DATABASE_URL=postgresql://user:pass@localhost:5432/ai_games`

### LLM Provider Configuration

#### `LLM_PROVIDER`
- **Values**: `claude` or `openai`
- **Purpose**: Select which AI service to use
- **Default**: `claude`
- **Example**: `LLM_PROVIDER=claude`

#### `ANTHROPIC_API_KEY` (if using Claude)
- **Format**: `sk-ant-api03-...` (starts with sk-ant)
- **Source**: Anthropic Console > API Keys
- **Purpose**: Access Claude API for content generation
- **Example**: `ANTHROPIC_API_KEY=sk-ant-api03-abc123def456...`

#### `OPENAI_API_KEY` (if using OpenAI)
- **Format**: `sk-...` (starts with sk-)
- **Source**: OpenAI Platform > API Keys
- **Purpose**: Access OpenAI API for content generation
- **Example**: `OPENAI_API_KEY=sk-abc123def456...`

### Application Configuration

#### `NODE_ENV`
- **Values**: `development`, `staging`, `production`
- **Purpose**: Set application environment mode
- **Default**: `development`
- **Example**: `NODE_ENV=production`

#### `PORT`
- **Format**: Integer (1024-65535)
- **Purpose**: HTTP server port
- **Default**: `3000`
- **Example**: `PORT=3000`

#### `SCHEDULER_API_KEY`
- **Format**: Random string (recommend 32+ chars)
- **Purpose**: Authenticate cron job requests
- **Generate**: `openssl rand -hex 32`
- **Example**: `SCHEDULER_API_KEY=a1b2c3d4e5f6789012345678901234567890abcdef`

## Optional Variables

### Security Configuration

#### `BCRYPT_ROUNDS`
- **Format**: Integer (10-15)
- **Purpose**: Password hashing strength
- **Default**: `12`
- **Recommendation**: Higher = more secure but slower

#### `JWT_SECRET`
- **Format**: Random string (recommend 64+ chars)
- **Purpose**: Sign JWT tokens for sessions
- **Generate**: `openssl rand -hex 64`

#### `SESSION_TIMEOUT`
- **Format**: Integer (seconds)
- **Purpose**: How long sessions remain valid
- **Default**: `86400` (24 hours)

### Admin Configuration

#### `ADMIN_SLACK_IDS`
- **Format**: Comma-separated Slack user IDs
- **Purpose**: Grant admin privileges to users
- **Find IDs**: Right-click user in Slack > Copy member ID
- **Example**: `ADMIN_SLACK_IDS=U01234567,U09876543,U11111111`

#### `SUPER_ADMIN_SLACK_ID`
- **Format**: Single Slack user ID
- **Purpose**: Grant super admin privileges (highest level)
- **Example**: `SUPER_ADMIN_SLACK_ID=U01234567`

### Channel Configuration

#### `SLACK_DIGEST_CHANNEL`
- **Format**: Slack channel ID
- **Purpose**: Default channel for community digests
- **Default**: `general`
- **Find ID**: Right-click channel > Copy link > Extract ID from URL
- **Example**: `SLACK_DIGEST_CHANNEL=C1234567890`

### Performance Configuration

#### `RATE_LIMIT_REQUESTS_PER_MINUTE`
- **Format**: Integer
- **Purpose**: Limit API requests per minute per user
- **Default**: `100`

#### `RATE_LIMIT_BURST_SIZE`
- **Format**: Integer
- **Purpose**: Allow burst of requests before rate limiting
- **Default**: `200`

#### `CACHE_TTL_SECONDS`
- **Format**: Integer
- **Purpose**: How long to cache data
- **Default**: `3600` (1 hour)

### File Upload Configuration

#### `MAX_FILE_SIZE_MB`
- **Format**: Integer
- **Purpose**: Maximum file upload size
- **Default**: `10`

#### `ALLOWED_FILE_TYPES`
- **Format**: Comma-separated file extensions
- **Purpose**: Restrict file types for uploads
- **Default**: `txt,md,json,pdf,doc,docx`

### Logging Configuration

#### `LOG_LEVEL`
- **Values**: `error`, `warn`, `info`, `debug`
- **Purpose**: Control log verbosity
- **Default**: `info`

#### `LOG_FORMAT`
- **Values**: `combined`, `json`, `simple`
- **Purpose**: Log output format
- **Default**: `combined`

### External Integrations

#### `WEBHOOK_SUBMISSION_URL`
- **Format**: HTTPS URL
- **Purpose**: Send webhooks when submissions are made
- **Optional**: Only needed for external integrations

#### `WEBHOOK_SECRET`
- **Format**: Random string
- **Purpose**: Authenticate outgoing webhooks
- **Generate**: `openssl rand -hex 32`

#### `REDIS_URL`
- **Format**: `redis://host:port` or `redis://user:pass@host:port`
- **Purpose**: Redis cache connection
- **Optional**: Improves performance but not required

## Environment-Specific Configurations

### Development Environment

```bash
NODE_ENV=development
LOG_LEVEL=debug
DEBUG_MODE=true
MOCK_LLM_RESPONSES=false
SKIP_AUTH_CHECK=false
```

### Staging Environment

```bash
NODE_ENV=staging
LOG_LEVEL=info
RATE_LIMIT_DISABLED=true
ANALYTICS_ENABLED=true
```

### Production Environment

```bash
NODE_ENV=production
LOG_LEVEL=warn
ENABLE_MONITORING=true
BACKUP_ENABLED=true
GRACEFUL_SHUTDOWN_TIMEOUT=10000
```

## Security Best Practices

### Environment File Security

1. **Never commit `.env` files**:
```bash
# Add to .gitignore
.env
.env.local
.env.production
```

2. **Use different keys per environment**:
- Development: Lower security, easier debugging
- Staging: Production-like security
- Production: Maximum security, monitoring

3. **Rotate secrets regularly**:
- API keys: Monthly
- Database passwords: Quarterly
- JWT secrets: After any security incident

### Token Management

1. **Slack Tokens**:
   - Store securely in environment variables
   - Use workspace-specific tokens
   - Monitor token usage in Slack App Dashboard

2. **Database Credentials**:
   - Use connection pooling
   - Limit database user permissions
   - Enable SSL connections in production

3. **API Keys**:
   - Monitor usage and billing
   - Set up usage alerts
   - Use least-privilege principles

### Network Security

1. **HTTPS Only**:
   - Force HTTPS in production
   - Use proper SSL certificates
   - Enable HSTS headers

2. **Firewall Rules**:
   - Restrict database access
   - Allow only necessary ports
   - Use VPC/private networks

## Validation and Testing

### Environment Validation Script

Create `scripts/validate-env.js`:

```javascript
const requiredVars = [
  'SLACK_BOT_TOKEN',
  'SLACK_SIGNING_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'LLM_PROVIDER'
];

const missing = requiredVars.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  missing.forEach(key => console.error(`  - ${key}`));
  process.exit(1);
}

console.log('✅ All required environment variables are set');
```

### Testing Configuration

1. **Slack Connection**:
```bash
curl -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
     https://slack.com/api/auth.test
```

2. **Database Connection**:
```bash
npm run test:db
```

3. **LLM Provider**:
```bash
npm run test:llm
```

### Common Issues

#### Invalid Slack Token
- **Error**: `invalid_auth`
- **Solution**: Regenerate token in Slack App Dashboard

#### Database Connection Failed
- **Error**: `connection refused`
- **Solutions**:
  - Check database URL format
  - Verify network connectivity
  - Confirm credentials

#### LLM API Errors
- **Error**: `authentication failed`
- **Solutions**:
  - Verify API key format
  - Check account billing status
  - Confirm rate limits

### Environment Templates

#### `.env.development`
```bash
NODE_ENV=development
SLACK_BOT_TOKEN=xoxb-dev-token
SLACK_SIGNING_SECRET=dev-signing-secret
SUPABASE_URL=https://dev-project.supabase.co
LLM_PROVIDER=claude
LOG_LEVEL=debug
```

#### `.env.production`
```bash
NODE_ENV=production
SLACK_BOT_TOKEN=xoxb-prod-token
SLACK_SIGNING_SECRET=prod-signing-secret
SUPABASE_URL=https://prod-project.supabase.co
LLM_PROVIDER=claude
LOG_LEVEL=warn
BCRYPT_ROUNDS=14
```

---

**Next Steps**: After configuring your environment, proceed to [Deployment Guide](DEPLOYMENT.md) for application deployment instructions.