import { App } from '@slack/bolt';
import express from 'express';
import dotenv from 'dotenv';
import { schedulerRouter } from './routes/scheduler';
import { streaksRouter } from './routes/streaks';
import { xpRouter } from './routes/xp';

dotenv.config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  port: parseInt(process.env.PORT || '3000')
});

// Create Express app for HTTP endpoints (scheduler, webhooks)
const expressApp = express();
expressApp.use(express.json());

// Make Slack app available to Express routes
expressApp.set('slackApp', app);

// Add scheduler routes
expressApp.use('/scheduler', schedulerRouter);

// Add streaks routes
expressApp.use('/streaks', streaksRouter);

// Add XP routes
expressApp.use('/xp', xpRouter);

// Handle app_home_opened event
app.event('app_home_opened', async ({ event, client }) => {
  try {
    console.log('Enhanced home tab opened by user:', event.user);
    
    const { HomeTabService } = await import('./services/homeTabService');
    
    // Get comprehensive home tab data
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

// Handle /status slash command
app.command('/status', async ({ ack, body, client }) => {
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
    console.error('Error handling enhanced /status command:', error);
    
    await client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: '❌ Sorry, there was an error fetching your status. Please try again later.'
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
    
    // Extract form values
    const title = view.state.values.title_input?.title_text?.value?.trim();
    const promptText = view.state.values.prompt_input.prompt_text.value?.trim() || '';
    const description = view.state.values.description_input?.description_text?.value?.trim();
    const outputSample = view.state.values.output_input?.output_text?.value?.trim();
    const tagsInput = view.state.values.tags_input?.tags_text?.value?.trim();
    const remixSelection = view.state.values.remix_input?.remix_selection?.selected_option?.value;
    
    // Validate required fields
    if (!promptText) {
      console.error('Prompt text is required');
      return;
    }
    
    // Parse tags
    const tags = tagsInput 
      ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
      : [];
    
    // Get or create user
    const user = await UserService.getOrCreateUser(body.user.id, body.user.name);
    
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
      promptText, 
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
    
    // Create submission
    const submission = await SubmissionService.createSubmission({
      authorId: user.user_id,
      title: title || undefined,
      promptText,
      description: description || undefined,
      outputSample: outputSample || undefined,
      tags,
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
        promptText,
        {
          title,
          description,
          tags
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
    
    confirmationParts.push(``, `Check out your progress in the Home tab or use \`/status\` to see your stats.`);
    
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

// Handle /comments slash command (admin only)
app.command('/comments', async ({ ack, body, client }) => {
  await ack();
  
  try {
    // Check if user is admin
    const adminUsers = (process.env.ADMIN_USERS || '').split(',').map(u => u.trim());
    if (!adminUsers.includes(body.user_id)) {
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '❌ This command is only available to administrators.'
      });
      return;
    }
    
    const { CommentService } = await import('./services/commentService');
    const args = (body.text || '').trim().split(' ');
    const command = args[0]?.toLowerCase();
    
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
    // Check if user is admin (you can customize this check)
    const adminUsers = (process.env.ADMIN_USERS || '').split(',').map(u => u.trim());
    if (!adminUsers.includes(body.user_id)) {
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
    // Check if user is admin
    const adminUsers = (process.env.ADMIN_USERS || '').split(',').map(u => u.trim());
    if (!adminUsers.includes(body.user_id)) {
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

// Start the app
(async () => {
  await app.start();
  console.log('⚡️ AI Games Slack app is running!');
  
  // Start Express server for scheduler endpoints
  const httpPort = parseInt(process.env.HTTP_PORT || '3001');
  expressApp.listen(httpPort, () => {
    console.log(`📅 Scheduler endpoints running on port ${httpPort}`);
  });
})();