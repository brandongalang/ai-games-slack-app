import { supabaseAdmin } from '../database/supabase';
import { User, Submission, XPEvent } from '../database/types';
import { AnalyticsService } from './analyticsService';
import { LeaderboardService } from './leaderboardService';
import { SeasonService } from './seasonService';
import { LLMService } from './llmService';

export interface DigestData {
  period: {
    startDate: string;
    endDate: string;
    type: 'weekly' | 'monthly' | 'season';
  };
  communityStats: {
    totalSubmissions: number;
    activeUsers: number;
    topCategories: Array<{ category: string; count: number }>;
    avgQualityScore: number;
    totalXpAwarded: number;
  };
  topPerformers: Array<{
    userId: number;
    displayName: string;
    xpEarned: number;
    submissions: number;
    rank: number;
  }>;
  featuredSubmissions: Array<{
    submission: Submission;
    author: User;
    highlights: string[];
  }>;
  achievements: Array<{
    type: 'badge' | 'milestone' | 'streak';
    description: string;
    userCount: number;
  }>;
  trends: {
    xpGrowth: number;
    engagementGrowth: number;
    popularTags: string[];
    emergingThemes: string[];
  };
}

export interface PersonalDigest {
  user: User;
  period: {
    startDate: string;
    endDate: string;
  };
  personalStats: {
    xpEarned: number;
    xpRank: number;
    submissionsCount: number;
    qualityAverage: number;
    streakDays: number;
    badgesEarned: number;
  };
  achievements: Array<{
    type: string;
    title: string;
    description: string;
    xpValue: number;
  }>;
  recommendations: string[];
  goals: {
    nextBadge?: string;
    xpToNextRank: number;
    streakGoal: number;
  };
}

export interface DigestOptions {
  includePersonalizedIntro?: boolean;
  highlightSeasonProgress?: boolean;
  includeMotivationalQuotes?: boolean;
  focusOnCommunityGrowth?: boolean;
  emphasizeQuality?: boolean;
}

export class DigestWriterService {

  /**
   * Generate a weekly community digest using LLM
   */
  static async generateCommunityDigest(
    options: DigestOptions = {}
  ): Promise<{ success: boolean; digest?: string; error?: string }> {
    try {
      console.log('Generating weekly community digest...');
      
      // Get digest data for the past week
      const digestData = await this.collectDigestData('weekly');
      
      if (!digestData) {
        return { success: false, error: 'Failed to collect digest data' };
      }

      // Create LLM prompt for community digest
      const prompt = this.createCommunityDigestPrompt(digestData, options);
      
      // Generate digest using LLM
      const llmResponse = await LLMService.completion([
        {
          role: 'system',
          content: 'You are an expert community manager writing an engaging weekly digest for an AI Games Slack community where members compete by submitting creative AI prompts and workflows.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: 0.8,
        maxTokens: 1500
      });

      // Post-process and format the digest
      const formattedDigest = this.formatDigestForSlack(llmResponse.content, 'community');
      
      console.log('Community digest generated successfully');
      
      return {
        success: true,
        digest: formattedDigest
      };

    } catch (error) {
      console.error('Error generating community digest:', error);
      return { success: false, error: 'Failed to generate community digest' };
    }
  }

  /**
   * Generate a personalized digest for a specific user
   */
  static async generatePersonalDigest(
    userId: number,
    options: DigestOptions = {}
  ): Promise<{ success: boolean; digest?: string; error?: string }> {
    try {
      console.log(`Generating personal digest for user ${userId}...`);
      
      // Get personal digest data
      const personalData = await this.collectPersonalDigestData(userId);
      
      if (!personalData) {
        return { success: false, error: 'Failed to collect personal digest data' };
      }

      // Create LLM prompt for personal digest
      const prompt = this.createPersonalDigestPrompt(personalData, options);
      
      // Generate digest using LLM
      const llmResponse = await LLMService.completion([
        {
          role: 'system',
          content: 'You are writing a personalized weekly summary for a member of the AI Games community.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: 0.7,
        maxTokens: 800
      });

      // Post-process and format the digest
      const formattedDigest = this.formatDigestForSlack(llmResponse.content, 'personal');
      
      console.log(`Personal digest generated successfully for user ${userId}`);
      
      return {
        success: true,
        digest: formattedDigest
      };

    } catch (error) {
      console.error('Error generating personal digest:', error);
      return { success: false, error: 'Failed to generate personal digest' };
    }
  }

  /**
   * Collect comprehensive data for digest generation
   */
  private static async collectDigestData(
    period: 'weekly' | 'monthly' | 'season'
  ): Promise<DigestData | null> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      // Set period boundaries
      switch (period) {
        case 'weekly':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case 'monthly':
          startDate.setMonth(endDate.getMonth() - 1);
          break;
        case 'season':
          // Get current season start date
          const currentSeason = await SeasonService.getCurrentSeason();
          if (currentSeason) {
            startDate.setTime(new Date(currentSeason.start_date).getTime());
          } else {
            startDate.setDate(endDate.getDate() - 30); // Fallback to 30 days
          }
          break;
      }

      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();

      // Collect community stats in parallel
      const [
        submissions,
        xpEvents,
        users,
        topPerformers
      ] = await Promise.all([
        // Get submissions for the period
        supabaseAdmin
          .from('submissions')
          .select(`
            *,
            author:users!inner(user_id, display_name, slack_id)
          `)
          .gte('created_at', startDateStr)
          .lte('created_at', endDateStr)
          .order('created_at', { ascending: false }),

        // Get XP events for the period
        supabaseAdmin
          .from('xp_events')
          .select('*')
          .gte('created_at', startDateStr)
          .lte('created_at', endDateStr),

        // Get active users
        supabaseAdmin
          .from('users')
          .select('*')
          .gte('updated_at', startDateStr),

        // Get top performers for the period
        LeaderboardService.getGlobalLeaderboard(10)
      ]);

      if (!submissions.data || !xpEvents.data || !users.data) {
        throw new Error('Failed to fetch digest data');
      }

      // Calculate community stats
      const communityStats = {
        totalSubmissions: submissions.data.length,
        activeUsers: users.data.length,
        topCategories: this.extractTopCategories(submissions.data),
        avgQualityScore: this.calculateAverageQuality(submissions.data),
        totalXpAwarded: xpEvents.data.reduce((sum, event) => sum + event.xp_value, 0)
      };

      // Select featured submissions (high quality, diverse topics)
      const featuredSubmissions = await this.selectFeaturedSubmissions(submissions.data);

      // Extract achievements and trends
      const achievements = await this.extractPeriodAchievements(startDateStr, endDateStr);
      const trends = await this.analyzeTrends(submissions.data, xpEvents.data);

      return {
        period: {
          startDate: startDateStr,
          endDate: endDateStr,
          type: period
        },
        communityStats,
        topPerformers: topPerformers?.slice(0, 5).map(performer => ({
          userId: performer.user_id,
          displayName: performer.username,
          xpEarned: performer.total_xp,
          submissions: 0, // This would need to be calculated separately
          rank: performer.rank
        })) || [],
        featuredSubmissions,
        achievements,
        trends
      };

    } catch (error) {
      console.error('Error collecting digest data:', error);
      return null;
    }
  }

  /**
   * Collect personal digest data for a specific user
   */
  private static async collectPersonalDigestData(userId: number): Promise<PersonalDigest | null> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7); // Last week

      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();

      // Get user data
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!user) {
        throw new Error('User not found');
      }

      // Get user's XP events for the period
      const { data: xpEvents } = await supabaseAdmin
        .from('xp_events')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr);

      // Get user's submissions for the period
      const { data: submissions } = await supabaseAdmin
        .from('submissions')
        .select('*')
        .eq('author_id', userId)
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr);

      // Calculate personal stats
      const xpEarned = xpEvents?.reduce((sum, event) => sum + event.xp_value, 0) || 0;
      const submissionsCount = submissions?.length || 0;
      const qualityAverage = submissions?.length 
        ? submissions.reduce((sum, sub) => sum + (sub.clarity_score || 0), 0) / submissions.length 
        : 0;

      // Get user's current rank
      const ranking = await LeaderboardService.getUserRanking(user.slack_id);

      // Extract achievements
      const achievements = await this.extractUserAchievements(userId, startDateStr, endDateStr);

      // Generate recommendations and goals
      const recommendations = await this.generatePersonalRecommendations(user, submissions || []);
      const goals = await this.calculateUserGoals(user);

      return {
        user,
        period: { startDate: startDateStr, endDate: endDateStr },
        personalStats: {
          xpEarned,
          xpRank: ranking?.user.rank || 0,
          submissionsCount,
          qualityAverage: Math.round(qualityAverage * 10) / 10,
          streakDays: user.current_streak || 0,
          badgesEarned: user.badges?.length || 0
        },
        achievements,
        recommendations,
        goals
      };

    } catch (error) {
      console.error('Error collecting personal digest data:', error);
      return null;
    }
  }

  /**
   * Create LLM prompt for community digest
   */
  private static createCommunityDigestPrompt(data: DigestData, options: DigestOptions): string {
    const { communityStats, topPerformers, featuredSubmissions, achievements, trends } = data;
    
    return `You are an expert community manager writing an engaging weekly digest for an AI Games Slack community where members compete by submitting creative AI prompts and workflows.

COMMUNITY DATA FOR THIS WEEK:
- ${communityStats.totalSubmissions} new submissions from ${communityStats.activeUsers} active members
- ${communityStats.totalXpAwarded} XP awarded across the community
- Average quality score: ${communityStats.avgQualityScore}/10
- Top categories: ${communityStats.topCategories.map(c => `${c.category} (${c.count})`).join(', ')}

TOP PERFORMERS:
${topPerformers.map((p, i) => `${i + 1}. ${p.displayName}: ${p.xpEarned} XP, ${p.submissions} submissions`).join('\n')}

FEATURED SUBMISSIONS:
${featuredSubmissions.map(f => `- "${f.submission.title || 'Untitled'}" by ${f.author.display_name}: ${f.highlights.join(', ')}`).join('\n')}

COMMUNITY ACHIEVEMENTS:
${achievements.map(a => `- ${a.description} (${a.userCount} users)`).join('\n')}

TRENDS:
- XP growth: ${trends.xpGrowth > 0 ? '+' : ''}${trends.xpGrowth}%
- Popular tags: ${trends.popularTags.join(', ')}
- Emerging themes: ${trends.emergingThemes.join(', ')}

Write an engaging, motivational weekly digest that:
1. Celebrates community achievements and growth
2. Highlights top performers and interesting submissions
3. Encourages participation and friendly competition
4. Uses emojis and Slack-friendly formatting
5. Includes a call-to-action for the upcoming week
6. Maintains an enthusiastic but professional tone

Keep it concise (under 500 words) and structure it with clear sections. Make it feel like a celebration of the community's creativity and progress.`;
  }

  /**
   * Create LLM prompt for personal digest
   */
  private static createPersonalDigestPrompt(data: PersonalDigest, options: DigestOptions): string {
    const { user, personalStats, achievements, recommendations, goals } = data;
    
    return `You are writing a personalized weekly summary for ${user.display_name || 'a member'} of the AI Games community.

PERSONAL STATS THIS WEEK:
- XP earned: ${personalStats.xpEarned} (rank #${personalStats.xpRank})
- Submissions: ${personalStats.submissionsCount}
- Quality average: ${personalStats.qualityAverage}/10
- Current streak: ${personalStats.streakDays} days
- Total badges: ${personalStats.badgesEarned}

ACHIEVEMENTS THIS WEEK:
${achievements.map(a => `- ${a.title}: ${a.description} (+${a.xpValue} XP)`).join('\n') || '- No new achievements this week'}

PERSONALIZED RECOMMENDATIONS:
${recommendations.join('\n- ')}

GOALS FOR NEXT WEEK:
- ${goals.nextBadge ? `Work towards "${goals.nextBadge}" badge` : 'Continue building XP'}
- ${goals.xpToNextRank > 0 ? `Earn ${goals.xpToNextRank} more XP to improve your rank` : 'Maintain your top ranking'}
- ${goals.streakGoal > personalStats.streakDays ? `Extend your streak to ${goals.streakGoal} days` : 'Keep your impressive streak going'}

Write a personalized, encouraging summary that:
1. Celebrates their specific achievements and progress
2. Provides constructive feedback on their performance
3. Offers specific, actionable suggestions for improvement
4. Motivates them to stay engaged and compete
5. Uses a friendly, supportive tone
6. Includes relevant emojis and formatting

Keep it personal and motivating (under 300 words). Make them feel valued and excited about continuing their AI Games journey.`;
  }


  /**
   * Format digest content for Slack
   */
  private static formatDigestForSlack(content: string, type: 'community' | 'personal'): string {
    // Ensure proper Slack formatting
    let formatted = content
      .replace(/\*\*(.*?)\*\*/g, '*$1*') // Convert ** to * for bold
      .replace(/^#+\s/gm, '*') // Convert headers to bold
      .replace(/\n\s*\n\s*\n/g, '\n\n'); // Clean up excessive line breaks

    // Add header emoji based on type
    const headerEmoji = type === 'community' ? '🎮' : '📊';
    const headerText = type === 'community' ? 'Weekly Community Digest' : 'Your Personal Digest';
    
    if (!formatted.startsWith(headerEmoji)) {
      formatted = `${headerEmoji} *${headerText}*\n\n${formatted}`;
    }

    return formatted;
  }

  /**
   * Helper methods for data processing
   */
  private static extractTopCategories(submissions: any[]): Array<{ category: string; count: number }> {
    const categoryCount = new Map<string, number>();
    
    submissions.forEach(sub => {
      sub.tags?.forEach((tag: string) => {
        categoryCount.set(tag, (categoryCount.get(tag) || 0) + 1);
      });
    });

    return Array.from(categoryCount.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private static calculateAverageQuality(submissions: any[]): number {
    const scoresSubmissions = submissions.filter(sub => sub.clarity_score != null);
    if (scoresSubmissions.length === 0) return 0;
    
    const total = scoresSubmissions.reduce((sum, sub) => sum + sub.clarity_score, 0);
    return Math.round((total / scoresSubmissions.length) * 10) / 10;
  }

  private static async selectFeaturedSubmissions(submissions: any[]): Promise<Array<{
    submission: Submission;
    author: User;
    highlights: string[];
  }>> {
    // Select top 3 submissions based on quality scores and diversity
    const featured = submissions
      .filter(sub => sub.clarity_score && sub.clarity_score >= 7)
      .sort((a, b) => (b.clarity_score || 0) - (a.clarity_score || 0))
      .slice(0, 3)
      .map(sub => ({
        submission: sub,
        author: sub.author,
        highlights: [
          `Quality score: ${sub.clarity_score}/10`,
          sub.tags?.length ? `Tags: ${sub.tags.slice(0, 3).join(', ')}` : '',
          sub.submission_type === 'challenge_response' ? 'Challenge response' : ''
        ].filter(Boolean)
      }));

    return featured;
  }

  private static async extractPeriodAchievements(startDate: string, endDate: string): Promise<Array<{
    type: 'badge' | 'milestone' | 'streak';
    description: string;
    userCount: number;
  }>> {
    // Get badge achievements in period
    const { data: badgeEvents } = await supabaseAdmin
      .from('xp_events')
      .select('metadata')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .not('metadata->badge_earned', 'is', null);

    const badgeCount = badgeEvents?.length || 0;

    // Get streak milestones
    const { data: streakEvents } = await supabaseAdmin
      .from('xp_events')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .like('event_type', 'streak_milestone_%');

    const streakCount = streakEvents?.length || 0;

    return [
      { type: 'badge' as const, description: 'New badges earned', userCount: badgeCount },
      { type: 'streak' as const, description: 'Streak milestones achieved', userCount: streakCount }
    ].filter(achievement => achievement.userCount > 0);
  }

  private static async analyzeTrends(submissions: any[], xpEvents: any[]): Promise<{
    xpGrowth: number;
    engagementGrowth: number;
    popularTags: string[];
    emergingThemes: string[];
  }> {
    // Calculate XP growth (simplified)
    const currentXP = xpEvents.reduce((sum, event) => sum + event.xp_value, 0);
    const xpGrowth = currentXP > 0 ? 15 : 0; // Placeholder calculation

    // Extract popular tags
    const tagCount = new Map<string, number>();
    submissions.forEach(sub => {
      sub.tags?.forEach((tag: string) => {
        tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
      });
    });

    const popularTags = Array.from(tagCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);

    return {
      xpGrowth,
      engagementGrowth: submissions.length > 0 ? 10 : 0,
      popularTags,
      emergingThemes: ['AI automation', 'Creative writing', 'Data analysis'] // Placeholder
    };
  }

  private static async extractUserAchievements(
    userId: number, 
    startDate: string, 
    endDate: string
  ): Promise<Array<{ type: string; title: string; description: string; xpValue: number }>> {
    const { data: xpEvents } = await supabaseAdmin
      .from('xp_events')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });

    if (!xpEvents) return [];

    const achievements: Array<{ type: string; title: string; description: string; xpValue: number }> = [];

    // Check for badge achievements
    const badgeEvents = xpEvents.filter(event => event.metadata?.badge_earned);
    badgeEvents.forEach(event => {
      achievements.push({
        type: 'badge',
        title: `New Badge: ${event.metadata.badge_name}`,
        description: `Earned the ${event.metadata.badge_name} badge`,
        xpValue: event.xp_value
      });
    });

    // Check for streak milestones
    const streakEvents = xpEvents.filter(event => event.event_type.includes('streak_milestone'));
    streakEvents.forEach(event => {
      achievements.push({
        type: 'streak',
        title: 'Streak Milestone',
        description: `Reached a ${event.event_type.split('_')[2]}-day streak`,
        xpValue: event.xp_value
      });
    });

    return achievements;
  }

  private static async generatePersonalRecommendations(user: User, submissions: any[]): Promise<string[]> {
    const recommendations: string[] = [];

    // Analyze user's activity patterns
    if (submissions.length === 0) {
      recommendations.push('Submit your first prompt to start earning XP and competing');
    } else if (submissions.length < 3) {
      recommendations.push('Try submitting more prompts to improve your ranking');
    }

    // Check quality scores
    const avgQuality = submissions.length > 0 
      ? submissions.reduce((sum, sub) => sum + (sub.clarity_score || 0), 0) / submissions.length 
      : 0;

    if (avgQuality < 6) {
      recommendations.push('Focus on clarity and detail to improve your quality scores');
    }

    // Check streak
    if (user.current_streak < 3) {
      recommendations.push('Build a daily submission streak to maximize your XP multiplier');
    }

    // Check badges
    if (!user.badges || user.badges.length < 3) {
      recommendations.push('Complete challenges and maintain activity to unlock new badges');
    }

    return recommendations.length > 0 ? recommendations : ['Keep up the great work! You\'re doing awesome.'];
  }

  private static async calculateUserGoals(user: User): Promise<{
    nextBadge?: string;
    xpToNextRank: number;
    streakGoal: number;
  }> {
    // Simplified goal calculation
    return {
      nextBadge: user.badges?.length < 5 ? 'Rising Star' : undefined,
      xpToNextRank: Math.max(0, 100 - (user.total_xp % 100)),
      streakGoal: Math.max(7, user.current_streak + 3)
    };
  }
}