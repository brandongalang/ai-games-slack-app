import { supabase } from '../database/supabase';

export interface UserAnalytics {
  userId: number;
  slackUserId: string;
  username: string;
  totalSubmissions: number;
  totalXP: number;
  currentStreak: number;
  longestStreak: number;
  averageXpPerSubmission: number;
  submissionFrequency: 'daily' | 'weekly' | 'monthly' | 'inactive';
  preferredCategories: string[];
  activityTrend: 'increasing' | 'stable' | 'decreasing';
  weeklyActivity: number[];
  monthlyActivity: number[];
  lastActiveDate: string;
  joinDate: string;
  daysActive: number;
  badges: string[];
}

export interface CommunityAnalytics {
  totalUsers: number;
  activeUsers: number;
  totalSubmissions: number;
  totalXP: number;
  averageXpPerUser: number;
  topCategories: Array<{ category: string; count: number }>;
  activityTrend: 'growing' | 'stable' | 'declining';
  newUsersThisWeek: number;
  submissionsThisWeek: number;
  streakLeaders: Array<{ username: string; streak: number }>;
}

export interface UserActivityTimeline {
  date: string;
  submissions: number;
  xpEarned: number;
  activities: Array<{
    type: 'submission' | 'streak' | 'badge' | 'challenge';
    description: string;
    xp?: number;
    timestamp: string;
  }>;
}

export class AnalyticsService {
  /**
   * Get comprehensive analytics for a specific user
   */
  static async getUserAnalytics(slackUserId: string): Promise<UserAnalytics | null> {
    // Get user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('slack_user_id', slackUserId)
      .single();

    if (userError || !userData) {
      return null;
    }

    // Get submission data
    const { data: submissions, error: submissionError } = await supabase
      .from('submissions')
      .select('*')
      .eq('author_id', userData.user_id)
      .order('created_at', { ascending: false });

    if (submissionError) {
      console.error('Error fetching submissions for analytics:', submissionError);
      return null;
    }

    // Get XP events
    const { data: xpEvents, error: xpError } = await supabase
      .from('xp_events')
      .select('*')
      .eq('user_id', userData.user_id)
      .order('created_at', { ascending: false });

    if (xpError) {
      console.error('Error fetching XP events for analytics:', xpError);
      return null;
    }

    // Get streak data
    const { data: streakData, error: streakError } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', userData.user_id)
      .order('streak_date', { ascending: false });

    if (streakError) {
      console.error('Error fetching streak data for analytics:', streakError);
    }

    // Calculate analytics
    const totalSubmissions = submissions?.length || 0;
    const totalXP = userData.total_xp || 0;
    const currentStreak = userData.current_streak || 0;
    
    // Calculate longest streak
    const longestStreak = this.calculateLongestStreak(streakData || []);
    
    // Calculate average XP per submission
    const averageXpPerSubmission = totalSubmissions > 0 ? Math.round(totalXP / totalSubmissions) : 0;
    
    // Determine submission frequency
    const submissionFrequency = this.calculateSubmissionFrequency(submissions || []);
    
    // Get preferred categories from tags
    const preferredCategories = this.getPreferredCategories(submissions || []);
    
    // Calculate activity trend
    const activityTrend = this.calculateActivityTrend(submissions || []);
    
    // Get weekly and monthly activity
    const weeklyActivity = this.getWeeklyActivity(submissions || []);
    const monthlyActivity = this.getMonthlyActivity(submissions || []);
    
    // Calculate days active
    const joinDate = userData.created_at;
    const lastActiveDate = submissions && submissions.length > 0 
      ? submissions[0].created_at 
      : userData.created_at;
    const daysActive = this.calculateDaysActive(streakData || []);

    return {
      userId: userData.user_id,
      slackUserId: userData.slack_user_id,
      username: userData.username,
      totalSubmissions,
      totalXP,
      currentStreak,
      longestStreak,
      averageXpPerSubmission,
      submissionFrequency,
      preferredCategories,
      activityTrend,
      weeklyActivity,
      monthlyActivity,
      lastActiveDate,
      joinDate,
      daysActive,
      badges: userData.badges || []
    };
  }

  /**
   * Get community-wide analytics
   */
  static async getCommunityAnalytics(): Promise<CommunityAnalytics> {
    // Get user counts
    const { data: allUsers, error: userError } = await supabase
      .from('users')
      .select('*');

    if (userError) {
      console.error('Error fetching users for community analytics:', userError);
      throw new Error('Failed to fetch community analytics');
    }

    // Get all submissions
    const { data: allSubmissions, error: submissionError } = await supabase
      .from('submissions')
      .select('*');

    if (submissionError) {
      console.error('Error fetching submissions for community analytics:', submissionError);
    }

    const users = allUsers || [];
    const submissions = allSubmissions || [];
    
    const totalUsers = users.length;
    const totalSubmissions = submissions.length;
    const totalXP = users.reduce((sum, user) => sum + (user.total_xp || 0), 0);
    const averageXpPerUser = totalUsers > 0 ? Math.round(totalXP / totalUsers) : 0;

    // Calculate active users (submitted in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeUsers = submissions.filter(sub => 
      new Date(sub.created_at) > thirtyDaysAgo
    ).map(sub => sub.author_id)
    .filter((userId, index, arr) => arr.indexOf(userId) === index).length;

    // Get top categories
    const topCategories = this.getTopCategories(submissions);

    // Calculate activity trend
    const activityTrend = this.calculateCommunityActivityTrend(submissions);

    // Get new users this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const newUsersThisWeek = users.filter(user => 
      new Date(user.created_at) > oneWeekAgo
    ).length;

    // Get submissions this week
    const submissionsThisWeek = submissions.filter(sub => 
      new Date(sub.created_at) > oneWeekAgo
    ).length;

    // Get streak leaders
    const streakLeaders = users
      .filter(user => user.current_streak > 0)
      .sort((a, b) => (b.current_streak || 0) - (a.current_streak || 0))
      .slice(0, 5)
      .map(user => ({
        username: user.username,
        streak: user.current_streak || 0
      }));

    return {
      totalUsers,
      activeUsers,
      totalSubmissions,
      totalXP,
      averageXpPerUser,
      topCategories,
      activityTrend,
      newUsersThisWeek,
      submissionsThisWeek,
      streakLeaders
    };
  }

  /**
   * Get user activity timeline for the last 30 days
   */
  static async getUserActivityTimeline(slackUserId: string, days = 30): Promise<UserActivityTimeline[]> {
    // Get user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('user_id')
      .eq('slack_user_id', slackUserId)
      .single();

    if (userError || !userData) {
      return [];
    }

    // Get submissions for the period
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: submissions, error: submissionError } = await supabase
      .from('submissions')
      .select('*')
      .eq('author_id', userData.user_id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    // Get XP events for the period
    const { data: xpEvents, error: xpError } = await supabase
      .from('xp_events')
      .select('*')
      .eq('user_id', userData.user_id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (submissionError || xpError) {
      console.error('Error fetching activity timeline data');
      return [];
    }

    // Group by date
    const timelineMap = new Map<string, UserActivityTimeline>();

    // Process submissions
    (submissions || []).forEach(submission => {
      const date = submission.created_at.split('T')[0];
      if (!timelineMap.has(date)) {
        timelineMap.set(date, {
          date,
          submissions: 0,
          xpEarned: 0,
          activities: []
        });
      }
      
      const timeline = timelineMap.get(date)!;
      timeline.submissions++;
      timeline.activities.push({
        type: 'submission',
        description: `Submitted: ${submission.title || submission.prompt_text.substring(0, 50)}...`,
        timestamp: submission.created_at
      });
    });

    // Process XP events
    (xpEvents || []).forEach(event => {
      const date = event.created_at.split('T')[0];
      if (!timelineMap.has(date)) {
        timelineMap.set(date, {
          date,
          submissions: 0,
          xpEarned: 0,
          activities: []
        });
      }
      
      const timeline = timelineMap.get(date)!;
      timeline.xpEarned += event.xp_value;
      
      if (event.event_type !== 'submission_base') {
        timeline.activities.push({
          type: event.event_type.includes('streak') ? 'streak' : 
                event.event_type.includes('challenge') ? 'challenge' : 'badge',
          description: this.getEventDescription(event),
          xp: event.xp_value,
          timestamp: event.created_at
        });
      }
    });

    return Array.from(timelineMap.values())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /**
   * Format analytics for Slack display
   */
  static formatAnalyticsForSlack(analytics: UserAnalytics): any[] {
    const { 
      username, totalSubmissions, totalXP, currentStreak, longestStreak,
      averageXpPerSubmission, submissionFrequency, preferredCategories,
      activityTrend, daysActive 
    } = analytics;

    const frequencyEmoji = {
      daily: '🔥',
      weekly: '📅',
      monthly: '📊',
      inactive: '😴'
    };

    const trendEmoji = {
      increasing: '📈',
      stable: '➡️',
      decreasing: '📉'
    };

    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📊 *Advanced Analytics for ${username}*`
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
            text: `*📝 Total Submissions*\n${totalSubmissions}`
          },
          {
            type: 'mrkdwn',
            text: `*💰 Total XP*\n${totalXP.toLocaleString()}`
          },
          {
            type: 'mrkdwn',
            text: `*🔥 Current Streak*\n${currentStreak} days`
          },
          {
            type: 'mrkdwn',
            text: `*🏆 Longest Streak*\n${longestStreak} days`
          }
        ]
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*📊 Avg XP/Submission*\n${averageXpPerSubmission}`
          },
          {
            type: 'mrkdwn',
            text: `*${frequencyEmoji[submissionFrequency]} Activity Level*\n${submissionFrequency.charAt(0).toUpperCase() + submissionFrequency.slice(1)}`
          },
          {
            type: 'mrkdwn',
            text: `*${trendEmoji[activityTrend]} Trend*\n${activityTrend.charAt(0).toUpperCase() + activityTrend.slice(1)}`
          },
          {
            type: 'mrkdwn',
            text: `*📅 Days Active*\n${daysActive}`
          }
        ]
      },
      ...(preferredCategories.length > 0 ? [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🏷️ Preferred Categories*\n${preferredCategories.slice(0, 5).join(', ')}`
        }
      }] : []),
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `💡 *Insight:* ${this.generateInsight(analytics)}`
          }
        ]
      }
    ];
  }

  /**
   * Helper methods
   */
  private static calculateLongestStreak(streakData: any[]): number {
    if (!streakData.length) return 0;

    const dates = streakData.map(s => s.streak_date).sort();
    let longestStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i - 1]);
      const currDate = new Date(dates[i]);
      const diffTime = currDate.getTime() - prevDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    return longestStreak;
  }

  private static calculateSubmissionFrequency(submissions: any[]): 'daily' | 'weekly' | 'monthly' | 'inactive' {
    if (submissions.length === 0) return 'inactive';

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentSubmissions = submissions.filter(sub => 
      new Date(sub.created_at) > thirtyDaysAgo
    );

    const submissionsPerDay = recentSubmissions.length / 30;
    
    if (submissionsPerDay >= 0.8) return 'daily';
    if (submissionsPerDay >= 0.2) return 'weekly';
    if (recentSubmissions.length > 0) return 'monthly';
    return 'inactive';
  }

  private static getPreferredCategories(submissions: any[]): string[] {
    const categoryCount = new Map<string, number>();
    
    submissions.forEach(sub => {
      (sub.tags || []).forEach((tag: string) => {
        categoryCount.set(tag, (categoryCount.get(tag) || 0) + 1);
      });
    });

    return Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category]) => category);
  }

  private static calculateActivityTrend(submissions: any[]): 'increasing' | 'stable' | 'decreasing' {
    if (submissions.length < 4) return 'stable';

    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const recentWeek = submissions.filter(sub => 
      new Date(sub.created_at) > oneWeekAgo
    ).length;
    const previousWeek = submissions.filter(sub => 
      new Date(sub.created_at) > twoWeeksAgo && new Date(sub.created_at) <= oneWeekAgo
    ).length;

    if (recentWeek > previousWeek) return 'increasing';
    if (recentWeek < previousWeek) return 'decreasing';
    return 'stable';
  }

  private static getWeeklyActivity(submissions: any[]): number[] {
    const weeks = Array(7).fill(0);
    const today = new Date();
    
    submissions.forEach(sub => {
      const subDate = new Date(sub.created_at);
      const daysAgo = Math.floor((today.getTime() - subDate.getTime()) / (1000 * 60 * 60 * 24));
      const weekIndex = Math.floor(daysAgo / 7);
      if (weekIndex < 7) {
        weeks[weekIndex]++;
      }
    });

    return weeks.reverse();
  }

  private static getMonthlyActivity(submissions: any[]): number[] {
    const months = Array(12).fill(0);
    const today = new Date();
    
    submissions.forEach(sub => {
      const subDate = new Date(sub.created_at);
      const monthsAgo = (today.getFullYear() - subDate.getFullYear()) * 12 + (today.getMonth() - subDate.getMonth());
      if (monthsAgo < 12) {
        months[11 - monthsAgo]++;
      }
    });

    return months;
  }

  private static calculateDaysActive(streakData: any[]): number {
    return new Set(streakData.map(s => s.streak_date)).size;
  }

  private static getTopCategories(submissions: any[]): Array<{ category: string; count: number }> {
    const categoryCount = new Map<string, number>();
    
    submissions.forEach(sub => {
      (sub.tags || []).forEach((tag: string) => {
        categoryCount.set(tag, (categoryCount.get(tag) || 0) + 1);
      });
    });

    return Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([category, count]) => ({ category, count }));
  }

  private static calculateCommunityActivityTrend(submissions: any[]): 'growing' | 'stable' | 'declining' {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const recentWeek = submissions.filter(sub => 
      new Date(sub.created_at) > oneWeekAgo
    ).length;
    const previousWeek = submissions.filter(sub => 
      new Date(sub.created_at) > twoWeeksAgo && new Date(sub.created_at) <= oneWeekAgo
    ).length;

    const growthRate = previousWeek > 0 ? (recentWeek - previousWeek) / previousWeek : 0;
    
    if (growthRate > 0.1) return 'growing';
    if (growthRate < -0.1) return 'declining';
    return 'stable';
  }

  private static getEventDescription(event: any): string {
    const eventTypes: { [key: string]: string } = {
      'first_submission_bonus': 'Earned first submission bonus',
      'streak_bonus': 'Maintained daily streak',
      'challenge_bonus': 'Completed weekly challenge',
      'remix_bonus': 'Created a remix'
    };
    
    return eventTypes[event.event_type] || `Earned ${event.xp_value} XP`;
  }

  private static generateInsight(analytics: UserAnalytics): string {
    const { submissionFrequency, activityTrend, currentStreak, totalSubmissions } = analytics;
    
    if (currentStreak >= 7) {
      return `Amazing ${currentStreak}-day streak! You're on fire! 🔥`;
    }
    
    if (activityTrend === 'increasing') {
      return 'Your activity is trending upward - keep up the momentum! 📈';
    }
    
    if (submissionFrequency === 'daily') {
      return 'You\'re a daily contributor - the community appreciates your consistency! ⭐';
    }
    
    if (totalSubmissions >= 50) {
      return 'You\'re a power user with tons of valuable contributions! 🏆';
    }
    
    if (totalSubmissions === 1) {
      return 'Welcome to AI Games! Keep sharing to climb the leaderboard! 🚀';
    }
    
    return 'Keep submitting great prompts to boost your stats! 💪';
  }
}