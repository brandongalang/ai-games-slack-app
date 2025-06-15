# Slack App Configuration Reference

This document provides detailed information about configuring the AI Games Slack app, including all required permissions, event subscriptions, and interactive components.

## Table of Contents

1. [App Manifest](#app-manifest)
2. [OAuth Scopes](#oauth-scopes)
3. [Event Subscriptions](#event-subscriptions)
4. [Slash Commands](#slash-commands)
5. [Interactive Components](#interactive-components)
6. [Socket Mode vs HTTP Mode](#socket-mode-vs-http-mode)
7. [App Distribution](#app-distribution)

## App Manifest

Use this complete app manifest when creating your Slack app:

```yaml
display_information:
  name: AI Games
  description: Competitive AI prompt community with XP, streaks, and leaderboards
  background_color: "#4A154B"
  long_description: "AI Games transforms your Slack workspace into a competitive AI prompt community. Members submit creative AI prompts and workflows, earn XP, build streaks, and climb leaderboards. Features include seasonal competitions, automated weekly digests, badge systems, and comprehensive analytics. Perfect for teams looking to gamify AI adoption and share best practices."
features:
  app_home:
    home_tab_enabled: true
    messages_tab_enabled: false
  bot_user:
    display_name: AI Games
    always_online: true
  shortcuts:
    - name: Submit AI Prompt
      type: global
      callback_id: submit_prompt_shortcut
      description: Quickly submit an AI prompt from anywhere in Slack
  slash_commands:
    - command: /submit
      description: Submit an AI prompt or workflow for XP and competition
      usage_hint: "[prompt text or attach file]"
      should_escape: false
    - command: /leaderboard
      description: View current leaderboard rankings
      usage_hint: "[global|season|monthly] [limit:10]"
      should_escape: false
    - command: /streak
      description: Check your current submission streak
      usage_hint: "[target_user] (admin only)"
      should_escape: false
    - command: /status
      description: View detailed stats, XP breakdown, and progress
      usage_hint: "[target_user] (admin only)"
      should_escape: false
    - command: /season
      description: Season management commands (admin only)
      usage_hint: "[start|end|status|leaderboard|reset|create|update]"
      should_escape: false
    - command: /digest
      description: Digest management commands (admin only)
      usage_hint: "[generate|send|schedule|analytics]"
      should_escape: false
    - command: /preferences
      description: Manage notification preferences and settings
      usage_hint: "[view|update]"
      should_escape: false
    - command: /help
      description: Show help and available commands
      should_escape: false
oauth_config:
  redirect_urls:
    - https://your-domain.com/slack/oauth_redirect
  scopes:
    user:
      - identity.basic
    bot:
      - app_mentions:read
      - channels:history
      - channels:read
      - chat:write
      - chat:write.customize
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
    request_url: https://your-domain.com/slack/events
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
      - team_join
      - user_change
  interactivity:
    is_enabled: true
    request_url: https://your-domain.com/slack/interactive
    message_menu_options_url: https://your-domain.com/slack/options
  org_deploy_enabled: false
  socket_mode_enabled: true
  token_rotation_enabled: false
```

## OAuth Scopes

### Bot Token Scopes (Required)

| Scope | Purpose | Critical |
|-------|---------|----------|
| `app_mentions:read` | Detect when bot is mentioned | ✅ |
| `channels:history` | Read message history in public channels | ✅ |
| `channels:read` | View basic information about public channels | ✅ |
| `chat:write` | Send messages as the bot | ✅ |
| `chat:write.customize` | Send messages with custom username and avatar | ⚠️ |
| `chat:write.public` | Send messages to channels bot isn't a member of | ⚠️ |
| `commands` | Handle slash commands | ✅ |
| `files:read` | Access files shared in conversations | ✅ |
| `groups:history` | Read message history in private channels | ⚠️ |
| `groups:read` | View basic information about private channels | ⚠️ |
| `im:history` | Read message history in direct messages | ✅ |
| `im:read` | View basic information about direct messages | ✅ |
| `im:write` | Send direct messages | ✅ |
| `mpim:history` | Read message history in group direct messages | ⚠️ |
| `mpim:read` | View basic information about group direct messages | ⚠️ |
| `mpim:write` | Send messages to group direct messages | ⚠️ |
| `reactions:read` | View emoji reactions on messages | ⚠️ |
| `reactions:write` | Add emoji reactions to messages | ⚠️ |
| `team:read` | View basic information about the workspace | ✅ |
| `users:read` | View people in the workspace | ✅ |
| `users:write` | Set presence for the bot user | ⚠️ |
| `users.profile:read` | View profile information about people | ✅ |
| `users.profile:write` | Edit profile information for users | ⚠️ |

### User Token Scopes (Optional)

| Scope | Purpose |
|-------|---------|
| `identity.basic` | Confirm user's identity |

**Legend**: ✅ Critical for core functionality, ⚠️ Optional/enhanced features

## Event Subscriptions

### Bot Events

| Event | Trigger | Handler Purpose |
|-------|---------|-----------------|
| `app_home_opened` | User opens App Home tab | Display personalized dashboard |
| `app_mention` | Bot is @mentioned | Process mentions for submissions |
| `file_shared` | File shared in monitored channel | Process file-based submissions |
| `message.channels` | Message in public channel | Monitor for inline submissions |
| `message.groups` | Message in private channel | Monitor private channel activity |
| `message.im` | Direct message to bot | Handle private interactions |
| `message.mpim` | Group DM message | Handle group conversations |
| `reaction_added` | User adds reaction | Track engagement metrics |
| `reaction_removed` | User removes reaction | Update engagement tracking |
| `team_join` | New user joins workspace | Trigger onboarding flow |
| `user_change` | User profile changes | Update user data cache |

### Event Payload Examples

#### app_home_opened
```json
{
  "type": "app_home_opened",
  "user": "U1234567890",
  "channel": "D1234567890",
  "tab": "home",
  "view": {
    "id": "V1234567890",
    "team_id": "T1234567890"
  }
}
```

#### app_mention
```json
{
  "type": "app_mention",
  "user": "U1234567890",
  "text": "<@U0LAN0Z89> submit this amazing prompt",
  "ts": "1234567890.123456",
  "channel": "C1234567890",
  "thread_ts": "1234567890.123456"
}
```

## Slash Commands

### Command Specifications

#### `/submit`
- **Description**: Submit an AI prompt or workflow
- **Usage**: `/submit [prompt text or attachment]`
- **Parameters**: 
  - Text: Direct prompt submission
  - Attachments: File-based submissions
- **Response**: Ephemeral confirmation with XP earned

#### `/leaderboard`
- **Description**: View current rankings
- **Usage**: `/leaderboard [type] [limit]`
- **Parameters**:
  - `type`: `global`, `season`, `monthly` (default: global)
  - `limit`: Number of users to show (default: 10, max: 50)
- **Response**: Public leaderboard display

#### `/streak`
- **Description**: Check submission streak
- **Usage**: `/streak [user]`
- **Parameters**:
  - `user`: Target user (admin only, defaults to self)
- **Response**: Streak information and motivation

#### `/status`
- **Description**: Detailed user statistics
- **Usage**: `/status [user]`
- **Parameters**:
  - `user`: Target user (admin only, defaults to self)
- **Response**: Comprehensive stats modal

#### `/season` (Admin Only)
- **Description**: Season management
- **Usage**: `/season [action] [parameters]`
- **Actions**:
  - `start`: Begin new season
  - `end`: End current season
  - `status`: View season information
  - `leaderboard`: Season-specific rankings
  - `reset`: Reset season data
  - `create`: Create new season
  - `update`: Modify season settings
- **Response**: Action confirmation

#### `/digest` (Admin Only)
- **Description**: Digest management
- **Usage**: `/digest [action] [parameters]`
- **Actions**:
  - `generate`: Create digest manually
  - `send`: Send digest to channel
  - `schedule`: Configure scheduling
  - `analytics`: View delivery stats
- **Response**: Digest management interface

#### `/preferences`
- **Description**: User notification settings
- **Usage**: `/preferences [action]`
- **Actions**:
  - `view`: Show current settings
  - `update`: Modify preferences
- **Response**: Settings modal

#### `/help`
- **Description**: Command reference
- **Usage**: `/help [command]`
- **Parameters**:
  - `command`: Specific command help (optional)
- **Response**: Help documentation

## Interactive Components

### Action IDs

#### Home Tab Actions
| Action ID | Component | Purpose |
|-----------|-----------|---------|
| `view_detailed_status` | Button | Open detailed stats modal |
| `view_full_analytics` | Button | Show analytics dashboard |
| `view_streak_status` | Button | Display streak information |
| `view_xp_breakdown` | Button | Show XP breakdown |
| `trigger_submit_command` | Button | Open submission modal |
| `view_full_leaderboard` | Button | Display complete leaderboard |
| `submit_challenge_response` | Button | Open challenge submission |

#### Onboarding Actions
| Action ID | Component | Purpose |
|-----------|-----------|---------|
| `onboarding_start` | Button | Begin onboarding flow |
| `onboarding_next_step` | Button | Proceed to next step |
| `onboarding_skip` | Button | Skip onboarding |
| `onboarding_complete` | Button | Finish onboarding |

#### Preference Actions
| Action ID | Component | Purpose |
|-----------|-----------|---------|
| `preferences_update` | Button | Open preferences modal |
| `notification_toggle` | Select | Toggle notification types |
| `digest_frequency` | Select | Set digest frequency |
| `reminder_settings` | Select | Configure reminders |

#### Submission Actions
| Action ID | Component | Purpose |
|-----------|-----------|---------|
| `submit_prompt_modal` | Button | Open submission modal |
| `submission_category` | Select | Choose prompt category |
| `submission_tags` | Multi-select | Add tags to submission |
| `submission_submit` | Button | Submit the prompt |

### Modal View IDs

| View ID | Purpose | Trigger |
|---------|---------|---------|
| `submit_prompt_modal` | Prompt submission | Various submit buttons |
| `detailed_stats_modal` | User statistics | Stats buttons |
| `preferences_modal` | User preferences | Preferences commands |
| `admin_season_modal` | Season management | Season commands |
| `admin_digest_modal` | Digest management | Digest commands |

### Block Kit Elements

#### Common Elements Used
- **Sections**: Text content with optional accessories
- **Dividers**: Visual separation between content blocks
- **Actions**: Button and select menu containers
- **Context**: Supplementary information in smaller text
- **Header**: Prominent section titles
- **Mrkdwn**: Slack's markdown formatting

#### Custom Elements
- **Progress Bars**: ASCII-based XP and streak visualization
- **Leaderboard Tables**: Formatted user rankings
- **Statistics Cards**: Key metrics display
- **Achievement Badges**: Visual accomplishment indicators

## Socket Mode vs HTTP Mode

### Socket Mode (Recommended)

**Pros**:
- No public endpoint required
- Real-time WebSocket connection
- Easier development and testing
- Built-in retry mechanisms

**Cons**:
- Requires app-level token
- May have higher latency
- Not suitable for high-throughput apps

**Configuration**:
1. Enable Socket Mode in app settings
2. Generate App-Level Token with `connections:write` scope
3. Set `SLACK_APP_TOKEN` environment variable
4. No webhook URLs needed

### HTTP Mode

**Pros**:
- Lower latency
- Better for high-throughput
- More traditional webhook approach
- Easier to monitor and debug

**Cons**:
- Requires public HTTPS endpoint
- Manual signature verification
- Need to handle retry logic
- SSL certificate management

**Configuration**:
1. Disable Socket Mode
2. Set up HTTPS endpoints:
   - Events: `https://your-domain.com/slack/events`
   - Interactivity: `https://your-domain.com/slack/interactive`
   - Options: `https://your-domain.com/slack/options`
3. Configure request URLs in app settings
4. Implement signature verification

## App Distribution

### Workspace Installation

For single workspace deployment:

1. Use "Install to Workspace" button
2. Authorize required permissions
3. Bot automatically joins workspace
4. Configure admin users in environment variables

### Slack App Directory

For public distribution:

1. Complete app review process
2. Provide privacy policy and terms of service
3. Submit detailed app description
4. Include screenshots and documentation
5. Pass Slack's security review

### Enterprise Grid

For Enterprise Grid deployment:

1. Enable org-wide deployment
2. Configure org-level permissions
3. Handle multi-workspace scenarios
4. Implement workspace discovery
5. Manage cross-workspace data

## Security Considerations

### Request Verification

Always verify Slack requests:

```typescript
import crypto from 'crypto';

function verifySlackRequest(body: string, signature: string, timestamp: string): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET!;
  const baseString = `v0:${timestamp}:${body}`;
  const hash = crypto
    .createHmac('sha256', signingSecret)
    .update(baseString)
    .digest('hex');
  const expectedSignature = `v0=${hash}`;
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### Token Security

- Store tokens as environment variables
- Use different tokens for different environments
- Regularly rotate tokens
- Monitor token usage and access

### Data Privacy

- Only request necessary permissions
- Implement data retention policies
- Provide user data export/deletion
- Comply with privacy regulations

## Testing and Validation

### Development Testing

1. Create separate development Slack workspace
2. Use ngrok for local webhook testing
3. Test all interactive components
4. Verify permission flows
5. Check error handling

### Production Validation

1. Monitor webhook response times
2. Track API rate limit usage
3. Validate all OAuth scopes are needed
4. Test with various user permission levels
5. Verify cross-platform compatibility

---

**Next Steps**: After configuring your Slack app, proceed to [Environment Configuration](ENV_CONFIG.md) for setting up the runtime environment.