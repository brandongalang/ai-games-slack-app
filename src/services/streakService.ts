import { supabase, supabaseAdmin } from '../database/supabase';
import { XP_EVENTS, XP_VALUES } from '../database/types';
import { UserService } from './userService';

export interface StreakData {
  userId: number;
  slackUserId: string;
  username: string;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string;
  streakStatus: 'active' | 'at_risk' | 'broken' | 'new';
  daysUntilRisk: number;
  streakBonus: number;
}

export interface DailyEngagementStats {
  totalActiveUsers: number;
  newStreaks: number;
  maintainedStreaks: number;
  brokenStreaks: number;
  atRiskUsers: number;
  streakLeaders: Array<{ username: string; streak: number; slackUserId: string }>;
}

export class StreakService {
  /**
   * Process daily streaks for all users
   * This should be called once per day via scheduled job
   */
  static async processDailyStreaks(): Promise<DailyEngagementStats> {
    console.log('Starting daily streak processing...');
    
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Get all users
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('*');

    if (usersError) {
      console.error('Error fetching users for streak processing:', usersError);
      throw new Error('Failed to process daily streaks');
    }

    let newStreaks = 0;
    let maintainedStreaks = 0;
    let brokenStreaks = 0;
    let atRiskUsers = 0;

    const streakUpdates = [];

    for (const user of users || []) {
      const streakData = await this.calculateUserStreak(user.user_id);
      
      // Check if user was active today
      const { data: todayActivity } = await supabaseAdmin
        .from('user_streaks')
        .select('*')
        .eq('user_id', user.user_id)
        .eq('streak_date', today)
        .single();

      // Check if user was active yesterday
      const { data: yesterdayActivity } = await supabaseAdmin
        .from('user_streaks')
        .select('*')
        .eq('user_id', user.user_id)
        .eq('streak_date', yesterday)
        .single();

      let newStreakValue = streakData.currentStreak;
      let streakStatus = streakData.streakStatus;

      // Determine streak changes
      if (todayActivity && !yesterdayActivity && user.current_streak === 0) {
        // New streak started
        newStreakValue = 1;
        streakStatus = 'active';
        newStreaks++;
      } else if (todayActivity && yesterdayActivity) {
        // Streak maintained
        maintainedStreaks++;
        streakStatus = 'active';
      } else if (!todayActivity && yesterdayActivity) {
        // Streak at risk (missed today but was active yesterday)
        streakStatus = 'at_risk';
        atRiskUsers++;
      } else if (!todayActivity && !yesterdayActivity && user.current_streak > 0) {
        // Streak broken (missed both days)
        newStreakValue = 0;
        streakStatus = 'broken';
        brokenStreaks++;
      }

      // Update user streak if changed
      if (newStreakValue !== user.current_streak) {
        streakUpdates.push({
          user_id: user.user_id,
          current_streak: newStreakValue,
          longest_streak: Math.max(user.longest_streak || 0, newStreakValue),
          last_active_date: todayActivity ? today : user.last_active_date
        });

        // Award streak bonus XP if applicable
        if (newStreakValue > 0 && newStreakValue >= 3) {
          await this.awardStreakBonusXP(user.user_id, newStreakValue);
        }
      }
    }

    // Batch update streaks
    if (streakUpdates.length > 0) {
      for (const update of streakUpdates) {
        await supabaseAdmin
          .from('users')
          .update({
            current_streak: update.current_streak,
            longest_streak: update.longest_streak,
            last_active_date: update.last_active_date
          })
          .eq('user_id', update.user_id);
      }
    }

    // Get streak leaders
    const streakLeaders = await this.getStreakLeaders(10);

    const stats: DailyEngagementStats = {
      totalActiveUsers: (users || []).length,
      newStreaks,
      maintainedStreaks,
      brokenStreaks,
      atRiskUsers,
      streakLeaders
    };

    console.log('Daily streak processing completed:', stats);
    return stats;
  }

  /**
   * Calculate current streak for a specific user
   */
  static async calculateUserStreak(userId: number): Promise<StreakData> {
    // Get user data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (userError) {
      throw new Error(`Failed to fetch user: ${userError.message}`);
    }

    // Get user's streak activity, ordered by date descending
    const { data: streakData, error: streakError } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', userId)
      .order('streak_date', { ascending: false });

    if (streakError) {
      console.error('Error fetching streak data:', streakError);
      return {
        userId,
        slackUserId: user.slack_user_id,
        username: user.username,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: user.created_at,
        streakStatus: 'new',
        daysUntilRisk: 0,
        streakBonus: 0
      };
    }

    const activities = streakData || [];
    if (activities.length === 0) {
      return {
        userId,
        slackUserId: user.slack_user_id,
        username: user.username,
        currentStreak: 0,
        longestStreak: user.longest_streak || 0,
        lastActivityDate: user.created_at,
        streakStatus: 'new',
        daysUntilRisk: 0,
        streakBonus: 0
      };
    }

    // Calculate current streak
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    const today = new Date();
    const lastActivityDate = activities[0].streak_date;
    const lastActivityTime = new Date(lastActivityDate);
    
    // Check if last activity was today or yesterday
    const daysSinceLastActivity = Math.floor(
      (today.getTime() - lastActivityTime.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate current streak by checking consecutive days
    if (daysSinceLastActivity <= 1) {
      // User is still in streak range
      const uniqueDates = [...new Set(activities.map(a => a.streak_date))].sort().reverse();
      
      let expectedDate = new Date(uniqueDates[0]);
      currentStreak = 1;
      
      for (let i = 1; i < uniqueDates.length; i++) {
        expectedDate.setDate(expectedDate.getDate() - 1);
        const expectedDateStr = expectedDate.toISOString().split('T')[0];
        
        if (uniqueDates[i] === expectedDateStr) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Calculate longest streak from all data
    const uniqueDates = [...new Set(activities.map(a => a.streak_date))].sort();
    
    for (let i = 0; i < uniqueDates.length; i++) {
      tempStreak = 1;
      
      for (let j = i + 1; j < uniqueDates.length; j++) {
        const currentDate = new Date(uniqueDates[j - 1]);
        const nextDate = new Date(uniqueDates[j]);
        const dayDiff = Math.floor(
          (nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (dayDiff === 1) {
          tempStreak++;
        } else {
          break;
        }
      }
      
      longestStreak = Math.max(longestStreak, tempStreak);
    }

    // Determine streak status
    let streakStatus: 'active' | 'at_risk' | 'broken' | 'new' = 'new';
    let daysUntilRisk = 0;

    if (currentStreak > 0) {
      if (daysSinceLastActivity === 0) {
        streakStatus = 'active';
        daysUntilRisk = 1;
      } else if (daysSinceLastActivity === 1) {
        streakStatus = 'at_risk';
        daysUntilRisk = 0;
      } else {
        streakStatus = 'broken';
        currentStreak = 0;
      }
    }

    // Calculate streak bonus
    const streakBonus = this.calculateStreakBonus(currentStreak);

    return {
      userId,
      slackUserId: user.slack_user_id,
      username: user.username,
      currentStreak,
      longestStreak: Math.max(longestStreak, user.longest_streak || 0),
      lastActivityDate,
      streakStatus,
      daysUntilRisk,
      streakBonus
    };
  }

  /**
   * Award streak bonus XP
   */
  static async awardStreakBonusXP(userId: number, streakDays: number): Promise<void> {
    const bonusXP = this.calculateStreakBonus(streakDays);
    
    if (bonusXP === 0) return;

    // Get current active season
    const { data: season } = await supabaseAdmin
      .from('seasons')
      .select('season_id')
      .eq('status', 'active')
      .single();

    // Record XP event
    const { error: xpError } = await supabaseAdmin
      .from('xp_events')
      .insert({
        user_id: userId,
        event_type: XP_EVENTS.STREAK_BONUS,
        xp_value: bonusXP,
        metadata: { 
          streak_days: streakDays,
          bonus_type: this.getStreakBonusType(streakDays)
        },
        season_id: season?.season_id
      });

    if (xpError) {
      console.error('Error recording streak bonus XP:', xpError);
      return;
    }

    // Update user total XP
    await UserService.addXP(userId, bonusXP);
    
    console.log(`Awarded ${bonusXP} streak bonus XP to user ${userId} for ${streakDays}-day streak`);
  }

  /**
   * Calculate streak bonus XP
   */
  static calculateStreakBonus(streakDays: number): number {
    if (streakDays >= 30) return 50; // Monthly streak
    if (streakDays >= 14) return 25; // Bi-weekly streak
    if (streakDays >= 7) return 15;  // Weekly streak
    if (streakDays >= 3) return 5;   // 3-day streak
    return 0;
  }

  /**
   * Get streak bonus type for display
   */
  static getStreakBonusType(streakDays: number): string {
    if (streakDays >= 30) return 'monthly';
    if (streakDays >= 14) return 'bi_weekly';
    if (streakDays >= 7) return 'weekly';
    if (streakDays >= 3) return 'three_day';
    return 'none';
  }

  /**
   * Get streak leaders
   */
  static async getStreakLeaders(limit = 10): Promise<Array<{ username: string; streak: number; slackUserId: string }>> {
    const { data: users, error } = await supabase
      .from('users')
      .select('username, current_streak, slack_user_id')
      .gt('current_streak', 0)
      .order('current_streak', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching streak leaders:', error);
      return [];
    }

    return (users || []).map(user => ({
      username: user.username,
      streak: user.current_streak,
      slackUserId: user.slack_user_id
    }));
  }

  /**
   * Get users at risk of losing their streak
   */
  static async getAtRiskUsers(): Promise<StreakData[]> {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .gt('current_streak', 0);

    if (error) {
      console.error('Error fetching users for at-risk check:', error);
      return [];
    }

    const atRiskUsers = [];
    const today = new Date().toISOString().split('T')[0];

    for (const user of users || []) {
      // Check if user has activity today
      const { data: todayActivity } = await supabaseAdmin
        .from('user_streaks')
        .select('*')
        .eq('user_id', user.user_id)
        .eq('streak_date', today)
        .single();

      if (!todayActivity) {
        const streakData = await this.calculateUserStreak(user.user_id);
        if (streakData.streakStatus === 'at_risk') {
          atRiskUsers.push(streakData);
        }
      }
    }

    return atRiskUsers;
  }

  /**
   * Send daily nudge DMs to at-risk users
   */
  static async sendDailyNudges(slackApp: any): Promise<number> {
    const atRiskUsers = await this.getAtRiskUsers();
    let sentCount = 0;

    for (const user of atRiskUsers) {
      try {
        const encouragementMessages = [
          `🔥 Your ${user.currentStreak}-day streak is at risk! Submit a prompt today to keep it alive!`,
          `⏰ Don't break that ${user.currentStreak}-day streak! Share a prompt to maintain your momentum.`,
          `🚨 Streak alert! You have a ${user.currentStreak}-day streak that needs attention today.`,
          `💪 You've built an impressive ${user.currentStreak}-day streak - don't let it slip away!`,
          `🏃‍♂️ Keep the momentum going! Your ${user.currentStreak}-day streak is counting on you.`
        ];

        const randomMessage = encouragementMessages[Math.floor(Math.random() * encouragementMessages.length)];

        await slackApp.client.chat.postMessage({
          channel: user.slackUserId,
          text: randomMessage,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: randomMessage
              }
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: '🚀 Submit Prompt Now'
                  },
                  action_id: 'trigger_submit_command',
                  style: 'primary'
                },
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: '📊 View My Stats'
                  },
                  action_id: 'view_full_status'
                }
              ]
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: '💡 Even a quick prompt or workflow share counts toward your streak!'
                }
              ]
            }
          ]
        });

        sentCount++;
        console.log(`Sent nudge DM to ${user.username} (${user.currentStreak}-day streak at risk)`);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Failed to send nudge DM to ${user.username}:`, error);
      }
    }

    console.log(`Sent ${sentCount} daily nudge DMs`);
    return sentCount;
  }

  /**
   * Format streak data for Slack display
   */
  static formatStreakForSlack(streakData: StreakData): any[] {
    const { currentStreak, longestStreak, streakStatus, daysUntilRisk, streakBonus } = streakData;
    
    const statusEmoji = {
      active: '🔥',
      at_risk: '⚠️',
      broken: '💔',
      new: '🆕'
    };

    const statusText = {
      active: 'Active',
      at_risk: 'At Risk',
      broken: 'Broken',
      new: 'New User'
    };

    let statusMessage = '';
    if (streakStatus === 'at_risk') {
      statusMessage = `\n⏰ Submit something today to maintain your streak!`;
    } else if (streakStatus === 'active' && currentStreak >= 3) {
      statusMessage = `\n🎉 You're earning +${streakBonus} bonus XP!`;
    }

    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${statusEmoji[streakStatus]} *Streak Status: ${statusText[streakStatus]}*`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*🔥 Current Streak*\n${currentStreak} days`
          },
          {
            type: 'mrkdwn',
            text: `*🏆 Longest Streak*\n${longestStreak} days`
          },
          {
            type: 'mrkdwn',
            text: `*💰 Streak Bonus*\n+${streakBonus} XP`
          },
          {
            type: 'mrkdwn',
            text: `*⏱️ Days Until Risk*\n${daysUntilRisk}`
          }
        ]
      },
      ...(statusMessage ? [{
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: statusMessage
          }
        ]
      }] : [])
    ];
  }

  /**
   * Record activity for a user (called when they submit, comment, etc.)
   */
  static async recordActivity(
    userId: number, 
    activityType: 'submission' | 'comment' | 'reaction' = 'submission'
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const { error } = await supabaseAdmin
      .from('user_streaks')
      .insert({
        user_id: userId,
        streak_date: today,
        activity_type: activityType,
        metadata: { recorded_at: new Date().toISOString() }
      })
      .select()
      .single();

    // Ignore duplicate key errors (user already has activity today)
    if (error && !error.message.includes('duplicate key')) {
      console.warn(`Failed to record streak activity: ${error.message}`);
    } else if (!error) {
      console.log(`Recorded ${activityType} activity for user ${userId} on ${today}`);
    }
  }
}