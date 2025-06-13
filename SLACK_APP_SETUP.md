# Slack App Configuration

This document outlines the required Slack App configuration for the AI Games app.

## App Manifest

When creating your Slack app, use this manifest or configure the settings manually:

```yaml
display_information:
  name: AI Games
  description: Gamified AI prompt sharing and collaboration
  background_color: "#3b4dbf"

features:
  app_home:
    home_tab_enabled: true
    messages_tab_enabled: false
    messages_tab_read_only_enabled: false
  bot_user:
    display_name: AI Games Bot
    always_online: true
  shortcuts:
    - name: Remix this
      type: message
      callback_id: remix_this_prompt
      description: Create a remix of this prompt
  slash_commands:
    - command: /submit
      description: Submit an AI prompt or workflow
      should_escape: false
    - command: /status
      description: Check your XP, streak, and stats
      should_escape: false
    - command: /library
      description: Browse the prompt library
      should_escape: false

oauth_config:
  scopes:
    bot:
      - app_mentions:read
      - chat:write
      - commands
      - users.profile:read
      - users.profile:write
      - files:read
      - files:write

settings:
  event_subscriptions:
    bot_events:
      - app_home_opened
      - app_mention
      - message.channels
  interactivity:
    is_enabled: true
  org_deploy_enabled: false
  socket_mode_enabled: true
  token_rotation_enabled: false
```

## Required OAuth Scopes

### Bot Token Scopes
- `app_mentions:read` - To handle @mentions
- `chat:write` - To send messages and DMs
- `commands` - To handle slash commands
- `users.profile:read` - To read user profile information
- `users.profile:write` - To update user profiles with badges
- `files:read` - To read uploaded files in submissions
- `files:write` - To upload files (if needed)

## Event Subscriptions

Enable the following bot events:
- `app_home_opened` - When users open the Home tab
- `app_mention` - When the bot is mentioned
- `message.channels` - To detect potential prompts for remix

## Slash Commands

Configure these slash commands:

### `/submit`
- **Description:** Submit an AI prompt or workflow
- **Usage Hint:** `/submit`
- **Escape channels, users, and links:** No

### `/status`  
- **Description:** Check your XP, streak, and stats
- **Usage Hint:** `/status`
- **Escape channels, users, and links:** No

### `/library`
- **Description:** Browse the prompt library  
- **Usage Hint:** `/library [search]`
- **Escape channels, users, and links:** No

## Message Shortcuts

Configure this message shortcut:

### Remix this
- **Name:** Remix this
- **Callback ID:** `remix_this_prompt`
- **Description:** Create a remix of this prompt

## App Home

- **Home Tab:** Enabled
- **Messages Tab:** Disabled

## Socket Mode

For development, enable Socket Mode and create an App Token with `connections:write` scope.

## Environment Variables

After configuring your app, you'll need these environment variables:

```bash
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token  # For Socket Mode
```

## Installation URLs

Configure your app's installation flow if distributing to other workspaces. For internal use, you can install directly from the app settings.

## Testing the Configuration

1. Install the app to your workspace
2. Test `/submit` command
3. Test the "Remix this" message shortcut on any message
4. Open the Home tab to verify it loads
5. Check that the bot can send DMs for confirmations