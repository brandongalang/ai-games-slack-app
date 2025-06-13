import { supabaseAdmin } from '../database/supabase';
import { AnalyticsService } from './analyticsService';
import { LeaderboardService } from './leaderboardService';
import { StreakService } from './streakService';
import { XPService } from './xpService';
import { CommentService } from './commentService';
import { ChallengeService } from './challengeService';

export interface HomeTabData {
  userRanking: any;
  userAnalytics: any;
  userStreak: any;
  userXPBreakdown: any;
  userComments: any;
  currentChallenge: any;
  topUsers: any[];
  communityStats: any;
  personalizedInsights: string[];
  achievements: any[];
}

export class HomeTabService {
  /**
   * Get comprehensive data for user's home tab
   */
  static async getHomeTabData(slackUserId: string): Promise<HomeTabData> {
    try {
      // Get all user data in parallel for performance
      const [
        userRanking,
        userAnalytics,
        userStreak,
        userXPBreakdown,
        userComments,
        currentChallenge,
        topUsers,
        communityStats
      ] = await Promise.allSettled([
        LeaderboardService.getUserRanking(slackUserId),
        AnalyticsService.getUserAnalytics(slackUserId),
        this.getUserStreakData(slackUserId),
        this.getUserXPBreakdown(slackUserId),
        this.getUserCommentStats(slackUserId),
        ChallengeService.getCurrentWeekChallenge(),
        LeaderboardService.getGlobalLeaderboard(5),
        this.getCommunityStats()
      ]);

      // Extract successful results
      const data = {
        userRanking: userRanking.status === 'fulfilled' ? userRanking.value : null,
        userAnalytics: userAnalytics.status === 'fulfilled' ? userAnalytics.value : null,
        userStreak: userStreak.status === 'fulfilled' ? userStreak.value : null,
        userXPBreakdown: userXPBreakdown.status === 'fulfilled' ? userXPBreakdown.value : null,
        userComments: userComments.status === 'fulfilled' ? userComments.value : null,
        currentChallenge: currentChallenge.status === 'fulfilled' ? currentChallenge.value : null,
        topUsers: topUsers.status === 'fulfilled' ? topUsers.value : [],
        communityStats: communityStats.status === 'fulfilled' ? communityStats.value : null
      };

      // Generate personalized insights
      const personalizedInsights = await this.generatePersonalizedInsights(data);
      
      // Get user achievements
      const achievements = await this.getUserAchievements(slackUserId, data);

      return {
        ...data,
        personalizedInsights,
        achievements
      };
    } catch (error) {
      console.error('Error getting home tab data:', error);
      throw error;
    }
  }

  /**
   * Get user streak data with detailed analytics
   */
  private static async getUserStreakData(slackUserId: string): Promise<any> {
    try {
      const { UserService } = await import('./userService');
      const user = await UserService.getUserBySlackId(slackUserId);
      if (!user) return null;

      return await StreakService.calculateUserStreak(user.user_id);
    } catch (error) {
      console.error('Error getting user streak data:', error);
      return null;
    }
  }

  /**
   * Get user XP breakdown with recent activity
   */
  private static async getUserXPBreakdown(slackUserId: string): Promise<any> {
    try {
      const { UserService } = await import('./userService');
      const user = await UserService.getUserBySlackId(slackUserId);
      if (!user) return null;

      return await XPService.getUserXPBreakdown(user.user_id);
    } catch (error) {
      console.error('Error getting user XP breakdown:', error);
      return null;
    }
  }

  /**
   * Get user comment statistics
   */
  private static async getUserCommentStats(slackUserId: string): Promise<any> {
    try {
      const { UserService } = await import('./userService');
      const user = await UserService.getUserBySlackId(slackUserId);
      if (!user) return null;

      const recentComments = await CommentService.getRecentHelpfulComments(user.user_id, 30);
      const analysisStats = await CommentService.getCommentAnalysisStats(30);

      return {
        helpfulCommentsCount: recentComments.length,
        recentComments: recentComments.slice(0, 3), // Last 3 helpful comments
        communityImpact: analysisStats
      };
    } catch (error) {
      console.error('Error getting user comment stats:', error);
      return null;
    }
  }

  /**
   * Get enhanced community statistics
   */
  private static async getCommunityStats(): Promise<any> {
    try {
      const baseStats = await LeaderboardService.getLeaderboardStats();
      const commentStats = await CommentService.getCommentAnalysisStats(7); // Last week
      
      return {
        ...baseStats,
        weeklyComments: commentStats.totalComments,
        weeklyHelpfulComments: commentStats.helpfulComments,
        communityEngagement: commentStats.totalComments > 0 
          ? Math.round((commentStats.helpfulComments / commentStats.totalComments) * 100)
          : 0
      };
    } catch (error) {
      console.error('Error getting community stats:', error);
      return null;
    }
  }

  /**
   * Generate personalized insights for the user
   */
  private static async generatePersonalizedInsights(data: Partial<HomeTabData>): Promise<string[]> {
    const insights: string[] = [];

    try {
      // Streak insights
      if (data.userStreak) {
        if (data.userStreak.currentStreak >= 7) {
          insights.push(`🔥 Amazing! You're on a ${data.userStreak.currentStreak}-day streak!`);
        } else if (data.userStreak.currentStreak > 0) {
          insights.push(`⚡ Keep it up! ${7 - data.userStreak.currentStreak} more days for a weekly streak bonus.`);
        } else if (data.userStreak.daysUntilLoss === 0) {
          insights.push('🎯 Submit today to start a new streak!');
        }
      }

      // XP insights
      if (data.userXPBreakdown) {
        if (data.userXPBreakdown.weeklyGrowth > 0) {
          insights.push(`📈 You've earned ${data.userXPBreakdown.weeklyGrowth} XP this week!`);
        }
        
        if (data.userXPBreakdown.topCategory) {
          insights.push(`🎯 Your strongest area: ${data.userXPBreakdown.topCategory}`);
        }
      }

      // Analytics insights
      if (data.userAnalytics) {
        if (data.userAnalytics.activityTrend === 'increasing') {
          insights.push('📊 Your activity is trending upward - great momentum!');
        }
        
        if (data.userAnalytics.averageXpPerSubmission > 15) {
          insights.push('⭐ Your submissions consistently earn high XP!');
        }
      }

      // Comment insights
      if (data.userComments && data.userComments.helpfulCommentsCount > 0) {
        insights.push(`💬 You've made ${data.userComments.helpfulCommentsCount} helpful comments this month!`);
      }

      // Ranking insights
      if (data.userRanking) {
        if (data.userRanking.percentile <= 10) {
          insights.push('🏆 You\'re in the top 10% of players!');
        } else if (data.userRanking.xpUntilNextRank && data.userRanking.xpUntilNextRank <= 50) {
          insights.push(`🎯 Only ${data.userRanking.xpUntilNextRank} XP to rank up!`);
        }
      }

      // Challenge insights
      if (data.currentChallenge) {
        insights.push('🎯 Don\'t miss this week\'s challenge for bonus XP!');
      }

      return insights.slice(0, 3); // Return top 3 insights
    } catch (error) {
      console.error('Error generating insights:', error);
      return ['🎮 Welcome back to AI Games!'];
    }
  }

  /**
   * Get user achievements and badges
   */
  private static async getUserAchievements(slackUserId: string, data: Partial<HomeTabData>): Promise<any[]> {
    const achievements: any[] = [];

    try {
      // Streak achievements
      if (data.userStreak?.currentStreak >= 30) {
        achievements.push({ icon: '🔥', name: 'Streak Master', description: '30+ day streak' });
      } else if (data.userStreak?.currentStreak >= 7) {
        achievements.push({ icon: '⚡', name: 'Week Warrior', description: '7+ day streak' });
      }

      // XP achievements
      if (data.userRanking?.user?.total_xp >= 1000) {
        achievements.push({ icon: '💰', name: 'XP Millionaire', description: '1000+ total XP' });
      } else if (data.userRanking?.user?.total_xp >= 500) {
        achievements.push({ icon: '💎', name: 'XP Collector', description: '500+ total XP' });
      }

      // Ranking achievements
      if (data.userRanking?.user?.rank <= 3) {
        const medals = ['🥇', '🥈', '🥉'];
        achievements.push({ 
          icon: medals[data.userRanking.user.rank - 1], 
          name: 'Top Player', 
          description: `Rank #${data.userRanking.user.rank}` 
        });
      }

      // Comment achievements
      if (data.userComments?.helpfulCommentsCount >= 10) {
        achievements.push({ icon: '💬', name: 'Helpful Helper', description: '10+ helpful comments' });
      }

      return achievements.slice(0, 4); // Return top 4 achievements
    } catch (error) {
      console.error('Error getting achievements:', error);
      return [];
    }
  }

  /**
   * Format comprehensive home tab blocks
   */
  static formatEnhancedHomeTab(data: HomeTabData, currentUserSlackId: string): any[] {
    const blocks: any[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '🎮 *Welcome to AI Games!*\n\nYour comprehensive dashboard for XP, streaks, achievements, and community competition!'
        }
      }
    ];

    // Add personalized insights banner
    if (data.personalizedInsights.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `💡 *Personal Insights*\n${data.personalizedInsights.map(insight => `• ${insight}`).join('\n')}`
        }
      });
    }

    blocks.push({ type: 'divider' });

    // Enhanced user stats section or new user welcome
    if (data.userRanking) {
      const { user, totalUsers, percentile, xpUntilNextRank } = data.userRanking;
      const rankEmoji = user.rank <= 3 ? ['🥇', '🥈', '🥉'][user.rank - 1] : '📊';
      const streakText = data.userStreak?.currentStreak > 0 
        ? ` • 🔥 ${data.userStreak.currentStreak} day streak` 
        : '';
      const nextRankText = xpUntilNextRank ? `\n📈 ${xpUntilNextRank} XP to next rank` : '';
      
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${rankEmoji} *Your Stats*\n#${user.rank} of ${totalUsers} (Top ${percentile}%)\n💰 ${user.total_xp} XP${streakText}${nextRankText}`
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '📊 Detailed Stats'
          },
          action_id: 'view_detailed_status'
        }
      });

      // Add achievements section
      if (data.achievements.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🏆 *Achievements*\n${data.achievements.map(ach => `${ach.icon} ${ach.name}`).join(' • ')}`
          }
        });
      }
    } else {
      // New user - show getting started info
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '🚀 *Get Started!*\nYou haven\'t submitted any prompts yet. Start your AI Games journey and earn your first XP!'
        }
      });
      
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '📊 *How it works:*\n• Submit AI prompts to earn XP\n• Build streaks for bonus rewards\n• Climb the leaderboard\n• Earn achievements and badges\n• Get helpful community feedback'
        }
      });
    }

    // Quick action buttons - different for new vs existing users
    const actionButtons: any[] = [{
      type: 'button',
      text: {
        type: 'plain_text',
        text: data.userRanking ? '🚀 Submit Prompt' : '🚀 Submit First Prompt'
      },
      action_id: 'trigger_submit_command',
      style: 'primary'
    }];

    // Add additional buttons for existing users
    if (data.userRanking) {
      actionButtons.push(
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '📈 Analytics'
          },
          action_id: 'view_full_analytics'
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🔥 Streak'
          },
          action_id: 'view_streak_status'
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '💰 XP Details'
          },
          action_id: 'view_xp_breakdown'
        }
      );
    } else {
      // For new users, show leaderboard and community instead
      actionButtons.push(
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🏆 Leaderboard'
          },
          action_id: 'view_full_leaderboard'
        }
      );
    }

    blocks.push({
      type: 'actions',
      elements: actionButtons
    });

    // Current challenge section
    if (data.currentChallenge) {
      blocks.push(
        { type: 'divider' },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🎯 *Week ${data.currentChallenge.week_number} Challenge*\n${data.currentChallenge.prompt_text.substring(0, 200)}${data.currentChallenge.prompt_text.length > 200 ? '...' : ''}`
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🎯 Respond'
            },
            action_id: 'submit_challenge_response'
          }
        }
      );
    }

    // Enhanced leaderboard preview
    if (data.topUsers.length > 0) {
      blocks.push(
        { type: 'divider' },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*🏆 Top Players*'
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Full Board'
            },
            action_id: 'view_full_leaderboard'
          }
        }
      );

      data.topUsers.slice(0, 3).forEach((user, index) => {
        const rankEmoji = ['🥇', '🥈', '🥉'][index];
        const isCurrentUser = user.slack_user_id === currentUserSlackId;
        const userText = isCurrentUser ? `*<@${user.slack_user_id}>* ⭐` : `<@${user.slack_user_id}>`;
        
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${rankEmoji} ${userText} • ${user.total_xp} XP • 🔥 ${user.current_streak || 0} streak`
          }
        });
      });
    }

    // Enhanced community stats
    if (data.communityStats) {
      blocks.push(
        { type: 'divider' },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `🌟 ${data.communityStats.totalUsers} players • 💰 ${data.communityStats.totalXP?.toLocaleString() || 0} total XP • 🔥 ${data.communityStats.topStreak || 0} day top streak • 💬 ${data.communityStats.communityEngagement || 0}% helpful comments`
            }
          ]
        }
      );
    }

    return blocks;
  }
}