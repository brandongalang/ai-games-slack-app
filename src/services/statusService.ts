import { HomeTabService, HomeTabData } from './homeTabService';
import { LeaderboardService } from './leaderboardService';
import { AnalyticsService } from './analyticsService';
import { StreakService } from './streakService';
import { XPService } from './xpService';
import { CommentService } from './commentService';

export class StatusService {
  /**
   * Format comprehensive status blocks for /status command
   */
  static async formatComprehensiveStatus(slackUserId: string): Promise<any[]> {
    try {
      // Get all data using HomeTabService
      const data = await HomeTabService.getHomeTabData(slackUserId);
      
      const blocks: any[] = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '📊 *Your Complete AI Games Status*'
          }
        }
      ];

      // Personal insights banner
      if (data.personalizedInsights && data.personalizedInsights.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `💡 *Key Insights*\n${data.personalizedInsights.map(insight => `• ${insight}`).join('\n')}`
          }
        });
      }

      blocks.push({ type: 'divider' });

      // Ranking and XP section
      if (data.userRanking) {
        const { user, totalUsers, percentile, xpUntilNextRank } = data.userRanking;
        const rankEmoji = user.rank <= 3 ? ['🥇', '🥈', '🥉'][user.rank - 1] : '📊';
        
        let statusText = `${rankEmoji} *Ranking & XP*\n`;
        statusText += `Rank: #${user.rank} of ${totalUsers} (Top ${percentile}%)\n`;
        statusText += `Total XP: ${user.total_xp.toLocaleString()}\n`;
        if (xpUntilNextRank) {
          statusText += `Next Rank: ${xpUntilNextRank} XP away`;
        }

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: statusText
          }
        });
      }

      // XP Breakdown section
      if (data.userXPBreakdown) {
        let xpText = `💰 *XP Breakdown*\n`;
        if (data.userXPBreakdown.weeklyGrowth) {
          xpText += `This Week: +${data.userXPBreakdown.weeklyGrowth} XP\n`;
        }
        if (data.userXPBreakdown.topCategory) {
          xpText += `Top Category: ${data.userXPBreakdown.topCategory}\n`;
        }
        if (data.userXPBreakdown.qualityScore) {
          xpText += `Quality Score: ${data.userXPBreakdown.qualityScore}/100`;
        }

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: xpText
          }
        });
      }

      // Streak section
      if (data.userStreak) {
        let streakText = `🔥 *Streak Status*\n`;
        streakText += `Current Streak: ${data.userStreak.currentStreak} days\n`;
        if (data.userStreak.longestStreak) {
          streakText += `Longest Streak: ${data.userStreak.longestStreak} days\n`;
        }
        if (data.userStreak.daysUntilLoss !== undefined) {
          if (data.userStreak.daysUntilLoss === 0) {
            streakText += `⚠️ Submit today to maintain streak!`;
          } else {
            streakText += `Next submission needed in: ${data.userStreak.daysUntilLoss} days`;
          }
        }

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: streakText
          }
        });
      }

      blocks.push({ type: 'divider' });

      // Analytics section
      if (data.userAnalytics) {
        const analytics = data.userAnalytics;
        
        let analyticsText = `📈 *Activity Analytics*\n`;
        analyticsText += `Total Submissions: ${analytics.totalSubmissions}\n`;
        analyticsText += `Average XP per Submission: ${analytics.averageXpPerSubmission}\n`;
        analyticsText += `Activity Frequency: ${analytics.submissionFrequency}\n`;
        analyticsText += `Trend: ${analytics.activityTrend}\n`;
        if (analytics.preferredCategories && analytics.preferredCategories.length > 0) {
          analyticsText += `Preferred Categories: ${analytics.preferredCategories.slice(0, 3).join(', ')}`;
        }

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: analyticsText
          }
        });
      }

      // Comments section
      if (data.userComments) {
        let commentsText = `💬 *Community Impact*\n`;
        commentsText += `Helpful Comments: ${data.userComments.helpfulCommentsCount} (last 30 days)\n`;
        if (data.userComments.communityImpact) {
          commentsText += `Community Engagement: ${data.userComments.communityImpact.communityEngagement || 0}%`;
        }

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: commentsText
          }
        });
      }

      // Achievements section
      if (data.achievements && data.achievements.length > 0) {
        blocks.push({ type: 'divider' });
        
        let achievementsText = `🏆 *Achievements*\n`;
        achievementsText += data.achievements.map(ach => 
          `${ach.icon} **${ach.name}** - ${ach.description}`
        ).join('\n');

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: achievementsText
          }
        });
      }

      // Action buttons
      blocks.push(
        { type: 'divider' },
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
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📈 Detailed Analytics'
              },
              action_id: 'view_full_analytics'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '🏆 Leaderboard'
              },
              action_id: 'view_full_leaderboard'
            }
          ]
        }
      );

      return blocks;
    } catch (error) {
      console.error('Error formatting comprehensive status:', error);
      
      // Return fallback blocks
      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '📊 *AI Games Status*\n\n❌ Unable to load detailed status. Please try again later.'
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
              action_id: 'trigger_submit_command'
            }
          ]
        }
      ];
    }
  }

  /**
   * Format status for new users who haven't submitted yet
   */
  static formatNewUserStatus(): any[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '🎮 *Welcome to AI Games!*\n\nYou haven\'t submitted any prompts yet. Start your journey and earn your first XP!'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '📊 *How it works:*\n• Submit AI prompts to earn XP\n• Build streaks for bonus rewards\n• Climb the leaderboard\n• Earn achievements and badges\n• Get helpful community feedback'
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
            action_id: 'trigger_submit_command',
            style: 'primary'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🏠 View Home Tab'
            },
            action_id: 'view_home_tab'
          }
        ]
      }
    ];
  }

  /**
   * Format drill-down view for specific metrics
   */
  static async formatDrillDownView(slackUserId: string, metric: string): Promise<any[]> {
    try {
      const { UserService } = await import('./userService');
      const user = await UserService.getUserBySlackId(slackUserId);
      if (!user) throw new Error('User not found');

      const blocks: any[] = [];

      switch (metric) {
        case 'xp_breakdown':
          const xpBreakdown = await XPService.getUserXPBreakdown(user.user_id);
          blocks.push(
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '💰 *Detailed XP Breakdown*'
              }
            },
            ...XPService.formatXPBreakdownForSlack(xpBreakdown)
          );
          break;

        case 'streak_details':
          const streakData = await StreakService.calculateUserStreak(user.user_id);
          blocks.push(
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '🔥 *Detailed Streak Analysis*'
              }
            },
            ...StreakService.formatStreakForSlack(streakData)
          );
          break;

        case 'full_analytics':
          const analytics = await AnalyticsService.getUserAnalytics(slackUserId);
          if (analytics) {
            blocks.push(
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: '📈 *Complete Analytics Report*'
                }
              },
              ...AnalyticsService.formatAnalyticsForSlack(analytics)
            );
          }
          break;

        default:
          blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '❌ Unknown metric requested.'
            }
          });
      }

      return blocks;
    } catch (error) {
      console.error('Error formatting drill-down view:', error);
      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '❌ Unable to load detailed view. Please try again later.'
          }
        }
      ];
    }
  }
}