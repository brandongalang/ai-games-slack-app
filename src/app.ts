// Load environment variables first, before any other imports
import dotenv from 'dotenv';
dotenv.config();

import { App } from '@slack/bolt';
import express from 'express';
import { schedulerRouter } from './routes/scheduler';
import { streaksRouter } from './routes/streaks';
import { xpRouter } from './routes/xp';
import { securityMiddleware } from './middleware/security';
import { SecurityService } from './services/securityService';

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
  // No port needed in Socket Mode - WebSocket connection handles everything
});

// Create Express app for HTTP endpoints (scheduler, webhooks)
const expressApp = express();

// Apply security middleware
expressApp.use(securityMiddleware);
expressApp.use(express.json({ limit: '10mb' })); // Limit payload size

// Make Slack app available to Express routes and globally for services
expressApp.set('slackApp', app);
(global as any).slackApp = app;

// Add scheduler routes
expressApp.use('/scheduler', schedulerRouter);

// Add streaks routes
expressApp.use('/streaks', streaksRouter);

// Add XP routes
expressApp.use('/xp', xpRouter);

// Health check endpoint for Docker
expressApp.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Handle app_home_opened event
app.event('app_home_opened', async ({ event, client }) => {
  try {
    console.log('Enhanced home tab opened by user:', event.user);
    
    const { HomeTabService } = await import('./services/homeTabService');
    const { OnboardingService } = await import('./services/onboardingService');
    
    // Get welcome data (includes onboarding)
    const welcomeData = await OnboardingService.getWelcomeData(event.user);
    
    if (welcomeData && welcomeData.isFirstTime) {
      // Show onboarding-focused home tab for new users
      const onboardingBlocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🎮 *Welcome to AI Games, ${welcomeData.user.display_name || 'there'}!*\n\nJoin ${welcomeData.quickStats.totalUsers} members in Season ${welcomeData.quickStats.currentSeasonNumber} competing with AI prompts and workflows!`
          }
        },
        {
          type: 'divider'
        },
        ...OnboardingService.formatOnboardingForSlack(welcomeData.onboardingProgress),
        {
          type: 'divider'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '📊 *Quick Stats*'
          },
          fields: [
            {
              type: 'mrkdwn',
              text: `*Total Members:* ${welcomeData.quickStats.totalUsers}`
            },
            {
              type: 'mrkdwn',
              text: `*Active This Month:* ${welcomeData.quickStats.activeSeasonUsers}`
            },
            {
              type: 'mrkdwn',
              text: `*Current Season:* #${welcomeData.quickStats.currentSeasonNumber}`
            },
            {
              type: 'mrkdwn',
              text: `*Your XP:* ${welcomeData.user.total_xp}`
            }
          ]
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '🚀 Submit First Prompt'
              },
              action_id: 'trigger_submit_command',
              style: 'primary'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '⚙️ Set Preferences'
              },
              action_id: 'set_preferences'
            }
          ]
        }
      ];

      await client.views.publish({
        user_id: event.user,
        view: {
          type: 'home',
          blocks: onboardingBlocks
        }
      });
      return;
    }
    
    // Get comprehensive home tab data for existing users
    const homeTabData = await HomeTabService.getHomeTabData(event.user);
    
    // Format enhanced home tab blocks
    const blocks = HomeTabService.formatEnhancedHomeTab(homeTabData, event.user);

    await client.views.publish({
      user_id: event.user,
      view: {
        type: 'home',
        blocks
      }
    });
  } catch (error) {
    console.error('Error publishing enhanced home tab:', error);
    
    // Fallback to basic home tab
    await client.views.publish({
      user_id: event.user,
      view: {
        type: 'home',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '🎮 *Welcome to AI Games!*\n\nThis is your comprehensive dashboard for XP, streaks, achievements, and community competition!'
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '📊 *Getting Started*\nUse `/submit` to submit your first prompt and start earning XP!'
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '🚀 Submit Prompt'
                },
                action_id: 'trigger_submit_command',
                style: 'primary'
              }
            ]
          }
        ]
      }
    });
  }
});

// Handle /submit slash command
app.command('/submit', async ({ ack, body, client }) => {
  await ack();
  
  try {
    // Get submissions for remix dropdown (exclude user's own submissions)
    const { SubmissionService } = await import('./services/submissionService');
    const { UserService } = await import('./services/userService');
    
    const user = await UserService.getUserBySlackId(body.user_id);
    const remixOptions = await SubmissionService.getSubmissionsForRemix(user?.user_id);
    
    const remixSelectOptions = remixOptions.map(sub => ({
      text: { type: 'plain_text' as const, text: sub.title },
      value: sub.id.toString()
    }));

    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'submit_prompt_modal',
        title: {
          type: 'plain_text',
          text: 'Submit Your Prompt'
        },
        blocks: [
          {
            type: 'input',
            block_id: 'title_input',
            element: {
              type: 'plain_text_input',
              action_id: 'title_text',
              placeholder: {
                type: 'plain_text',
                text: 'Give your prompt a catchy title...'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Title'
            },
            optional: true
          },
          {
            type: 'input',
            block_id: 'prompt_input',
            element: {
              type: 'plain_text_input',
              action_id: 'prompt_text',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Enter your AI prompt or workflow here...'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Prompt/Workflow *'
            }
          },
          {
            type: 'input',
            block_id: 'description_input',
            element: {
              type: 'plain_text_input',
              action_id: 'description_text',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Describe what this prompt does, how to use it, or what makes it special...'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Description'
            },
            optional: true
          },
          {
            type: 'input',
            block_id: 'output_input',
            element: {
              type: 'plain_text_input',
              action_id: 'output_text',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Share an example output or result from using this prompt...'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Example Output'
            },
            optional: true
          },
          {
            type: 'input',
            block_id: 'tags_input',
            element: {
              type: 'plain_text_input',
              action_id: 'tags_text',
              placeholder: {
                type: 'plain_text',
                text: 'e.g., writing, coding, analysis, creative'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Tags (comma-separated)'
            },
            optional: true
          },
          ...(remixSelectOptions.length > 0 ? [{
            type: 'input' as const,
            block_id: 'remix_input',
            element: {
              type: 'static_select' as const,
              action_id: 'remix_selection',
              placeholder: {
                type: 'plain_text' as const,
                text: 'Choose a prompt to remix...'
              },
              options: remixSelectOptions.slice(0, 100) // Slack has a 100 option limit
            },
            label: {
              type: 'plain_text' as const,
              text: 'Remix of (Optional)'
            },
            optional: true
          }] : [])
        ],
        submit: {
          type: 'plain_text',
          text: 'Submit'
        }
      }
    });
  } catch (error) {
    console.error('Error opening modal:', error);
    
    // Fallback modal without remix options
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'submit_prompt_modal',
        title: {
          type: 'plain_text',
          text: 'Submit Your Prompt'
        },
        blocks: [
          {
            type: 'input',
            block_id: 'prompt_input',
            element: {
              type: 'plain_text_input',
              action_id: 'prompt_text',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Enter your AI prompt or workflow here...'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Prompt/Workflow'
            }
          }
        ],
        submit: {
          type: 'plain_text',
          text: 'Submit'
        }
      }
    });
  }
});

// Handle /leaderboard slash command
app.command('/leaderboard', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const { LeaderboardService } = await import('./services/leaderboardService');
    
    // Get leaderboard data
    const leaderboard = await LeaderboardService.getGlobalLeaderboard(10);
    const blocks = LeaderboardService.formatLeaderboardForSlack(
      leaderboard,
      '🏆 AI Games Leaderboard',
      body.user_id
    );

    // Send as ephemeral message
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: '🏆 AI Games Leaderboard',
      blocks
    });
    
  } catch (error) {
    console.error('Error handling /leaderboard command:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: '❌ Sorry, there was an error fetching the leaderboard. Please try again later.'
    });
  }
});

// Handle /stats slash command
app.command('/stats', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const { StatusService } = await import('./services/statusService');
    const { UserService } = await import('./services/userService');
    
    // Check if user exists and has data
    const user = await UserService.getUserBySlackId(body.user_id);
    
    let blocks: any[];
    
    if (!user) {
      // New user - show welcome and getting started info
      blocks = StatusService.formatNewUserStatus();
    } else {
      // Existing user - show comprehensive status
      blocks = await StatusService.formatComprehensiveStatus(body.user_id);
    }
    
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: user ? '📊 Your Complete AI Games Status' : '🎮 Welcome to AI Games!',
      blocks
    });
    
  } catch (error) {
    console.error('Error handling /stats command:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: '❌ Sorry, there was an error fetching your stats. Please try again later.'
    });
  }
});

// Handle /analytics slash command  
app.command('/analytics', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const { AnalyticsService } = await import('./services/analyticsService');
    
    // Get user analytics
    const analytics = await AnalyticsService.getUserAnalytics(body.user_id);
    
    if (!analytics) {
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '🎮 *Welcome to AI Games!*\n\nYou haven\'t submitted any prompts yet. Use `/submit` to get started and see your analytics!',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '🎮 *Welcome to AI Games!*\n\nYou haven\'t submitted any prompts yet. Use `/submit` to get started and see your analytics!'
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '🚀 Submit First Prompt'
                },
                action_id: 'trigger_submit_command'
              }
            ]
          }
        ]
      });
      return;
    }

    const blocks = AnalyticsService.formatAnalyticsForSlack(analytics);
    
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: `📊 Your Advanced Analytics`,
      blocks
    });
    
  } catch (error) {
    console.error('Error handling /analytics command:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: '❌ Sorry, there was an error fetching your analytics. Please try again later.'
    });
  }
});

// Handle /community slash command
app.command('/community', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const { AnalyticsService } = await import('./services/analyticsService');
    
    // Get community analytics
    const communityStats = await AnalyticsService.getCommunityAnalytics();
    
    const trendEmoji = {
      growing: '📈',
      stable: '➡️',
      declining: '📉'
    };

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🌟 *AI Games Community Analytics*`
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*👥 Total Members*\n${communityStats.totalUsers}`
          },
          {
            type: 'mrkdwn',
            text: `*🔥 Active Users*\n${communityStats.activeUsers}`
          },
          {
            type: 'mrkdwn',
            text: `*📝 Total Submissions*\n${communityStats.totalSubmissions.toLocaleString()}`
          },
          {
            type: 'mrkdwn',
            text: `*💰 Total XP*\n${communityStats.totalXP.toLocaleString()}`
          }
        ]
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*📊 Avg XP/User*\n${communityStats.averageXpPerUser}`
          },
          {
            type: 'mrkdwn',
            text: `*${trendEmoji[communityStats.activityTrend]} Trend*\n${communityStats.activityTrend.charAt(0).toUpperCase() + communityStats.activityTrend.slice(1)}`
          },
          {
            type: 'mrkdwn',
            text: `*🆕 New This Week*\n${communityStats.newUsersThisWeek} users`
          },
          {
            type: 'mrkdwn',
            text: `*📝 Posts This Week*\n${communityStats.submissionsThisWeek}`
          }
        ]
      }
    ];

    // Add top categories if available
    if (communityStats.topCategories.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🏷️ Popular Categories*\n${communityStats.topCategories.slice(0, 5).map(cat => `• ${cat.category} (${cat.count})`).join('\n')}`
        }
      });
    }

    // Add streak leaders
    if (communityStats.streakLeaders.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🔥 Streak Leaders*\n${communityStats.streakLeaders.map((leader, i) => `${i + 1}. ${leader.username} - ${leader.streak} days`).join('\n')}`
        }
      });
    }

    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: `🌟 AI Games Community Analytics`,
      blocks
    });
    
  } catch (error) {
    console.error('Error handling /community command:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: '❌ Sorry, there was an error fetching community analytics. Please try again later.'
    });
  }
});

// Handle /streak slash command
app.command('/streak', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const { StreakService } = await import('./services/streakService');
    const { UserService } = await import('./services/userService');
    
    // Get user by Slack ID
    const user = await UserService.getUserBySlackId(body.user_id);
    
    if (!user) {
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '🎮 *Welcome to AI Games!*\n\nYou haven\'t submitted any prompts yet. Use `/submit` to get started and start your streak!',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '🎮 *Welcome to AI Games!*\n\nYou haven\'t submitted any prompts yet. Use `/submit` to get started and start your streak!'
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '🚀 Submit First Prompt'
                },
                action_id: 'trigger_submit_command'
              }
            ]
          }
        ]
      });
      return;
    }

    // Get user's streak data
    const streakData = await StreakService.calculateUserStreak(user.user_id);
    const streakBlocks = StreakService.formatStreakForSlack(streakData);
    
    // Get streak leaders for comparison
    const streakLeaders = await StreakService.getStreakLeaders(5);
    
    const leaderboardText = streakLeaders.length > 0 
      ? `\n\n*🏆 Streak Leaders*\n${streakLeaders.map((leader, i) => `${i + 1}. ${leader.username} - ${leader.streak} days`).join('\n')}`
      : '';

    const fullBlocks = [
      ...streakBlocks,
      ...(leaderboardText ? [
        { type: 'divider' },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: leaderboardText
          }
        }
      ] : []),
      { type: 'divider' },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '💡 Keep your streak alive by submitting prompts, comments, or reactions daily!'
          }
        ]
      }
    ];
    
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: `🔥 Your Streak Status`,
      blocks: fullBlocks
    });
    
  } catch (error) {
    console.error('Error handling /streak command:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: '❌ Sorry, there was an error fetching your streak data. Please try again later.'
    });
  }
});

// Handle /xp slash command for comprehensive XP breakdown
app.command('/xp', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const { XPService } = await import('./services/xpService');
    const { UserService } = await import('./services/userService');
    
    // Get user by Slack ID
    const user = await UserService.getUserBySlackId(body.user_id);
    
    if (!user) {
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '🎮 *Welcome to AI Games!*\n\nYou haven\'t submitted any prompts yet. Use `/submit` to get started and start earning XP!',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '🎮 *Welcome to AI Games!*\n\nYou haven\'t submitted any prompts yet. Use `/submit` to get started and start earning XP!'
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '🚀 Submit First Prompt'
                },
                action_id: 'trigger_submit_command'
              }
            ]
          }
        ]
      });
      return;
    }

    // Get comprehensive XP breakdown
    const breakdown = await XPService.getUserXPBreakdown(user.user_id, 30);
    const xpBlocks = XPService.formatXPBreakdownForSlack(breakdown);
    
    // Add daily XP trend
    const recentDays = breakdown.dailyXP.slice(-7);
    const trendText = recentDays.length > 0
      ? `*📈 Recent Activity (Last 7 Days)*\n${recentDays.map(day => 
          `${day.date}: ${day.xp} XP (${day.events} events)`
        ).join('\n')}`
      : '*📈 Recent Activity*\nNo activity in the last 7 days';

    const fullBlocks = [
      ...xpBlocks,
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: trendText
        }
      },
      { type: 'divider' },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📊 View Analytics'
            },
            action_id: 'view_full_analytics'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🔥 View Streak'
            },
            action_id: 'view_streak_status'
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '💡 Improve your quality score by submitting clear, helpful, and original content!'
          }
        ]
      }
    ];
    
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: `💰 Your XP Breakdown`,
      blocks: fullBlocks
    });
    
  } catch (error) {
    console.error('Error handling /xp command:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: '❌ Sorry, there was an error fetching your XP breakdown. Please try again later.'
    });
  }
});

// Handle modal submission
app.view('submit_prompt_modal', async ({ ack, body, view, client }) => {
  await ack();
  
  try {
    const { SubmissionService } = await import('./services/submissionService');
    const { UserService } = await import('./services/userService');
    const { supabaseAdmin } = await import('./database/supabase');
    
    // Get or create user first for security checks
    const user = await UserService.getOrCreateUser(body.user.id, body.user.name);
    
    // Extract form values
    const rawTitle = view.state.values.title_input?.title_text?.value?.trim();
    const rawPromptText = view.state.values.prompt_input.prompt_text.value?.trim() || '';
    const rawDescription = view.state.values.description_input?.description_text?.value?.trim();
    const rawOutputSample = view.state.values.output_input?.output_text?.value?.trim();
    const rawTagsInput = view.state.values.tags_input?.tags_text?.value?.trim();
    const remixSelection = view.state.values.remix_input?.remix_selection?.selected_option?.value;
    
    // Security: Check user behavior before processing
    const behaviorCheck = await SecurityService.checkUserBehavior(user.user_id);
    if (behaviorCheck.isSuspicious && behaviorCheck.riskLevel === 'high') {
      await SecurityService.logSecurityEvent({
        userId: user.user_id,
        slackUserId: body.user.id,
        eventType: 'suspicious_behavior',
        description: `High-risk submission blocked: ${behaviorCheck.reasons.join(', ')}`,
        riskLevel: 'high',
        metadata: { reasons: behaviorCheck.reasons }
      });

      await client.chat.postMessage({
        channel: body.user.id,
        text: `🚫 *Submission Blocked*\n\nYour submission has been blocked due to suspicious activity patterns. Please contact an administrator if you believe this is an error.\n\nReason: ${behaviorCheck.reasons.join(', ')}`
      });
      return;
    }

    // Security: Validate and sanitize input
    const validation = SecurityService.validateSubmissionContent(rawPromptText);
    if (!validation.isValid) {
      await SecurityService.logSecurityEvent({
        userId: user.user_id,
        slackUserId: body.user.id,
        eventType: 'validation_failed',
        description: `Submission validation failed: ${validation.errors.join(', ')}`,
        riskLevel: 'medium',
        metadata: { errors: validation.errors }
      });

      await client.chat.postMessage({
        channel: body.user.id,
        text: `❌ *Submission Error*\n\nYour submission doesn't meet our content guidelines:\n\n${validation.errors.map(error => `• ${error}`).join('\n')}\n\nPlease revise and try again.`
      });
      return;
    }

    // Security: Check for PII and warn user
    const piiCheck = SecurityService.detectPotentialPII(rawPromptText);
    if (piiCheck.hasPII) {
      await client.chat.postMessage({
        channel: body.user.id,
        text: `⚠️ *Privacy Warning*\n\nYour submission may contain personal information:\n\n${piiCheck.warnings.map(warning => `• ${warning}`).join('\n')}\n\nPlease review and remove any sensitive information before sharing.`
      });
    }

    // Security: Sanitize all inputs
    const sanitizedData = SecurityService.sanitizeSubmissionData({
      title: rawTitle,
      promptText: rawPromptText,
      description: rawDescription,
      outputSample: rawOutputSample,
      tags: rawTagsInput ? rawTagsInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : []
    });

    // Validate required fields after sanitization
    if (!sanitizedData.promptText) {
      console.error('Prompt text is required after sanitization');
      return;
    }
    
    // Use sanitized tags
    const tags = sanitizedData.tags;
    
    // Check if this is a challenge response
    let submissionType: 'workflow' | 'challenge_response' | 'remix' = 'workflow';
    let challengeBonus = false;
    
    try {
      const metadata = JSON.parse(view.private_metadata || '{}');
      if (metadata.challengeResponse) {
        submissionType = 'challenge_response';
        challengeBonus = true;
      }
    } catch (e) {
      // No metadata or invalid JSON, ignore
    }
    
    if (remixSelection && submissionType !== 'challenge_response') {
      submissionType = 'remix';
    }
    
    // Check for duplicates and similarity before creating submission
    const { SimilarityService } = await import('./services/similarityService');
    
    const duplicateCheck = await SimilarityService.checkForDuplicates(
      sanitizedData.promptText, 
      user.user_id
    );
    
    if (duplicateCheck.isDuplicate && duplicateCheck.action === 'reject') {
      // Send ephemeral message about duplicate detection
      await client.chat.postEphemeral({
        channel: body.user.id, // Send as DM
        user: body.user.id,
        text: `🚫 *Duplicate Content Detected*\n\nYour submission appears to be very similar to a previous submission.\n\n**Reason:** ${duplicateCheck.reasoning}\n\nPlease try submitting something more original to earn XP.`
      });
      return;
    }
    
    // Create submission with sanitized data
    const submission = await SubmissionService.createSubmission({
      authorId: user.user_id,
      title: sanitizedData.title || undefined,
      promptText: sanitizedData.promptText,
      description: sanitizedData.description || undefined,
      outputSample: sanitizedData.outputSample || undefined,
      tags: sanitizedData.tags,
      submissionType,
      parentSubmissionId: remixSelection ? parseInt(remixSelection) : undefined
    });
    
    // Record streak activity
    await SubmissionService.recordStreakActivity(user.user_id, 'submission');
    
    console.log('Submission created:', {
      submissionId: submission.submission_id,
      userId: user.user_id,
      type: submissionType
    });
    
    // Process similarity analysis and remix scoring for post-submission analysis
    let remixAnalysis = null;
    if (submissionType === 'remix' && remixSelection) {
      remixAnalysis = await SimilarityService.analyzeRemixQuality(
        submission.submission_id,
        parseInt(remixSelection)
      );
    }
    
    // Analyze prompt clarity and apply scoring
    let clarityAnalysis = null;
    try {
      const { ClarityService } = await import('./services/clarityService');
      clarityAnalysis = await ClarityService.analyzeSubmissionClarity(
        submission.submission_id,
        sanitizedData.promptText,
        {
          title: sanitizedData.title,
          description: sanitizedData.description,
          tags: sanitizedData.tags
        }
      );
      console.log('Clarity analysis completed:', {
        submissionId: submission.submission_id,
        clarityScore: clarityAnalysis.clarityScore
      });
    } catch (error) {
      console.error('Error analyzing clarity:', error);
      // Continue without clarity analysis if it fails
    }
    
    // Calculate XP using the comprehensive XP system
    const { XPService } = await import('./services/xpService');
    
    // Award base submission XP
    const xpResult = await XPService.awardXP({
      userId: user.user_id,
      eventType: 'SUBMISSION_BASE',
      submissionId: submission.submission_id,
      metadata: {
        submissionType,
        challengeResponse: challengeBonus,
        remixAnalysis: remixAnalysis || undefined,
        duplicateWarning: duplicateCheck.isDuplicate ? duplicateCheck.reasoning : undefined
      }
    });
    
    const xpEarned = xpResult.totalXP;
    
    // Check for badge achievements after XP award
    const { BadgeService } = await import('./services/badgeService');
    const newBadges = await BadgeService.checkAndAwardBadges(user.user_id);
    
    // Award XP bonuses for new badges
    for (const badge of newBadges) {
      const badgeDefinition = BadgeService.getBadgeDefinition(badge.id);
      if (badgeDefinition && badgeDefinition.xp_bonus > 0) {
        await XPService.awardXP({
          userId: user.user_id,
          eventType: 'SUBMISSION_BASE', // Use existing event type for now
          metadata: {
            badgeId: badge.id,
            badgeName: badgeDefinition.name,
            xpBonus: badgeDefinition.xp_bonus
          }
        });
      }
    }
    
    // Update Slack profile with latest badge
    if (newBadges.length > 0) {
      await BadgeService.updateSlackProfile(user.user_id, body.user.id);
    }
    
    // Build confirmation message with detailed XP breakdown
    const confirmationParts = [
      challengeBonus ? `🎯 *Challenge response submitted!* Your response has been added to the AI Games library.` : `🎉 *Awesome submission!* Your prompt has been added to the AI Games library.`,
      ``
    ];
    
    // Add XP breakdown
    confirmationParts.push(`💰 *XP Earned:* +${xpEarned} XP`);
    
    // Add XP breakdown details if available
    if (xpResult.breakdown && xpResult.breakdown.length > 0) {
      confirmationParts.push(`📊 *XP Breakdown:*`);
      xpResult.breakdown.forEach((item: any) => {
        confirmationParts.push(`• ${item.reason}: +${item.xp} XP`);
      });
    }
    
    // Add similarity analysis results
    if (duplicateCheck.isDuplicate && duplicateCheck.action === 'flag') {
      confirmationParts.push(`⚠️ *Similarity Notice:* ${duplicateCheck.reasoning}`);
    }
    
    if (remixAnalysis && remixAnalysis.improvementScore > 0) {
      confirmationParts.push(`🔄 *Remix Quality:* Your remix scored ${remixAnalysis.improvementScore}/10 for improvement!`);
    }
    
    // Add clarity analysis results
    if (clarityAnalysis) {
      const clarityEmoji = clarityAnalysis.clarityScore >= 8 ? '🟢' : 
                          clarityAnalysis.clarityScore >= 6 ? '🟡' : '🔴';
      confirmationParts.push(`${clarityEmoji} *Clarity Score:* ${clarityAnalysis.clarityScore}/10`);
      
      if (clarityAnalysis.xpImpact.clarityBonus !== 0) {
        const bonusText = clarityAnalysis.xpImpact.clarityBonus > 0 ? 'bonus' : 'adjustment';
        confirmationParts.push(`📊 *Clarity ${bonusText}:* ${clarityAnalysis.xpImpact.clarityBonus > 0 ? '+' : ''}${clarityAnalysis.xpImpact.clarityBonus} XP`);
      }
    }
    
    // Add badge notifications
    if (newBadges.length > 0) {
      confirmationParts.push(``, `🏆 *New Badge${newBadges.length > 1 ? 's' : ''}!*`);
      for (const badge of newBadges) {
        const badgeDefinition = BadgeService.getBadgeDefinition(badge.id);
        if (badgeDefinition) {
          const rarityEmoji = {
            'common': '🥉',
            'rare': '🥈', 
            'epic': '🥇',
            'legendary': '💎'
          }[badgeDefinition.rarity] || '🏅';
          confirmationParts.push(`${rarityEmoji} ${badgeDefinition.emoji} ${badgeDefinition.name} (+${badgeDefinition.xp_bonus} XP)`);
        }
      }
    }
    
    confirmationParts.push(``, `Check out your progress in the Home tab or use \`/stats\` to see your stats.`);
    
    // Complete onboarding step if this is first submission
    const { OnboardingService } = await import('./services/onboardingService');
    
    // Check if this is user's first submission
    const { count: submissionCount } = await supabaseAdmin
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', user.user_id);
    
    if ((submissionCount || 0) <= 1) {
      const onboardingResult = await OnboardingService.completeOnboardingStep(
        user.user_id, 
        'first_submission',
        { submissionId: submission.submission_id }
      );
      
      if (onboardingResult.success && onboardingResult.xpAwarded) {
        confirmationParts.push(`🎯 *Onboarding Step Complete!* First submission (+${onboardingResult.xpAwarded} XP)`);
      }
    }
    
    const confirmationText = confirmationParts.filter(Boolean).join('\n');
    
    await client.chat.postMessage({
      channel: body.user.id,
      text: confirmationText,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: confirmationText
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📊 View Home Tab'
              },
              action_id: 'view_home_tab',
              url: `slack://app?team=${body.team?.id}&id=${process.env.SLACK_APP_ID}&tab=home`
            }
          ]
        }
      ]
    });
    
  } catch (error) {
    console.error('Error handling submission:', error);
    
    // Send error message to user
    await client.chat.postMessage({
      channel: body.user.id,
      text: `❌ Sorry, there was an error processing your submission. Please try again or contact support.`
    });
  }
});

// Handle update preferences modal submission
app.view('update_preferences_modal', async ({ ack, body, view, client }) => {
  await ack();
  
  try {
    const { OnboardingService } = await import('./services/onboardingService');
    const { UserService } = await import('./services/userService');
    
    // Get user from database
    const user = await UserService.getUserBySlackId(body.user.id);
    if (!user) {
      await client.chat.postMessage({
        channel: body.user.id,
        text: '❌ User not found. Please contact support.'
      });
      return;
    }

    // Extract form values
    const streakDmsValues = view.state.values.streak_dms?.streak_dms_check?.selected_options || [];
    const weeklyDigestValues = view.state.values.weekly_digest?.weekly_digest_check?.selected_options || [];
    
    const preferences = {
      streak_dms: streakDmsValues.length > 0,
      weekly_digest: weeklyDigestValues.length > 0
    };

    // Update preferences
    const result = await OnboardingService.updateNotificationPreferences(user.user_id, preferences);
    
    if (result.success) {
      await client.chat.postMessage({
        channel: body.user.id,
        text: `✅ *Preferences Updated!*\n\n• Streak Reminders: ${preferences.streak_dms ? '✅ Enabled' : '❌ Disabled'}\n• Weekly Digest: ${preferences.weekly_digest ? '✅ Enabled' : '❌ Disabled'}\n\nYou can change these anytime with \`/preferences update\``
      });
    } else {
      await client.chat.postMessage({
        channel: body.user.id,
        text: `❌ Failed to update preferences: ${result.error || 'Unknown error'}. Please try again.`
      });
    }
    
  } catch (error) {
    console.error('Error handling preferences update:', error);
    
    await client.chat.postMessage({
      channel: body.user.id,
      text: '❌ Sorry, there was an error updating your preferences. Please try again later.'
    });
  }
});

// Handle 'Remix this' message shortcut
app.shortcut('remix_this_prompt', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const { SubmissionService } = await import('./services/submissionService');
    const { UserService } = await import('./services/userService');
    
    // Check if this is a message shortcut
    if (body.type !== 'message_action') {
      throw new Error('This shortcut only works on messages');
    }
    
    // Extract message details - now TypeScript knows this is a MessageShortcut
    const message = body.message;
    const messageText = message.text || '';
    const messageUser = message.user;
    const messageTs = message.ts;
    
    console.log('Remix shortcut triggered:', {
      messageText: messageText.substring(0, 100),
      messageUser,
      triggeredBy: body.user.id
    });
    
    // Try to find if this message corresponds to a submission
    // For now, we'll use the message text as the prompt to remix
    let originalSubmissionId: number | undefined;
    let originalPrompt = messageText;
    let originalTitle: string | undefined;
    
    // TODO: In a real implementation, you might store message_ts in submissions
    // or use message permalinks to track which messages are submissions
    
    // Get submissions for remix dropdown (for fallback)
    const user = await UserService.getUserBySlackId(body.user.id);
    const remixOptions = await SubmissionService.getSubmissionsForRemix(user?.user_id);
    
    const remixSelectOptions = remixOptions.map(sub => ({
      text: { type: 'plain_text' as const, text: sub.title },
      value: sub.id.toString()
    }));

    // Open the submit modal with pre-filled data
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'submit_prompt_modal',
        title: {
          type: 'plain_text',
          text: 'Remix This Prompt'
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🎵 *Remixing a prompt!*\n\nYou're creating a remix based on ${messageUser ? `<@${messageUser}>'s` : 'this'} message. Add your own spin to make it even better!`
            }
          },
          {
            type: 'divider'
          },
          {
            type: 'input',
            block_id: 'title_input',
            element: {
              type: 'plain_text_input',
              action_id: 'title_text',
              placeholder: {
                type: 'plain_text',
                text: 'Give your remix a catchy title...'
              },
              initial_value: originalTitle ? `${originalTitle} (Remix)` : ''
            },
            label: {
              type: 'plain_text',
              text: 'Title'
            },
            optional: true
          },
          {
            type: 'input',
            block_id: 'prompt_input',
            element: {
              type: 'plain_text_input',
              action_id: 'prompt_text',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Modify and improve the original prompt...'
              },
              initial_value: originalPrompt
            },
            label: {
              type: 'plain_text',
              text: 'Prompt/Workflow *'
            }
          },
          {
            type: 'input',
            block_id: 'description_input',
            element: {
              type: 'plain_text_input',
              action_id: 'description_text',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Describe what you changed or improved in your remix...'
              }
            },
            label: {
              type: 'plain_text',
              text: 'What did you improve?'
            },
            optional: true
          },
          {
            type: 'input',
            block_id: 'output_input',
            element: {
              type: 'plain_text_input',
              action_id: 'output_text',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Share an example output from your improved prompt...'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Example Output'
            },
            optional: true
          },
          {
            type: 'input',
            block_id: 'tags_input',
            element: {
              type: 'plain_text_input',
              action_id: 'tags_text',
              placeholder: {
                type: 'plain_text',
                text: 'e.g., remix, improved, creative'
              },
              initial_value: 'remix'
            },
            label: {
              type: 'plain_text',
              text: 'Tags (comma-separated)'
            },
            optional: true
          },
          ...(remixSelectOptions.length > 0 ? [{
            type: 'input' as const,
            block_id: 'remix_input',
            element: {
              type: 'static_select' as const,
              action_id: 'remix_selection',
              placeholder: {
                type: 'plain_text' as const,
                text: 'Link to original submission (optional)...'
              },
              options: remixSelectOptions.slice(0, 100),
              ...(originalSubmissionId ? { initial_option: {
                text: { type: 'plain_text' as const, text: originalTitle || 'Original Submission' },
                value: originalSubmissionId.toString()
              }} : {})
            },
            label: {
              type: 'plain_text' as const,
              text: 'Original Submission (Optional)'
            },
            optional: true
          }] : []),
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `💡 *Remix Tip:* Great remixes build on the original by adding clarity, specificity, or creative improvements. Share what makes your version special!`
              }
            ]
          }
        ],
        submit: {
          type: 'plain_text',
          text: 'Submit Remix'
        }
      }
    });
    
  } catch (error) {
    console.error('Error handling remix shortcut:', error);
    
    // Send error message to user
    const channelId = body.type === 'message_action' ? body.channel.id : body.user.id;
    await client.chat.postEphemeral({
      channel: channelId,
      user: body.user.id,
      text: `❌ Sorry, there was an error setting up the remix. Please try using \`/submit\` directly.`
    });
  }
});

// Handle button actions for challenge responses
app.action('submit_challenge_response', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const { ChallengeService } = await import('./services/challengeService');
    
    // Get current challenge
    const currentChallenge = await ChallengeService.getCurrentWeekChallenge();
    
    if (!currentChallenge) {
      await client.chat.postEphemeral({
        channel: body.channel?.id || body.user.id,
        user: body.user.id,
        text: '❌ No active challenge found. Check back on Monday for the new weekly challenge!'
      });
      return;
    }

    // Open the submit modal pre-configured for challenge response
    await client.views.open({
      trigger_id: (body as any).trigger_id,
      view: {
        type: 'modal',
        callback_id: 'submit_prompt_modal',
        private_metadata: JSON.stringify({ 
          challengeResponse: true, 
          seedPromptId: currentChallenge.seed_prompt_id 
        }),
        title: {
          type: 'plain_text',
          text: 'Challenge Response'
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🎯 *Week ${currentChallenge.week_number} Challenge Response*\n\n*Prompt:* ${currentChallenge.prompt_text}`
            }
          },
          {
            type: 'divider'
          },
          {
            type: 'input',
            block_id: 'title_input',
            element: {
              type: 'plain_text_input',
              action_id: 'title_text',
              placeholder: {
                type: 'plain_text',
                text: 'Give your response a title...'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Response Title'
            },
            optional: true
          },
          {
            type: 'input',
            block_id: 'prompt_input',
            element: {
              type: 'plain_text_input',
              action_id: 'prompt_text',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Share your response to this week\'s challenge...'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Your Response *'
            }
          },
          {
            type: 'input',
            block_id: 'description_input',
            element: {
              type: 'plain_text_input',
              action_id: 'description_text',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Explain your approach or reasoning...'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Explanation'
            },
            optional: true
          },
          {
            type: 'input',
            block_id: 'output_input',
            element: {
              type: 'plain_text_input',
              action_id: 'output_text',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Share example output or results...'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Example Output'
            },
            optional: true
          }
        ],
        submit: {
          type: 'plain_text',
          text: 'Submit Response'
        }
      }
    });

  } catch (error) {
    console.error('Error handling challenge response button:', error);
  }
});

// Handle view_full_leaderboard button action
app.action('view_full_leaderboard', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const { LeaderboardService } = await import('./services/leaderboardService');
    
    // Get leaderboard data
    const leaderboard = await LeaderboardService.getGlobalLeaderboard(15);
    const blocks = LeaderboardService.formatLeaderboardForSlack(
      leaderboard,
      '🏆 Full AI Games Leaderboard',
      body.user.id
    );

    // Send as ephemeral message
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: '🏆 Full AI Games Leaderboard',
      blocks
    });
    
  } catch (error) {
    console.error('Error handling view_full_leaderboard action:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: '❌ Sorry, there was an error fetching the leaderboard. Please try again later.'
    });
  }
});

// Handle view_challenge_leaderboard button action
app.action('view_challenge_leaderboard', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const { ChallengeService } = await import('./services/challengeService');
    const { LeaderboardService } = await import('./services/leaderboardService');
    
    // Get current challenge
    const currentChallenge = await ChallengeService.getCurrentWeekChallenge();
    
    if (!currentChallenge) {
      await client.chat.postEphemeral({
        channel: body.channel?.id || body.user.id,
        user: body.user.id,
        text: '❌ No active challenge found. Check back on Monday for the new weekly challenge!'
      });
      return;
    }

    // For now, show global leaderboard with challenge context
    // TODO: Implement challenge-specific leaderboard once challenge submissions are tracked
    const leaderboard = await LeaderboardService.getGlobalLeaderboard(10);
    const blocks = LeaderboardService.formatLeaderboardForSlack(
      leaderboard,
      `🎯 Week ${currentChallenge.week_number} Challenge Leaderboard`,
      body.user.id
    );

    // Add challenge context at the top
    blocks.splice(1, 0, {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Current Challenge:* ${currentChallenge.prompt_text.substring(0, 100)}${currentChallenge.prompt_text.length > 100 ? '...' : ''}`
      }
    });

    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: `🎯 Week ${currentChallenge.week_number} Challenge Leaderboard`,
      blocks
    });
    
  } catch (error) {
    console.error('Error handling view_challenge_leaderboard action:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: '❌ Sorry, there was an error fetching the challenge leaderboard. Please try again later.'
    });
  }
});

// Handle trigger_submit_command button action
app.action('trigger_submit_command', async ({ ack, body, client }) => {
  await ack();
  
  try {
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: '🚀 Use the `/submit` command to submit your first prompt and start earning XP!'
    });
  } catch (error) {
    console.error('Error handling trigger_submit_command action:', error);
  }
});

// Handle view_full_status button action
app.action('view_full_status', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const { LeaderboardService } = await import('./services/leaderboardService');
    const { AnalyticsService } = await import('./services/analyticsService');
    
    // Get user ranking and analytics
    const ranking = await LeaderboardService.getUserRanking(body.user.id);
    const analytics = await AnalyticsService.getUserAnalytics(body.user.id);
    
    if (!ranking || !analytics) {
      await client.chat.postEphemeral({
        channel: body.channel?.id || body.user.id,
        user: body.user.id,
        text: '🎮 *Welcome to AI Games!*\n\nYou haven\'t submitted any prompts yet. Use `/submit` to get started and earn your first XP!'
      });
      return;
    }

    // Combine ranking and analytics blocks
    const rankingBlocks = LeaderboardService.formatUserRankingForSlack(ranking);
    const analyticsBlocks = AnalyticsService.formatAnalyticsForSlack(analytics);
    
    const combinedBlocks = [
      ...rankingBlocks,
      { type: 'divider' },
      ...analyticsBlocks
    ];
    
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: `📊 Your AI Games Status & Analytics`,
      blocks: combinedBlocks
    });
    
  } catch (error) {
    console.error('Error handling view_full_status action:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: '❌ Sorry, there was an error fetching your status. Please try again later.'
    });
  }
});

// Handle view_full_analytics button action
app.action('view_full_analytics', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const { AnalyticsService } = await import('./services/analyticsService');
    
    // Get user analytics
    const analytics = await AnalyticsService.getUserAnalytics(body.user.id);
    
    if (!analytics) {
      await client.chat.postEphemeral({
        channel: body.channel?.id || body.user.id,
        user: body.user.id,
        text: '🎮 *Welcome to AI Games!*\n\nYou haven\'t submitted any prompts yet. Use `/submit` to get started and see your analytics!'
      });
      return;
    }

    const blocks = AnalyticsService.formatAnalyticsForSlack(analytics);
    
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: `📊 Your Advanced Analytics`,
      blocks
    });
    
  } catch (error) {
    console.error('Error handling view_full_analytics action:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: '❌ Sorry, there was an error fetching your analytics. Please try again later.'
    });
  }
});

// Handle view_streak_status button action
app.action('view_streak_status', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const { StreakService } = await import('./services/streakService');
    const { UserService } = await import('./services/userService');
    
    // Get user by Slack ID
    const user = await UserService.getUserBySlackId(body.user.id);
    
    if (!user) {
      await client.chat.postEphemeral({
        channel: body.channel?.id || body.user.id,
        user: body.user.id,
        text: '🎮 *Welcome to AI Games!*\n\nYou haven\'t submitted any prompts yet. Use `/submit` to get started and start your streak!'
      });
      return;
    }

    // Get user's streak data
    const streakData = await StreakService.calculateUserStreak(user.user_id);
    const streakBlocks = StreakService.formatStreakForSlack(streakData);
    
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: `🔥 Your Streak Status`,
      blocks: streakBlocks
    });
    
  } catch (error) {
    console.error('Error handling view_streak_status action:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: '❌ Sorry, there was an error fetching your streak data. Please try again later.'
    });
  }
});

// Handle view_detailed_status button action
app.action('view_detailed_status', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const { StatusService } = await import('./services/statusService');
    const blocks = await StatusService.formatComprehensiveStatus(body.user.id);
    
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: '📊 Your Complete AI Games Status',
      blocks
    });
    
  } catch (error) {
    console.error('Error handling view_detailed_status action:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: '❌ Sorry, there was an error fetching your detailed status. Please try again later.'
    });
  }
});

// Handle view_xp_breakdown button action
app.action('view_xp_breakdown', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const { StatusService } = await import('./services/statusService');
    const blocks = await StatusService.formatDrillDownView(body.user.id, 'xp_breakdown');
    
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: '💰 Detailed XP Breakdown',
      blocks
    });
    
  } catch (error) {
    console.error('Error handling view_xp_breakdown action:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: '❌ Sorry, there was an error fetching your XP breakdown. Please try again later.'
    });
  }
});

// Handle view_home_tab button action
app.action('view_home_tab', async ({ ack, body, client }) => {
  await ack();
  
  try {
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: '🏠 Click on the "Home" tab in this app to view your personalized dashboard!'
    });
  } catch (error) {
    console.error('Error handling view_home_tab action:', error);
  }
});

// Handle view_user_badges button action
app.action('view_user_badges', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const { BadgeService } = await import('./services/badgeService');
    const { UserService } = await import('./services/userService');
    
    // Get user by Slack ID
    const user = await UserService.getUserBySlackId(body.user.id);
    
    if (!user) {
      await client.chat.postEphemeral({
        channel: body.channel?.id || body.user.id,
        user: body.user.id,
        text: '🎮 *Welcome to AI Games!*\n\nYou haven\'t submitted any prompts yet. Use `/submit` to get started and start earning badges!'
      });
      return;
    }

    // Get user's badges and progress
    const userBadges = await BadgeService.getUserBadges(user.user_id);
    const badgeProgress = await BadgeService.getBadgeProgress(user.user_id);
    
    // Convert progress to the expected format
    const availableBadges = badgeProgress.map(progress => {
      const definition = BadgeService.getBadgeDefinition(progress.badge_id);
      return {
        ...definition!,
        progress: progress.current_progress,
        progressText: `${progress.current_progress}/${progress.required_progress}`
      };
    });
    
    const blocks = BadgeService.formatBadgesForSlack(userBadges, availableBadges, true);
    
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: `🏆 Your Badge Collection`,
      blocks
    });
    
  } catch (error) {
    console.error('Error handling view_user_badges action:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: '❌ Sorry, there was an error fetching your badges. Please try again later.'
    });
  }
});

// Handle /badges slash command
app.command('/badges', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const { BadgeService } = await import('./services/badgeService');
    const { UserService } = await import('./services/userService');
    
    // Get user by Slack ID
    const user = await UserService.getUserBySlackId(body.user_id);
    
    if (!user) {
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '🎮 *Welcome to AI Games!*\n\nYou haven\'t submitted any prompts yet. Use `/submit` to get started and start earning badges!',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '🎮 *Welcome to AI Games!*\n\nYou haven\'t submitted any prompts yet. Use `/submit` to get started and start earning badges!'
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '🚀 Submit First Prompt'
                },
                action_id: 'trigger_submit_command'
              }
            ]
          }
        ]
      });
      return;
    }

    // Get user's badges and progress
    const userBadges = await BadgeService.getUserBadges(user.user_id);
    const badgeProgress = await BadgeService.getBadgeProgress(user.user_id);
    
    // Convert progress to the expected format
    const availableBadges = badgeProgress.map(progress => {
      const definition = BadgeService.getBadgeDefinition(progress.badge_id);
      return {
        ...definition!,
        progress: progress.current_progress,
        progressText: `${progress.current_progress}/${progress.required_progress}`
      };
    });
    
    const blocks = BadgeService.formatBadgesForSlack(userBadges, availableBadges, true);
    
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: `🏆 Your Badge Collection`,
      blocks
    });
    
  } catch (error) {
    console.error('Error handling /badges command:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: '❌ Sorry, there was an error fetching your badges. Please try again later.'
    });
  }
});

// Handle /comments slash command (admin only)
app.command('/comments', async ({ ack, body, client }) => {
  await ack();
  
  try {
    // Security: Check if user is admin
    if (!SecurityService.isAdmin(body.user_id)) {
      await SecurityService.logSecurityEvent({
        slackUserId: body.user_id,
        eventType: 'admin_action',
        description: 'Unauthorized admin command attempt: /comments',
        riskLevel: 'medium',
        metadata: { command: '/comments', channel: body.channel_id }
      });

      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '❌ This command is only available to administrators.'
      });
      return;
    }
    
    const { CommentService } = await import('./services/commentService');
    const rawArgs = (body.text || '').trim().split(' ');
    const command = rawArgs[0]?.toLowerCase() || '';
    
    // Security: Validate admin command
    const validation = SecurityService.validateAdminCommand(command, rawArgs.slice(1));
    if (!validation.isValid) {
      await SecurityService.logSecurityEvent({
        slackUserId: body.user_id,
        eventType: 'admin_action',
        description: `Invalid admin command: ${validation.errors.join(', ')}`,
        riskLevel: 'low',
        metadata: { command, args: rawArgs, errors: validation.errors }
      });

      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: `❌ Invalid command: ${validation.errors.join(', ')}`
      });
      return;
    }

    const args = validation.sanitizedArgs;
    
    if (command === 'analyze' && args[1]) {
      // Analyze a specific comment
      const commentId = parseInt(args[1]);
      if (isNaN(commentId)) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: '❌ Please provide a valid comment ID: `/comments analyze <comment_id>`'
        });
        return;
      }
      
      const analysis = await CommentService.reanalyzeComment(commentId);
      
      if (!analysis) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: '❌ Failed to analyze comment. Please check the comment ID.'
        });
        return;
      }
      
      const blocks = CommentService.formatAnalysisForSlack(analysis);
      
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: `🔍 Comment Analysis for ID ${commentId}`,
        blocks
      });
      
    } else if (command === 'stats') {
      // Show comment analysis statistics
      const stats = await CommentService.getCommentAnalysisStats();
      
      const statsText = `📊 *Comment Analysis Statistics (Last 30 days)*

📝 **Total Comments:** ${stats.totalComments}
✅ **Helpful Comments:** ${stats.helpfulComments} (${stats.totalComments > 0 ? Math.round((stats.helpfulComments / stats.totalComments) * 100) : 0}%)
🤖 **Auto-Detected Helpful:** ${stats.autoDetectedHelpful}
📈 **Average Helpfulness Score:** ${stats.averageHelpfulnessScore}/100

🔍 The LLM Comment Judge automatically analyzes all comments for helpfulness and awards XP accordingly.`;

      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: statsText
      });
      
    } else {
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: `💬 *Comment Admin Commands*\n\n• \`/comments analyze <comment_id>\` - Re-analyze comment helpfulness\n• \`/comments stats\` - Show analysis statistics\n\n🤖 The system automatically analyzes all new comments using LLM and awards XP for helpful contributions.`
      });
    }
    
  } catch (error) {
    console.error('Error handling /comments command:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: '❌ Sorry, there was an error with the comments command. Please try again later.'
    });
  }
});

// Handle /similarity slash command (admin only)
app.command('/similarity', async ({ ack, body, client }) => {
  await ack();
  
  try {
    // Security: Check if user is admin
    if (!SecurityService.isAdmin(body.user_id)) {
      await SecurityService.logSecurityEvent({
        slackUserId: body.user_id,
        eventType: 'admin_action',
        description: 'Unauthorized admin command attempt: /similarity',
        riskLevel: 'medium',
        metadata: { command: '/similarity', channel: body.channel_id }
      });

      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '❌ This command is only available to administrators.'
      });
      return;
    }
    
    const { SimilarityService } = await import('./services/similarityService');
    const args = (body.text || '').trim().split(' ');
    const command = args[0]?.toLowerCase();
    
    if (command === 'check' && args[1]) {
      // Check similarity for a specific submission ID
      const submissionId = parseInt(args[1]);
      if (isNaN(submissionId)) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: '❌ Please provide a valid submission ID: `/similarity check <submission_id>`'
        });
        return;
      }
      
      const similarSubmissions = await SimilarityService.findSimilarSubmissions(submissionId, 0.7);
      
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: `🔍 *Similarity Analysis for Submission ${submissionId}*\n\n${similarSubmissions.map((item: any) => 
          `• vs #${item.targetSubmissionId}: ${(item.similarityScore * 100).toFixed(1)}% similar (${item.similarityType})`
        ).join('\n') || 'No similar submissions found.'}`
      });
      
    } else if (command === 'stats') {
      // Show similarity detection stats
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: `📊 *Similarity Detection Stats*\n\n🔍 Service active and monitoring submissions\n📝 Commands:\n• \`/similarity check <id>\` - Analyze specific submission\n• \`/similarity stats\` - Show this info`
      });
      
    } else {
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: `🔍 *Similarity Admin Commands*\n\n• \`/similarity check <submission_id>\` - Analyze submission similarity\n• \`/similarity stats\` - Show detection statistics`
      });
    }
    
  } catch (error) {
    console.error('Error handling /similarity command:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: '❌ Sorry, there was an error with the similarity command. Please try again later.'
    });
  }
});

// Handle /clarity slash command (admin only)
app.command('/clarity', async ({ ack, body, client }) => {
  await ack();
  
  try {
    // Security: Check if user is admin
    if (!SecurityService.isAdmin(body.user_id)) {
      await SecurityService.logSecurityEvent({
        slackUserId: body.user_id,
        eventType: 'admin_action',
        description: 'Unauthorized admin command attempt: /clarity',
        riskLevel: 'medium',
        metadata: { command: '/clarity', channel: body.channel_id }
      });

      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '❌ This command is only available to administrators.'
      });
      return;
    }
    
    const { ClarityService } = await import('./services/clarityService');
    const args = (body.text || '').trim().split(' ');
    const command = args[0]?.toLowerCase();
    
    if (command === 'analyze' && args[1]) {
      // Re-analyze a specific submission
      const submissionId = parseInt(args[1]);
      if (isNaN(submissionId)) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: '❌ Please provide a valid submission ID: `/clarity analyze <submission_id>`'
        });
        return;
      }
      
      const analysis = await ClarityService.reanalyzeClarityScore(submissionId);
      
      if (!analysis) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: '❌ Failed to analyze submission. Please check the submission ID.'
        });
        return;
      }
      
      const blocks = ClarityService.formatClarityForSlack(analysis.analysis);
      
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: `🔍 Clarity Analysis for Submission ${submissionId}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🔍 *Clarity Analysis for Submission ${submissionId}*\n\n📊 **Score:** ${analysis.clarityScore}/10\n💰 **XP Impact:** ${analysis.xpImpact.clarityBonus > 0 ? '+' : ''}${analysis.xpImpact.clarityBonus} XP`
            }
          },
          ...blocks
        ]
      });
      
    } else if (command === 'stats') {
      // Show clarity analysis statistics
      const stats = await ClarityService.getClarityStats();
      
      const statsText = `📊 *Clarity Analysis Statistics (Last 30 days)*

📝 **Total Analyzed:** ${stats.totalAnalyzed}
📈 **Average Score:** ${stats.averageScore}/10
🟢 **High Quality (7+):** ${stats.highQualityCount} (${stats.totalAnalyzed > 0 ? Math.round((stats.highQualityCount / stats.totalAnalyzed) * 100) : 0}%)
🔴 **Low Quality (≤4):** ${stats.lowQualityCount} (${stats.totalAnalyzed > 0 ? Math.round((stats.lowQualityCount / stats.totalAnalyzed) * 100) : 0}%)

📊 **Score Distribution:**
${stats.distributionByScore.map(d => `Score ${d.score}: ${d.count} submissions`).join('\n')}

🔍 The LLM Clarity Scorer automatically analyzes all submissions for prompt quality and awards XP accordingly.`;

      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: statsText
      });
      
    } else {
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: `🔍 *Clarity Admin Commands*\n\n• \`/clarity analyze <submission_id>\` - Re-analyze submission clarity\n• \`/clarity stats\` - Show analysis statistics\n\n🤖 The system automatically analyzes all new submissions using LLM and awards XP based on prompt clarity and quality.`
      });
    }
    
  } catch (error) {
    console.error('Error handling /clarity command:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: '❌ Sorry, there was an error with the clarity command. Please try again later.'
    });
  }
});

// Handle /library slash command
app.command('/library', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const { PromptLibraryService } = await import('./services/promptLibraryService');
    const { UserService } = await import('./services/userService');
    
    const args = (body.text || '').trim().split(' ');
    const command = args[0]?.toLowerCase();
    
    // Get user for personalization
    const user = await UserService.getUserBySlackId(body.user_id);
    
    if (command === 'search' || command === 's') {
      // Handle search command: /library search [query]
      const query = args.slice(1).join(' ');
      
      if (!query || query.length < 2) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: '🔍 Please provide a search query: `/library search <your query>`\n\nExample: `/library search writing prompts for emails`'
        });
        return;
      }
      
      const searchResult = await PromptLibraryService.searchLibraryItems(
        { query, sortBy: 'quality' },
        1,
        10,
        user?.user_id
      );
      
      if (searchResult.items.length === 0) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: `🔍 No prompts found for "${query}"\n\nTry different keywords or browse by category with \`/library browse\``
        });
        return;
      }
      
      const blocks = PromptLibraryService.formatLibraryItemsForSlack(
        searchResult.items,
        `🔍 *Search Results for "${query}"* (${searchResult.total} found)`,
        true
      );
      
      // Add pagination controls if needed
      if (searchResult.hasMore) {
        blocks.push({
          type: 'context',
          elements: [{
            type: 'mrkdwn',
            text: `📄 Showing first ${searchResult.items.length} of ${searchResult.total} results. Use filters for more specific search.`
          }]
        });
      }
      
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: `🔍 Search Results for "${query}"`,
        blocks
      });
      
    } else if (command === 'browse' || command === 'b') {
      // Handle browse command: /library browse [category]
      const category = args[1]?.toLowerCase();
      
      if (category) {
        // Browse specific category
        const searchResult = await PromptLibraryService.searchLibraryItems(
          { category, sortBy: 'quality' },
          1,
          10,
          user?.user_id
        );
        
        if (searchResult.items.length === 0) {
          await client.chat.postEphemeral({
            channel: body.channel_id,
            user: body.user_id,
            text: `📂 No prompts found in category "${category}"\n\nAvailable categories: writing, coding, business, research, creative`
          });
          return;
        }
        
        const blocks = PromptLibraryService.formatLibraryItemsForSlack(
          searchResult.items,
          `📂 *${category.charAt(0).toUpperCase() + category.slice(1)} Prompts* (${searchResult.total} found)`,
          true
        );
        
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: `📂 ${category.charAt(0).toUpperCase() + category.slice(1)} Prompts`,
          blocks
        });
      } else {
        // Show category browser
        const stats = await PromptLibraryService.getLibraryStats();
        
        const blocks = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `📚 *AI Games Prompt Library*\n\n${stats.totalItems} curated prompts across ${stats.categoryCounts.length} categories`
            }
          },
          {
            type: 'divider'
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*📂 Browse by Category:*'
            }
          }
        ];
        
        // Add category buttons
        const categoryButtons: any[] = [];
        stats.categoryCounts.slice(0, 5).forEach(cat => {
          const emoji = {
            'writing': '✍️',
            'coding': '💻', 
            'business': '💼',
            'research': '🔬',
            'creative': '🎨'
          }[cat.category] || '📝';
          
          categoryButtons.push({
            type: 'button',
            text: {
              type: 'plain_text',
              text: `${emoji} ${cat.category} (${cat.count})`
            },
            action_id: `browse_category_${cat.category}`,
            value: cat.category
          });
        });
        
        blocks.push({
          type: 'actions',
          elements: categoryButtons
        } as any);
        
        blocks.push(
          {
            type: 'divider'
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*💡 Quick Commands:*\n• `/library search <query>` - Search prompts\n• `/library browse <category>` - Browse category\n• `/library favorites` - Your favorites\n• `/library featured` - Featured prompts'
            }
          }
        );
        
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: '📚 AI Games Prompt Library',
          blocks
        });
      }
      
    } else if (command === 'favorites' || command === 'fav') {
      // Show user's favorites
      if (!user) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: '🎮 Welcome to AI Games! Submit your first prompt with `/submit` to start using the library.'
        });
        return;
      }
      
      const favorites = await PromptLibraryService.getUserFavorites(user.user_id, 1, 10);
      
      if (favorites.items.length === 0) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: '⭐ You haven\'t favorited any prompts yet!\n\nBrowse the library and click the ⭐ button on prompts you like.'
        });
        return;
      }
      
      const blocks = PromptLibraryService.formatLibraryItemsForSlack(
        favorites.items,
        `⭐ *Your Favorite Prompts* (${favorites.total} total)`,
        true
      );
      
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '⭐ Your Favorite Prompts',
        blocks
      });
      
    } else if (command === 'featured' || command === 'f') {
      // Show featured prompts
      const searchResult = await PromptLibraryService.searchLibraryItems(
        { featured: true, sortBy: 'quality' },
        1,
        10,
        user?.user_id
      );
      
      if (searchResult.items.length === 0) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: '🌟 No featured prompts available yet. Check back soon!'
        });
        return;
      }
      
      const blocks = PromptLibraryService.formatLibraryItemsForSlack(
        searchResult.items,
        `🌟 *Featured Prompts* (${searchResult.total} total)`,
        true
      );
      
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '🌟 Featured Prompts',
        blocks
      });
      
    } else {
      // Default library overview
      const stats = await PromptLibraryService.getLibraryStats();
      const collections = await PromptLibraryService.getCollections(false, undefined, true);
      
      const blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `📚 *AI Games Prompt Library*\n\n✨ ${stats.totalItems} curated prompts\n📁 ${stats.totalCollections} collections\n🌟 ${stats.featuredItems} featured\n✅ ${stats.verifiedItems} verified`
          }
        },
        {
          type: 'divider'
        }
      ];
      
      // Add featured collections
      if (collections.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*🌟 Featured Collections:*'
          }
        });
        
        collections.slice(0, 3).forEach(collection => {
          blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `📁 *${collection.name}*\n${collection.description || 'Curated collection of quality prompts'}`
            },
            accessory: {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '👁️ View'
              },
              action_id: `view_collection_${collection.collection_id}`,
              value: collection.collection_id.toString()
            }
          } as any);
        });
        
        blocks.push({
          type: 'divider'
        });
      }
      
      // Add recent items
      if (stats.recentItems.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*🆕 Recently Added:*\n${stats.recentItems.slice(0, 3).map(item => 
              `• ${item.title} (${item.category})`
            ).join('\n')}`
          }
        });
      }
      
      blocks.push(
        {
          type: 'divider'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*💡 Commands:*\n• `/library search <query>` - Search prompts\n• `/library browse` - Browse categories\n• `/library favorites` - Your favorites\n• `/library featured` - Featured prompts'
          }
        }
      );
      
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '📚 AI Games Prompt Library',
        blocks
      });
    }
    
  } catch (error) {
    console.error('Error handling /library command:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: '❌ Sorry, there was an error accessing the library. Please try again later.'
    });
  }
});

// Handle library item view button actions
app.action(/^view_library_item_(\d+)$/, async ({ ack, body, client }) => {
  await ack();
  
  try {
    const itemId = parseInt((body as any).actions[0].value);
    const { PromptLibraryService } = await import('./services/promptLibraryService');
    const { UserService } = await import('./services/userService');
    
    // Get user for personalization
    const user = await UserService.getUserBySlackId(body.user.id);
    
    // Get library item details
    const item = await PromptLibraryService.getLibraryItem(itemId, user?.user_id);
    
    if (!item || !item.submission) {
      await client.chat.postEphemeral({
        channel: body.channel?.id || body.user.id,
        user: body.user.id,
        text: '❌ Library item not found or no longer available.'
      });
      return;
    }
    
    const difficultyEmoji = {
      'beginner': '🟢',
      'intermediate': '🟡', 
      'advanced': '🔴'
    }[item.difficulty_level] || '⚪';
    
    const categoryEmoji = {
      'writing': '✍️',
      'coding': '💻',
      'business': '💼',
      'research': '🔬',
      'creative': '🎨'
    }[item.category] || '📝';
    
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${categoryEmoji} *${item.title}*\n\n${difficultyEmoji} ${item.difficulty_level.charAt(0).toUpperCase() + item.difficulty_level.slice(1)} level`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*📝 Prompt:*\n\`\`\`${item.submission.prompt_text}\`\`\``
        }
      }
    ];
    
    if (item.description) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*📖 Description:*\n${item.description}`
        }
      });
    }
    
    if (item.submission.output_sample) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*💡 Example Output:*\n${item.submission.output_sample.substring(0, 500)}${item.submission.output_sample.length > 500 ? '...' : ''}`
        }
      });
    }
    
    // Add metadata
    const metadataFields = [];
    
    if (item.quality_score) {
      const stars = '⭐'.repeat(Math.floor(item.quality_score / 2));
      metadataFields.push({
        type: 'mrkdwn',
        text: `*Quality:*\n${stars} ${item.quality_score}/10`
      });
    }
    
    if (item.usage_count > 0) {
      metadataFields.push({
        type: 'mrkdwn',
        text: `*Usage:*\n${item.usage_count} times`
      });
    }
    
    if ((item.submission as any).author) {
      const author = (item.submission as any).author;
      metadataFields.push({
        type: 'mrkdwn',
        text: `*Author:*\n${author.display_name || author.slack_id}`
      });
    }
    
    if (item.use_case_tags.length > 0) {
      metadataFields.push({
        type: 'mrkdwn',
        text: `*Tags:*\n${item.use_case_tags.join(', ')}`
      });
    }
    
    if (metadataFields.length > 0) {
      blocks.push({
        type: 'section',
        fields: metadataFields
      } as any);
    }
    
    // Add action buttons
    const actionButtons: any[] = [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: item.is_favorited ? '⭐ Favorited' : '⭐ Favorite'
        },
        action_id: `toggle_favorite_${itemId}`,
        value: itemId.toString(),
        style: item.is_favorited ? 'primary' : undefined
      },
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '📋 Copy Prompt'
        },
        action_id: `copy_prompt_${itemId}`,
        value: itemId.toString()
      }
    ];
    
    blocks.push({
      type: 'actions',
      elements: actionButtons
    } as any);
    
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: `📝 ${item.title}`,
      blocks
    });
    
  } catch (error) {
    console.error('Error handling view library item action:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: '❌ Sorry, there was an error viewing this library item.'
    });
  }
});

// Handle favorite toggle button actions
app.action(/^toggle_favorite_(\d+)$/, async ({ ack, body, client }) => {
  await ack();
  
  try {
    const itemId = parseInt((body as any).actions[0].value);
    const { PromptLibraryService } = await import('./services/promptLibraryService');
    const { UserService } = await import('./services/userService');
    
    // Get user
    const user = await UserService.getUserBySlackId(body.user.id);
    
    if (!user) {
      await client.chat.postEphemeral({
        channel: body.channel?.id || body.user.id,
        user: body.user.id,
        text: '🎮 Welcome to AI Games! Submit your first prompt with `/submit` to start using favorites.'
      });
      return;
    }
    
    // Toggle favorite
    const isFavorited = await PromptLibraryService.toggleFavorite(user.user_id, itemId);
    
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: isFavorited ? 
        '⭐ Added to your favorites!' : 
        '💫 Removed from favorites.'
    });
    
  } catch (error) {
    console.error('Error toggling favorite:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: '❌ Sorry, there was an error updating your favorites.'
    });
  }
});

// Handle copy prompt button actions
app.action(/^copy_prompt_(\d+)$/, async ({ ack, body, client }) => {
  await ack();
  
  try {
    const itemId = parseInt((body as any).actions[0].value);
    const { PromptLibraryService } = await import('./services/promptLibraryService');
    const { UserService } = await import('./services/userService');
    
    // Get user for analytics
    const user = await UserService.getUserBySlackId(body.user.id);
    
    // Get library item
    const item = await PromptLibraryService.getLibraryItem(itemId, user?.user_id);
    
    if (!item || !item.submission) {
      await client.chat.postEphemeral({
        channel: body.channel?.id || body.user.id,
        user: body.user.id,
        text: '❌ Library item not found.'
      });
      return;
    }
    
    // Record copy analytics
    if (user) {
      await PromptLibraryService.recordUsageAnalytics(itemId, user.user_id, 'copy', 'button');
    }
    
    // Send prompt text as copyable message
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: `📋 *Copied: ${item.title}*\n\n\`\`\`${item.submission.prompt_text}\`\`\`\n\n💡 You can now copy this text and use it in your AI tools!`
    });
    
  } catch (error) {
    console.error('Error copying prompt:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: '❌ Sorry, there was an error copying the prompt.'
    });
  }
});

// Handle /privacy slash command (admin only)
app.command('/privacy', async ({ ack, body, client }) => {
  await ack();
  
  try {
    // Security: Check if user is admin
    if (!SecurityService.isAdmin(body.user_id)) {
      await SecurityService.logSecurityEvent({
        slackUserId: body.user_id,
        eventType: 'admin_action',
        description: 'Unauthorized admin command attempt: /privacy',
        riskLevel: 'medium',
        metadata: { command: '/privacy', channel: body.channel_id }
      });

      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '❌ This command is only available to administrators.'
      });
      return;
    }

    const { PrivacyService } = await import('./services/privacyService');
    const { UserService } = await import('./services/userService');
    
    const rawArgs = (body.text || '').trim().split(' ');
    const command = rawArgs[0]?.toLowerCase() || '';
    
    // Security: Validate admin command
    const allowedPrivacyCommands = ['export', 'delete', 'anonymize', 'summary'];
    if (command && !allowedPrivacyCommands.includes(command)) {
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: `❌ Invalid privacy command. Available: ${allowedPrivacyCommands.join(', ')}`
      });
      return;
    }

    if (command === 'export' && rawArgs[1]) {
      // Export user data
      const targetSlackId = SecurityService.sanitizeText(rawArgs[1]);
      const targetUser = await UserService.getUserBySlackId(targetSlackId);
      
      if (!targetUser) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: '❌ User not found.'
        });
        return;
      }

      const exportResult = await PrivacyService.exportUserData(targetUser.user_id);
      
      if (exportResult.success) {
        // In a real implementation, you'd send this securely
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: `✅ *Data Export Complete*\n\nExported data for user ${targetSlackId}:\n\`\`\`${JSON.stringify(exportResult.data, null, 2).substring(0, 2000)}...\`\`\`\n\n⚠️ *Note: In production, this would be sent via secure download link.*`
        });

        await SecurityService.logSecurityEvent({
          userId: targetUser.user_id,
          slackUserId: body.user_id,
          eventType: 'admin_action',
          description: `Data export completed for user ${targetSlackId}`,
          riskLevel: 'medium',
          metadata: { targetUser: targetSlackId, action: 'export' }
        });
      } else {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: `❌ Export failed: ${exportResult.error}`
        });
      }

    } else if (command === 'delete' && rawArgs[1]) {
      // Delete user data (GDPR)
      const targetSlackId = SecurityService.sanitizeText(rawArgs[1]);
      const targetUser = await UserService.getUserBySlackId(targetSlackId);
      
      if (!targetUser) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: '❌ User not found.'
        });
        return;
      }

      // Confirm deletion
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: `⚠️ *CONFIRM DATA DELETION*\n\nThis will permanently delete ALL data for user ${targetSlackId}:\n• Profile information\n• All submissions (anonymized)\n• XP history\n• Badges\n• Comments\n• Activity logs\n\n**This action cannot be undone.**\n\nTo confirm, use: \`/privacy delete ${targetSlackId} CONFIRM\``
      });

      if (rawArgs[2] === 'CONFIRM') {
        const deleteResult = await PrivacyService.deleteUserData(targetUser.user_id, body.user_id);
        
        if (deleteResult.success) {
          await client.chat.postEphemeral({
            channel: body.channel_id,
            user: body.user_id,
            text: `✅ *Data Deletion Complete*\n\nDeleted data for user ${targetSlackId}:\n${deleteResult.deletedItems?.map(item => `• ${item}`).join('\n')}`
          });
        } else {
          await client.chat.postEphemeral({
            channel: body.channel_id,
            user: body.user_id,
            text: `❌ Deletion failed: ${deleteResult.error}`
          });
        }
      }

    } else if (command === 'summary' && rawArgs[1]) {
      // Get privacy summary for user
      const targetSlackId = SecurityService.sanitizeText(rawArgs[1]);
      const targetUser = await UserService.getUserBySlackId(targetSlackId);
      
      if (!targetUser) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: '❌ User not found.'
        });
        return;
      }

      const summary = await PrivacyService.getUserPrivacySummary(targetUser.user_id);
      
      const summaryText = `📊 *Privacy Summary for ${targetSlackId}*

**Data Retained:**
${summary.summary.dataRetained.map(item => `• ${item}`).join('\n')}

**Retention Periods:**
${Object.entries(summary.summary.retentionPeriods).map(([key, value]) => `• ${key}: ${value}`).join('\n')}

**User Rights:**
${Object.entries(summary.rights).map(([right, available]) => `• ${right}: ${available ? '✅' : '❌'}`).join('\n')}`;

      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: summaryText
      });

    } else {
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: `🔒 *Privacy Admin Commands*\n\n• \`/privacy export <slack_id>\` - Export user data\n• \`/privacy delete <slack_id>\` - Delete user data (GDPR)\n• \`/privacy summary <slack_id>\` - Show privacy summary\n\n🛡️ All privacy actions are logged for audit purposes.`
      });
    }
    
  } catch (error) {
    console.error('Error handling /privacy command:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: '❌ Sorry, there was an error with the privacy command. Please try again later.'
    });
  }
});

// Handle /security slash command (admin only)
app.command('/security', async ({ ack, body, client }) => {
  await ack();
  
  try {
    // Security: Check if user is admin
    if (!SecurityService.isAdmin(body.user_id)) {
      await SecurityService.logSecurityEvent({
        slackUserId: body.user_id,
        eventType: 'admin_action',
        description: 'Unauthorized admin command attempt: /security',
        riskLevel: 'medium',
        metadata: { command: '/security', channel: body.channel_id }
      });

      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '❌ This command is only available to administrators.'
      });
      return;
    }

    const rawArgs = (body.text || '').trim().split(' ');
    const command = rawArgs[0]?.toLowerCase() || '';
    
    if (command === 'logs') {
      // Show recent security logs
      const { supabaseAdmin } = await import('./database/supabase');
      const { data: logs } = await supabaseAdmin
        .from('security_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (logs && logs.length > 0) {
        const logsText = logs.map(log => 
          `• ${log.created_at.substring(0, 19)}: [${log.risk_level.toUpperCase()}] ${log.event_type} - ${log.description}`
        ).join('\n');

        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: `🛡️ *Recent Security Events*\n\n${logsText.substring(0, 2000)}${logsText.length > 2000 ? '...' : ''}`
        });
      } else {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: '✅ No recent security events found.'
        });
      }

    } else if (command === 'stats') {
      // Show security statistics
      const { supabaseAdmin } = await import('./database/supabase');
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [
        { count: dailyEvents },
        { count: weeklyEvents },
        { count: highRiskEvents }
      ] = await Promise.all([
        supabaseAdmin.from('security_logs').select('*', { count: 'exact', head: true }).gte('created_at', oneDayAgo.toISOString()),
        supabaseAdmin.from('security_logs').select('*', { count: 'exact', head: true }).gte('created_at', oneWeekAgo.toISOString()),
        supabaseAdmin.from('security_logs').select('*', { count: 'exact', head: true }).eq('risk_level', 'high').gte('created_at', oneWeekAgo.toISOString())
      ]);

      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: `📊 *Security Statistics*

**Last 24 Hours:**
• Total Events: ${dailyEvents || 0}

**Last 7 Days:**
• Total Events: ${weeklyEvents || 0}
• High Risk Events: ${highRiskEvents || 0}

**System Status:** ${(dailyEvents || 0) < 50 ? '🟢 Normal' : (dailyEvents || 0) < 100 ? '🟡 Elevated' : '🔴 High Activity'}`
      });

    } else {
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: `🛡️ *Security Admin Commands*\n\n• \`/security logs\` - View recent security events\n• \`/security stats\` - View security statistics\n\n🔍 Security monitoring is active and all events are logged.`
      });
    }
    
  } catch (error) {
    console.error('Error handling /security command:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: '❌ Sorry, there was an error with the security command. Please try again later.'
    });
  }
});

// Handle /season command - Admin-only season management
app.command('/season', async ({ ack, body, client }) => {
  await ack();
  
  try {
    // Security: Check admin privileges
    if (!SecurityService.isAdmin(body.user_id)) {
      await SecurityService.logSecurityEvent({
        slackUserId: body.user_id,
        eventType: 'admin_action',
        description: 'Unauthorized admin command attempt: /season',
        riskLevel: 'medium',
        metadata: { command: '/season', args: body.text }
      });
      
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '❌ You do not have permission to use this command.'
      });
      return;
    }

    const { SeasonService } = await import('./services/seasonService');
    const args = (body.text || '').trim().split(/\s+/);
    const command = args[0]?.toLowerCase();

    if (command === 'current') {
      // Show current season info
      const currentSeason = await SeasonService.getCurrentSeason();
      
      if (!currentSeason) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: '📅 No active season found. Use `/season create` to start a new season.'
        });
        return;
      }

      const stats = await SeasonService.getSeasonStats(currentSeason.season_id);
      if (stats) {
        const blocks = SeasonService.formatSeasonStatsForSlack(stats);
        
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: '📊 Current Season Statistics',
          blocks
        });
      }

    } else if (command === 'rankings') {
      // Show season leaderboard
      const limit = parseInt(args[1]) || 20;
      const rankings = await SeasonService.getSeasonRankings(undefined, Math.min(limit, 50));
      
      if (rankings.length === 0) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: '🏆 No rankings available for the current season.'
        });
        return;
      }

      const rankingsText = rankings
        .slice(0, 15)
        .map((ranking, index) => {
          const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}.`;
          return `${medal} ${ranking.displayName}: ${ranking.seasonXP} XP (${ranking.submissions} submissions)`;
        })
        .join('\n');

      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: `🏆 *Season Rankings* (Top ${Math.min(rankings.length, 15)})\n\n${rankingsText}`
      });

    } else if (command === 'create') {
      // Create new season - requires more validation
      const seasonNumber = parseInt(args[1]);
      const startDate = args[2]; // YYYY-MM-DD format
      const endDate = args[3]; // YYYY-MM-DD format
      const decayFactor = parseFloat(args[4]) || 0.1;

      if (!seasonNumber || !startDate || !endDate) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: '❌ Invalid format. Use: `/season create <number> <start-date> <end-date> [decay-factor]`\n\nExample: `/season create 2 2024-04-01 2024-06-30 0.1`'
        });
        return;
      }

      const result = await SeasonService.createSeason({
        seasonNumber,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        decayFactor
      });

      if (result.success) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: `✅ Successfully created Season ${seasonNumber}!\n\n📅 **Duration:** ${startDate} to ${endDate}\n🔄 **Decay Factor:** ${(decayFactor * 100).toFixed(1)}%`
        });
      } else {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: `❌ Failed to create season: ${result.error}`
        });
      }

    } else if (command === 'end') {
      // End current season
      const seasonId = parseInt(args[1]);
      
      if (!seasonId) {
        const currentSeason = await SeasonService.getCurrentSeason();
        if (!currentSeason) {
          await client.chat.postEphemeral({
            channel: body.channel_id,
            user: body.user_id,
            text: '❌ No active season to end. Specify season ID: `/season end <season-id>`'
          });
          return;
        }
        
        // Use current season
        const transition = await SeasonService.endSeason(currentSeason.season_id);
        
        if (transition) {
          await client.chat.postEphemeral({
            channel: body.channel_id,
            user: body.user_id,
            text: `✅ **Season ${transition.endingSeason.season_number} Ended!**\n\n🔄 **XP Decay Applied:** ${transition.xpDecayApplied} total XP\n👥 **Users Affected:** ${transition.affectedUsers}\n🆕 **New Season:** ${transition.newSeason.season_number} starts ${new Date(transition.newSeason.start_date).toLocaleDateString()}`
          });
        } else {
          await client.chat.postEphemeral({
            channel: body.channel_id,
            user: body.user_id,
            text: '❌ Failed to end season. Please check logs for details.'
          });
        }
      }

    } else if (command === 'status') {
      // Update season status
      const seasonId = parseInt(args[1]);
      const newStatus = args[2] as 'active' | 'paused' | 'ended';
      
      if (!seasonId || !['active', 'paused', 'ended'].includes(newStatus)) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: '❌ Invalid format. Use: `/season status <season-id> <active|paused|ended>`'
        });
        return;
      }

      const result = await SeasonService.updateSeasonStatus(seasonId, newStatus);
      
      if (result.success) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: `✅ Season ${seasonId} status updated to: ${newStatus}`
        });
      } else {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: `❌ Failed to update season status: ${result.error}`
        });
      }

    } else if (command === 'rewards') {
      // Award season-end rewards
      const seasonId = parseInt(args[1]);
      
      if (!seasonId) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: '❌ Specify season ID: `/season rewards <season-id>`'
        });
        return;
      }

      const result = await SeasonService.awardSeasonRewards(seasonId);
      
      if (result.success) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: `✅ **Season Rewards Awarded!**\n\n🏆 **Recipients:** ${result.rewardsAwarded} top performers\n💎 Bonuses and badges distributed based on final rankings.`
        });
      } else {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: `❌ Failed to award season rewards: ${result.error}`
        });
      }

    } else if (command === 'list') {
      // List all seasons
      const { seasons } = await SeasonService.getAllSeasons(10);
      
      if (seasons.length === 0) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: '📅 No seasons found.'
        });
        return;
      }

      const seasonsText = seasons
        .map(season => {
          const status = season.status === 'active' ? '🟢' : season.status === 'paused' ? '🟡' : '🔴';
          return `${status} **Season ${season.season_number}** (${new Date(season.start_date).toLocaleDateString()} - ${new Date(season.end_date).toLocaleDateString()})`;
        })
        .join('\n');

      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: `📅 **All Seasons**\n\n${seasonsText}`
      });

    } else {
      // Show help
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: `🗓️ **Season Management Commands**

**View Commands:**
• \`/season current\` - Show current season stats
• \`/season rankings [limit]\` - Show season leaderboard
• \`/season list\` - List all seasons

**Management Commands:**
• \`/season create <number> <start-date> <end-date> [decay]\` - Create new season
• \`/season end [season-id]\` - End current/specified season
• \`/season status <season-id> <active|paused|ended>\` - Update season status
• \`/season rewards <season-id>\` - Award end-of-season rewards

**Examples:**
• \`/season create 3 2024-07-01 2024-09-30 0.15\`
• \`/season rankings 10\`
• \`/season end\``
      });
    }
    
  } catch (error) {
    console.error('Error handling /season command:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: '❌ Sorry, there was an error with the season command. Please try again later.'
    });
  }
});

// Handle /preferences slash command
app.command('/preferences', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const { OnboardingService } = await import('./services/onboardingService');
    const { UserService } = await import('./services/userService');
    
    // Get user from database
    const user = await UserService.getUserBySlackId(body.user_id);
    if (!user) {
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '❌ User not found. Please use `/submit` to create your profile first.'
      });
      return;
    }

    const args = (body.text || '').trim().split(/\s+/);
    const command = args[0]?.toLowerCase();

    if (command === 'update' || command === 'set') {
      // Open preferences modal
      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: 'modal',
          callback_id: 'update_preferences_modal',
          title: {
            type: 'plain_text',
            text: 'Update Preferences'
          },
          submit: {
            type: 'plain_text',
            text: 'Save'
          },
          close: {
            type: 'plain_text',
            text: 'Cancel'
          },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '⚙️ *Choose your notification preferences:*'
              }
            },
            {
              type: 'input',
              block_id: 'streak_dms',
              element: {
                type: 'checkboxes',
                action_id: 'streak_dms_check',
                initial_options: user.notification_preferences?.streak_dms !== false ? [
                  {
                    text: { type: 'plain_text', text: 'Send me streak reminder DMs' },
                    value: 'enabled'
                  }
                ] : [],
                options: [
                  {
                    text: { type: 'plain_text', text: 'Send me streak reminder DMs' },
                    value: 'enabled'
                  }
                ]
              },
              label: {
                type: 'plain_text',
                text: 'Streak Reminders'
              },
              optional: true
            },
            {
              type: 'input',
              block_id: 'weekly_digest',
              element: {
                type: 'checkboxes',
                action_id: 'weekly_digest_check',
                initial_options: user.notification_preferences?.weekly_digest !== false ? [
                  {
                    text: { type: 'plain_text', text: 'Send me weekly digest messages' },
                    value: 'enabled'
                  }
                ] : [],
                options: [
                  {
                    text: { type: 'plain_text', text: 'Send me weekly digest messages' },
                    value: 'enabled'
                  }
                ]
              },
              label: {
                type: 'plain_text',
                text: 'Weekly Digest'
              },
              optional: true
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: 'ℹ️ Streak reminders help you maintain your daily activity. Weekly digests summarize your progress and community highlights.'
                }
              ]
            }
          ]
        }
      });
      
    } else {
      // Show current preferences
      const currentPrefs = user.notification_preferences || {
        streak_dms: true,
        weekly_digest: true
      };
      
      const blocks = OnboardingService.formatPreferencesForSlack(currentPrefs);
      
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        blocks: [
          ...blocks,
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: '💡 Use `/preferences update` to change your settings'
              }
            ]
          }
        ]
      });
    }
    
  } catch (error) {
    console.error('Error handling /preferences command:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: '❌ Sorry, there was an error with the preferences command. Please try again later.'
    });
  }
});

// Handle browse category button actions
app.action(/^browse_category_(.+)$/, async ({ ack, body, client }) => {
  await ack();
  
  try {
    const category = (body as any).actions[0].value;
    const { PromptLibraryService } = await import('./services/promptLibraryService');
    const { UserService } = await import('./services/userService');
    
    // Get user for personalization
    const user = await UserService.getUserBySlackId(body.user.id);
    
    // Browse specific category
    const searchResult = await PromptLibraryService.searchLibraryItems(
      { category, sortBy: 'quality' },
      1,
      10,
      user?.user_id
    );
    
    if (searchResult.items.length === 0) {
      await client.chat.postEphemeral({
        channel: body.channel?.id || body.user.id,
        user: body.user.id,
        text: `📂 No prompts found in category "${category}"`
      });
      return;
    }
    
    const blocks = PromptLibraryService.formatLibraryItemsForSlack(
      searchResult.items,
      `📂 *${category.charAt(0).toUpperCase() + category.slice(1)} Prompts* (${searchResult.total} found)`,
      true
    );
    
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: `📂 ${category.charAt(0).toUpperCase() + category.slice(1)} Prompts`,
      blocks
    });
    
  } catch (error) {
    console.error('Error browsing category:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: '❌ Sorry, there was an error browsing this category.'
    });
  }
});

// Handle /digest slash command (admin only)
app.command('/digest', async ({ ack, body, client }) => {
  await ack();
  
  try {
    // Security: Check admin privileges
    if (!SecurityService.isAdmin(body.user_id)) {
      await SecurityService.logSecurityEvent({
        slackUserId: body.user_id,
        eventType: 'admin_action',
        description: 'Unauthorized admin command attempt: /digest',
        riskLevel: 'medium',
        metadata: { command: '/digest', args: body.text }
      });
      
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '❌ You do not have permission to use this command.'
      });
      return;
    }

    const { DigestWriterService } = await import('./services/digestWriterService');
    const { UserService } = await import('./services/userService');
    const { supabaseAdmin } = await import('./database/supabase');
    
    const args = (body.text || '').trim().split(/\s+/);
    const command = args[0]?.toLowerCase();
    const target = args[1];

    if (command === 'community' || command === 'weekly') {
      // Generate community digest
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '⏳ Generating community digest... This may take a moment.'
      });

      const digestResult = await DigestWriterService.generateCommunityDigest({
        includePersonalizedIntro: true,
        highlightSeasonProgress: true,
        includeMotivationalQuotes: true,
        focusOnCommunityGrowth: true
      });

      if (digestResult.success && digestResult.digest) {
        await client.chat.postMessage({
          channel: body.channel_id,
          text: digestResult.digest
        });
        
        await SecurityService.logSecurityEvent({
          slackUserId: body.user_id,
          eventType: 'admin_action',
          description: 'Generated community digest',
          riskLevel: 'low',
          metadata: { command: 'digest community' }
        });
      } else {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: `❌ Failed to generate community digest: ${digestResult.error || 'Unknown error'}`
        });
      }

    } else if (command === 'personal' && target) {
      // Generate personal digest for specific user
      let targetUser;
      
      // Check if target is a user mention or slack ID
      if (target.startsWith('<@') && target.endsWith('>')) {
        const slackId = target.slice(2, -1);
        targetUser = await UserService.getUserBySlackId(slackId);
      } else {
        // Try to find user by display name or slack ID
        const { data: users } = await supabaseAdmin
          .from('users')
          .select('*')
          .or(`slack_id.eq.${target},display_name.ilike.%${target}%`);
        
        targetUser = users?.[0];
      }

      if (!targetUser) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: '❌ User not found. Use format: `/digest personal @username` or `/digest personal slack_id`'
        });
        return;
      }

      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: `⏳ Generating personal digest for ${targetUser.display_name}... This may take a moment.`
      });

      const digestResult = await DigestWriterService.generatePersonalDigest(targetUser.user_id, {
        includePersonalizedIntro: true,
        includeMotivationalQuotes: true
      });

      if (digestResult.success && digestResult.digest) {
        // Send digest as DM to target user
        await client.chat.postMessage({
          channel: targetUser.slack_id,
          text: digestResult.digest
        });
        
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: `✅ Personal digest sent to ${targetUser.display_name}`
        });
        
        await SecurityService.logSecurityEvent({
          slackUserId: body.user_id,
          eventType: 'admin_action',
          description: `Generated personal digest for user ${targetUser.user_id}`,
          riskLevel: 'low',
          metadata: { command: 'digest personal', targetUserId: targetUser.user_id }
        });
      } else {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: `❌ Failed to generate personal digest: ${digestResult.error || 'Unknown error'}`
        });
      }

    } else if (command === 'test') {
      // Test LLM connectivity
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '⏳ Testing LLM connectivity...'
      });

      const testResult = await DigestWriterService.generateCommunityDigest({});
      
      if (testResult.success) {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: '✅ LLM connectivity test successful. Digest generation is working properly.'
        });
      } else {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: `❌ LLM connectivity test failed: ${testResult.error}`
        });
      }

    } else {
      // Show help
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: `📖 **Digest Commands**

**Community Digests:**
• \`/digest community\` - Generate and post weekly community digest
• \`/digest weekly\` - Alias for community digest

**Personal Digests:**
• \`/digest personal @username\` - Generate personal digest for specific user
• \`/digest personal slack_id\` - Generate personal digest by Slack ID

**Testing:**
• \`/digest test\` - Test LLM connectivity

**Examples:**
• \`/digest community\`
• \`/digest personal @john\`
• \`/digest personal U01234567\``
      });
    }
    
  } catch (error) {
    console.error('Error handling /digest command:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: '❌ Sorry, there was an error with the digest command. Please try again later.'
    });
  }
});

// Handle onboarding action buttons
app.action('set_preferences', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const { OnboardingService } = await import('./services/onboardingService');
    const { UserService } = await import('./services/userService');
    
    // Get user from database
    const user = await UserService.getUserBySlackId(body.user.id);
    if (!user) {
      await client.chat.postEphemeral({
        channel: body.channel?.id || body.user.id,
        user: body.user.id,
        text: '❌ User not found. Please use `/submit` to create your profile first.'
      });
      return;
    }

    // Open preferences modal
    await client.views.open({
      trigger_id: (body as any).trigger_id,
      view: {
        type: 'modal',
        callback_id: 'update_preferences_modal',
        title: {
          type: 'plain_text',
          text: 'Set Your Preferences'
        },
        submit: {
          type: 'plain_text',
          text: 'Save'
        },
        close: {
          type: 'plain_text',
          text: 'Cancel'
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '⚙️ *Choose your notification preferences:*'
            }
          },
          {
            type: 'input',
            block_id: 'streak_dms',
            element: {
              type: 'checkboxes',
              action_id: 'streak_dms_check',
              initial_options: [
                {
                  text: { type: 'plain_text', text: 'Send me streak reminder DMs' },
                  value: 'enabled'
                }
              ],
              options: [
                {
                  text: { type: 'plain_text', text: 'Send me streak reminder DMs' },
                  value: 'enabled'
                }
              ]
            },
            label: {
              type: 'plain_text',
              text: 'Streak Reminders'
            },
            optional: true
          },
          {
            type: 'input',
            block_id: 'weekly_digest',
            element: {
              type: 'checkboxes',
              action_id: 'weekly_digest_check',
              initial_options: [
                {
                  text: { type: 'plain_text', text: 'Send me weekly digest messages' },
                  value: 'enabled'
                }
              ],
              options: [
                {
                  text: { type: 'plain_text', text: 'Send me weekly digest messages' },
                  value: 'enabled'
                }
              ]
            },
            label: {
              type: 'plain_text',
              text: 'Weekly Digest'
            },
            optional: true
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: 'ℹ️ Streak reminders help you maintain daily activity. Weekly digests show your progress and community highlights.'
              }
            ]
          }
        ]
      }
    });
    
  } catch (error) {
    console.error('Error handling set preferences action:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: '❌ Sorry, there was an error opening preferences. Please try again later.'
    });
  }
});

app.action('trigger_submit_command', async ({ ack, body, client }) => {
  await ack();
  
  try {
    // Trigger the submit modal (reuse existing submit logic)
    const { SubmissionService } = await import('./services/submissionService');
    const { UserService } = await import('./services/userService');
    
    const user = await UserService.getUserBySlackId(body.user.id);
    const remixOptions = await SubmissionService.getSubmissionsForRemix(user?.user_id);
    
    const remixSelectOptions = remixOptions.map(sub => ({
      text: { type: 'plain_text' as const, text: sub.title },
      value: sub.id.toString()
    }));

    await client.views.open({
      trigger_id: (body as any).trigger_id,
      view: {
        type: 'modal',
        callback_id: 'submit_prompt_modal',
        title: {
          type: 'plain_text',
          text: 'Submit Your First Prompt'
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '🚀 *Welcome to AI Games!*\n\nSubmit your first prompt to start earning XP and competing with the community.'
            }
          },
          {
            type: 'divider'
          },
          {
            type: 'input',
            block_id: 'title_input',
            element: {
              type: 'plain_text_input',
              action_id: 'title_text',
              placeholder: {
                type: 'plain_text',
                text: 'Give your prompt a catchy title...'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Title'
            },
            optional: true
          },
          {
            type: 'input',
            block_id: 'prompt_input',
            element: {
              type: 'plain_text_input',
              action_id: 'prompt_text',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Enter your AI prompt or workflow here...'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Prompt/Workflow *'
            }
          },
          {
            type: 'input',
            block_id: 'description_input',
            element: {
              type: 'plain_text_input',
              action_id: 'description_text',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Describe what this prompt does and how to use it...'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Description'
            },
            optional: true
          },
          {
            type: 'input',
            block_id: 'tags_input',
            element: {
              type: 'plain_text_input',
              action_id: 'tags_text',
              placeholder: {
                type: 'plain_text',
                text: 'writing, creative, business, analysis, etc.'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Tags (comma-separated)'
            },
            optional: true
          }
        ],
        submit: {
          type: 'plain_text',
          text: 'Submit Prompt'
        },
        close: {
          type: 'plain_text',
          text: 'Cancel'
        }
      }
    });
    
  } catch (error) {
    console.error('Error triggering submit command:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel?.id || body.user.id,
      user: body.user.id,
      text: '❌ Sorry, there was an error opening the submit form. Please try the `/submit` command instead.'
    });
  }
});

// Start the app
(async () => {
  console.log('🚀 Starting AI Games Slack app...');
  console.log('Environment check:', {
    NODE_ENV: process.env.NODE_ENV,
    SLACK_BOT_TOKEN: !!process.env.SLACK_BOT_TOKEN,
    SLACK_APP_TOKEN: !!process.env.SLACK_APP_TOKEN,
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
    PORT: process.env.PORT
  });
  
  await app.start();
  console.log('⚡️ AI Games Slack app is running!');
  
  // For Railway deployment, use PORT env var for the main HTTP server
  // In Socket Mode, the Slack app doesn't need a web server, but Railway expects one
  const port = parseInt(process.env.PORT || process.env.HTTP_PORT || '3001');
  expressApp.listen(port, () => {
    console.log(`📅 HTTP server running on port ${port}`);
    console.log('🔌 Slack app connected via Socket Mode');
  });
})().catch(error => {
  console.error('❌ Failed to start app:', error);
  process.exit(1);
});