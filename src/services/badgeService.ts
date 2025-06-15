import { supabaseAdmin } from '../database/supabase';
import { BadgeDefinition, Badge, BadgeProgress, BadgeCriteria } from '../database/types';
import { XPService } from './xpService';

export class BadgeService {
  // Comprehensive badge definitions
  private static readonly BADGE_DEFINITIONS: BadgeDefinition[] = [
    // XP Achievement Badges
    {
      id: 'first_steps',
      name: 'First Steps',
      description: 'Earn your first 10 XP',
      emoji: '👶',
      category: 'progression',
      rarity: 'common',
      criteria: { type: 'xp_total', threshold: 10, timeframe: 'all_time' },
      xp_bonus: 5,
      is_hidden: false
    },
    {
      id: 'rising_star',
      name: 'Rising Star',
      description: 'Earn 100 XP',
      emoji: '⭐',
      category: 'progression',
      rarity: 'common',
      criteria: { type: 'xp_total', threshold: 100, timeframe: 'all_time' },
      xp_bonus: 10,
      is_hidden: false
    },
    {
      id: 'xp_warrior',
      name: 'XP Warrior',
      description: 'Earn 500 XP',
      emoji: '⚔️',
      category: 'progression',
      rarity: 'rare',
      criteria: { type: 'xp_total', threshold: 500, timeframe: 'all_time' },
      xp_bonus: 25,
      is_hidden: false
    },
    {
      id: 'xp_legend',
      name: 'XP Legend',
      description: 'Earn 2000 XP',
      emoji: '👑',
      category: 'progression',
      rarity: 'epic',
      criteria: { type: 'xp_total', threshold: 2000, timeframe: 'all_time' },
      xp_bonus: 50,
      is_hidden: false
    },
    {
      id: 'xp_master',
      name: 'XP Master',
      description: 'Earn 5000 XP',
      emoji: '💎',
      category: 'progression',
      rarity: 'legendary',
      criteria: { type: 'xp_total', threshold: 5000, timeframe: 'all_time' },
      xp_bonus: 100,
      is_hidden: false
    },

    // Submission Achievement Badges
    {
      id: 'first_prompt',
      name: 'First Prompt',
      description: 'Submit your first prompt',
      emoji: '📝',
      category: 'submissions',
      rarity: 'common',
      criteria: { type: 'submissions_count', threshold: 1, timeframe: 'all_time' },
      xp_bonus: 5,
      is_hidden: false
    },
    {
      id: 'prolific_writer',
      name: 'Prolific Writer',
      description: 'Submit 10 prompts',
      emoji: '✍️',
      category: 'submissions',
      rarity: 'common',
      criteria: { type: 'submissions_count', threshold: 10, timeframe: 'all_time' },
      xp_bonus: 15,
      is_hidden: false
    },
    {
      id: 'prompt_machine',
      name: 'Prompt Machine',
      description: 'Submit 50 prompts',
      emoji: '🤖',
      category: 'submissions',
      rarity: 'rare',
      criteria: { type: 'submissions_count', threshold: 50, timeframe: 'all_time' },
      xp_bonus: 50,
      is_hidden: false
    },
    {
      id: 'prompt_master',
      name: 'Prompt Master',
      description: 'Submit 100 prompts',
      emoji: '🎭',
      category: 'submissions',
      rarity: 'epic',
      criteria: { type: 'submissions_count', threshold: 100, timeframe: 'all_time' },
      xp_bonus: 100,
      is_hidden: false
    },

    // Streak Achievement Badges
    {
      id: 'consistency',
      name: 'Consistency',
      description: 'Maintain a 3-day streak',
      emoji: '🔥',
      category: 'streaks',
      rarity: 'common',
      criteria: { type: 'streak_days', threshold: 3, timeframe: 'all_time' },
      xp_bonus: 10,
      is_hidden: false
    },
    {
      id: 'dedicated',
      name: 'Dedicated',
      description: 'Maintain a 7-day streak',
      emoji: '💪',
      category: 'streaks',
      rarity: 'rare',
      criteria: { type: 'streak_days', threshold: 7, timeframe: 'all_time' },
      xp_bonus: 25,
      is_hidden: false
    },
    {
      id: 'unstoppable',
      name: 'Unstoppable',
      description: 'Maintain a 30-day streak',
      emoji: '🚀',
      category: 'streaks',
      rarity: 'epic',
      criteria: { type: 'streak_days', threshold: 30, timeframe: 'all_time' },
      xp_bonus: 100,
      is_hidden: false
    },
    {
      id: 'legendary_streak',
      name: 'Legendary Streak',
      description: 'Maintain a 100-day streak',
      emoji: '🌟',
      category: 'streaks',
      rarity: 'legendary',
      criteria: { type: 'streak_days', threshold: 100, timeframe: 'all_time' },
      xp_bonus: 250,
      is_hidden: false
    },

    // Quality Achievement Badges
    {
      id: 'quality_focused',
      name: 'Quality Focused',
      description: 'Maintain 7.0+ average quality score',
      emoji: '✨',
      category: 'quality',
      rarity: 'rare',
      criteria: { type: 'quality_average', threshold: 7.0, timeframe: 'all_time' },
      xp_bonus: 30,
      is_hidden: false
    },
    {
      id: 'perfectionist',
      name: 'Perfectionist',
      description: 'Maintain 8.5+ average quality score',
      emoji: '💫',
      category: 'quality',
      rarity: 'epic',
      criteria: { type: 'quality_average', threshold: 8.5, timeframe: 'all_time' },
      xp_bonus: 75,
      is_hidden: false
    },
    {
      id: 'quality_master',
      name: 'Quality Master',
      description: 'Maintain 9.0+ average quality score',
      emoji: '🏆',
      category: 'quality',
      rarity: 'legendary',
      criteria: { type: 'quality_average', threshold: 9.0, timeframe: 'all_time' },
      xp_bonus: 150,
      is_hidden: false
    },

    // Community Achievement Badges
    {
      id: 'helpful_commenter',
      name: 'Helpful Commenter',
      description: 'Write 10 helpful comments',
      emoji: '💬',
      category: 'community',
      rarity: 'common',
      criteria: { type: 'comments_helpful', threshold: 10, timeframe: 'all_time' },
      xp_bonus: 20,
      is_hidden: false
    },
    {
      id: 'community_favorite',
      name: 'Community Favorite',
      description: 'Get 25 favorites on your prompts',
      emoji: '❤️',
      category: 'community',
      rarity: 'rare',
      criteria: { type: 'library_favorites', threshold: 25, timeframe: 'all_time' },
      xp_bonus: 40,
      is_hidden: false
    },

    // Special Achievement Badges
    {
      id: 'early_adopter',
      name: 'Early Adopter',
      description: 'One of the first 100 users',
      emoji: '🏁',
      category: 'special',
      rarity: 'epic',
      criteria: { type: 'special', special_condition: 'early_user' },
      xp_bonus: 50,
      is_hidden: false
    },
    {
      id: 'beta_tester',
      name: 'Beta Tester',
      description: 'Helped test new features',
      emoji: '🧪',
      category: 'special',
      rarity: 'rare',
      criteria: { type: 'special', special_condition: 'beta_participation' },
      xp_bonus: 30,
      is_hidden: false
    },
    {
      id: 'featured_creator',
      name: 'Featured Creator',
      description: 'Had a prompt featured in the library',
      emoji: '🌟',
      category: 'special',
      rarity: 'epic',
      criteria: { type: 'special', special_condition: 'featured_prompt' },
      xp_bonus: 75,
      is_hidden: false
    },

    // Seasonal Badges
    {
      id: 'season_champion',
      name: 'Season Champion',
      description: 'Finish #1 in a season',
      emoji: '🥇',
      category: 'seasonal',
      rarity: 'legendary',
      criteria: { type: 'special', special_condition: 'season_winner' },
      xp_bonus: 500,
      is_hidden: false
    },
    {
      id: 'season_top_10',
      name: 'Season Elite',
      description: 'Finish top 10 in a season',
      emoji: '🎖️',
      category: 'seasonal',
      rarity: 'epic',
      criteria: { type: 'special', special_condition: 'season_top_10' },
      xp_bonus: 100,
      is_hidden: false
    },
    {
      id: 'season_podium',
      name: 'Season Podium',
      description: 'Finish top 3 in a season',
      emoji: '🥉',
      category: 'seasonal',
      rarity: 'epic',
      criteria: { type: 'special', special_condition: 'season_podium' },
      xp_bonus: 250,
      is_hidden: false
    },
    {
      id: 'season_top_ten',
      name: 'Season Top Ten',
      description: 'Finish in the top 10 of a season',
      emoji: '🏅',
      category: 'seasonal',
      rarity: 'rare',
      criteria: { type: 'special', special_condition: 'season_top_ten' },
      xp_bonus: 100,
      is_hidden: false
    }
  ];

  /**
   * Get all badge definitions
   */
  static getBadgeDefinitions(): BadgeDefinition[] {
    return this.BADGE_DEFINITIONS;
  }

  /**
   * Get badge definition by ID
   */
  static getBadgeDefinition(badgeId: string): BadgeDefinition | null {
    return this.BADGE_DEFINITIONS.find(badge => badge.id === badgeId) || null;
  }

  /**
   * Check and award badges for a user
   */
  static async checkAndAwardBadges(userId: number): Promise<Badge[]> {
    const newBadges: Badge[] = [];

    try {
      // Get user's current badges
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('badges')
        .eq('user_id', userId)
        .single();

      if (!user) return newBadges;

      const currentBadgeIds = (user.badges || []).map((badge: Badge) => badge.id);

      // Check each badge definition
      for (const badgeDefinition of this.BADGE_DEFINITIONS) {
        // Skip if user already has this badge
        if (currentBadgeIds.includes(badgeDefinition.id)) continue;

        // Check prerequisites
        if (badgeDefinition.prerequisites) {
          const hasAllPrereqs = badgeDefinition.prerequisites.every(prereqId =>
            currentBadgeIds.includes(prereqId)
          );
          if (!hasAllPrereqs) continue;
        }

        // Check if user meets criteria
        const meetscriteria = await this.checkBadgeCriteria(userId, badgeDefinition.criteria);
        
        if (meetscriteria) {
          const newBadge: Badge = {
            id: badgeDefinition.id,
            name: badgeDefinition.name,
            description: badgeDefinition.description,
            emoji: badgeDefinition.emoji,
            category: badgeDefinition.category,
            rarity: badgeDefinition.rarity,
            xp_bonus: badgeDefinition.xp_bonus,
            earned_at: new Date().toISOString()
          };

          newBadges.push(newBadge);
        }
      }

      // Award new badges
      if (newBadges.length > 0) {
        await this.awardBadges(userId, newBadges);
        
        // Award XP bonuses
        for (const badge of newBadges) {
          if (badge.xp_bonus && badge.xp_bonus > 0) {
            await XPService.awardXP({
              userId,
              eventType: 'SUBMISSION_BASE', // Using existing event type for badge XP
              xpValue: badge.xp_bonus,
              metadata: {
                badge_earned: badge.id,
                badge_name: badge.name,
                badge_rarity: badge.rarity
              }
            });
          }
        }
      }

      return newBadges;
    } catch (error) {
      console.error('Error checking and awarding badges:', error);
      return [];
    }
  }

  /**
   * Check if user meets specific badge criteria
   */
  private static async checkBadgeCriteria(userId: number, criteria: BadgeCriteria): Promise<boolean> {
    try {
      switch (criteria.type) {
        case 'xp_total':
          return await this.checkXPTotal(userId, criteria.threshold!, criteria.timeframe);

        case 'submissions_count':
          return await this.checkSubmissionsCount(userId, criteria.threshold!, criteria.timeframe);

        case 'streak_days':
          return await this.checkStreakDays(userId, criteria.threshold!);

        case 'quality_average':
          return await this.checkQualityAverage(userId, criteria.threshold!, criteria.timeframe);

        case 'library_favorites':
          return await this.checkLibraryFavorites(userId, criteria.threshold!);

        case 'comments_helpful':
          return await this.checkHelpfulComments(userId, criteria.threshold!);

        case 'special':
          return await this.checkSpecialCondition(userId, criteria.special_condition!);

        default:
          return false;
      }
    } catch (error) {
      console.error('Error checking badge criteria:', error);
      return false;
    }
  }

  /**
   * Check XP total criteria
   */
  private static async checkXPTotal(userId: number, threshold: number, timeframe?: string): Promise<boolean> {
    if (timeframe === 'season') {
      // Get current season XP
      const { data: seasonXP } = await supabaseAdmin
        .from('xp_events')
        .select('xp_value')
        .eq('user_id', userId)
        .not('season_id', 'is', null);
      
      const total = seasonXP?.reduce((sum, event) => sum + event.xp_value, 0) || 0;
      return total >= threshold;
    } else {
      // Get total XP
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('total_xp')
        .eq('user_id', userId)
        .single();
      
      return (user?.total_xp || 0) >= threshold;
    }
  }

  /**
   * Check submissions count criteria
   */
  private static async checkSubmissionsCount(userId: number, threshold: number, timeframe?: string): Promise<boolean> {
    let query = supabaseAdmin
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', userId);

    if (timeframe === 'season') {
      query = query.not('season_id', 'is', null);
    } else if (timeframe === 'month') {
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      query = query.gte('created_at', oneMonthAgo.toISOString());
    }

    const { count } = await query;
    return (count || 0) >= threshold;
  }

  /**
   * Check streak days criteria
   */
  private static async checkStreakDays(userId: number, threshold: number): Promise<boolean> {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('current_streak')
      .eq('user_id', userId)
      .single();

    return (user?.current_streak || 0) >= threshold;
  }

  /**
   * Check quality average criteria
   */
  private static async checkQualityAverage(userId: number, threshold: number, timeframe?: string): Promise<boolean> {
    let query = supabaseAdmin
      .from('submissions')
      .select('clarity_score')
      .eq('author_id', userId)
      .not('clarity_score', 'is', null);

    if (timeframe === 'season') {
      query = query.not('season_id', 'is', null);
    }

    const { data: submissions } = await query;
    
    if (!submissions || submissions.length === 0) return false;

    const average = submissions.reduce((sum, sub) => sum + (sub.clarity_score || 0), 0) / submissions.length;
    return average >= threshold;
  }

  /**
   * Check library favorites criteria
   */
  private static async checkLibraryFavorites(userId: number, threshold: number): Promise<boolean> {
    // Get user's submissions in library
    const { data: libraryItems } = await supabaseAdmin
      .from('prompt_library_items')
      .select(`
        library_item_id,
        submission:submissions!inner(author_id)
      `)
      .eq('submission.author_id', userId);

    if (!libraryItems || libraryItems.length === 0) return false;

    // Count total favorites across all user's library items
    const libraryItemIds = libraryItems.map(item => item.library_item_id);
    
    const { count } = await supabaseAdmin
      .from('user_favorites')
      .select('*', { count: 'exact', head: true })
      .in('library_item_id', libraryItemIds);

    return (count || 0) >= threshold;
  }

  /**
   * Check helpful comments criteria
   */
  private static async checkHelpfulComments(userId: number, threshold: number): Promise<boolean> {
    const { count } = await supabaseAdmin
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', userId)
      .eq('is_helpful', true);

    return (count || 0) >= threshold;
  }

  /**
   * Check special condition criteria
   */
  private static async checkSpecialCondition(userId: number, condition: string): Promise<boolean> {
    switch (condition) {
      case 'early_user':
        // Check if user is among first 100 users
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('user_id, created_at')
          .eq('user_id', userId)
          .single();

        if (!user) return false;

        const { count } = await supabaseAdmin
          .from('users')
          .select('*', { count: 'exact', head: true })
          .lte('created_at', user.created_at);

        return (count || 0) <= 100;

      case 'featured_prompt':
        // Check if user has a featured prompt in library
        const { count: featuredCount } = await supabaseAdmin
          .from('prompt_library_items')
          .select('*', { count: 'exact', head: true })
          .eq('is_featured', true)
          .eq('submission.author_id', userId);

        return (featuredCount || 0) > 0;

      case 'beta_participation':
        // This would be manually awarded or based on specific beta activity
        return false; // Implement based on your beta testing criteria

      case 'season_winner':
      case 'season_podium':
      case 'season_top_10':
      case 'season_top_ten':
        // These are manually awarded at season end
        return false;

      default:
        return false;
    }
  }

  /**
   * Award a specific badge to a user (public method for manual awarding)
   */
  static async awardBadge(userId: number, badgeDefinition: BadgeDefinition): Promise<boolean> {
    try {
      // Check if user already has this badge
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('badges')
        .eq('user_id', userId)
        .single();

      if (!user) return false;

      const currentBadgeIds = (user.badges || []).map((badge: Badge) => badge.id);
      
      if (currentBadgeIds.includes(badgeDefinition.id)) {
        console.log(`User ${userId} already has badge ${badgeDefinition.id}`);
        return false;
      }

      const newBadge: Badge = {
        id: badgeDefinition.id,
        name: badgeDefinition.name,
        description: badgeDefinition.description,
        emoji: badgeDefinition.emoji,
        category: badgeDefinition.category,
        rarity: badgeDefinition.rarity,
        xp_bonus: badgeDefinition.xp_bonus,
        earned_at: new Date().toISOString()
      };

      await this.awardBadges(userId, [newBadge]);
      
      // Award XP bonus
      if (badgeDefinition.xp_bonus && badgeDefinition.xp_bonus > 0) {
        const { XPService } = await import('./xpService');
        await XPService.awardXP({
          userId,
          eventType: 'SUBMISSION_BASE', // Using existing event type for badge XP
          xpValue: badgeDefinition.xp_bonus,
          metadata: {
            badge_earned: badgeDefinition.id,
            badge_name: badgeDefinition.name,
            badge_rarity: badgeDefinition.rarity
          }
        });
      }

      console.log(`Manually awarded badge ${badgeDefinition.name} to user ${userId}`);
      return true;

    } catch (error) {
      console.error('Error awarding badge:', error);
      return false;
    }
  }

  /**
   * Award badges to user
   */
  private static async awardBadges(userId: number, badges: Badge[]): Promise<void> {
    try {
      // Get current badges
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('badges')
        .eq('user_id', userId)
        .single();

      const currentBadges = user?.badges || [];
      const updatedBadges = [...currentBadges, ...badges];

      // Update user badges
      await supabaseAdmin
        .from('users')
        .update({ badges: updatedBadges })
        .eq('user_id', userId);

      console.log(`Awarded ${badges.length} badges to user ${userId}:`, badges.map(b => b.name));
    } catch (error) {
      console.error('Error awarding badges:', error);
      throw error;
    }
  }

  /**
   * Get user's badges with progress on unearned badges
   */
  static async getUserBadgesWithProgress(userId: number): Promise<{
    earned: Badge[];
    available: Array<BadgeDefinition & { progress?: number; progressText?: string }>;
  }> {
    try {
      // Get user's current badges
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('badges')
        .eq('user_id', userId)
        .single();

      const earnedBadges = user?.badges || [];
      const earnedBadgeIds = earnedBadges.map((badge: Badge) => badge.id);

      // Get available badges (not yet earned)
      const availableBadges = this.BADGE_DEFINITIONS.filter(
        badge => !earnedBadgeIds.includes(badge.id) && !badge.is_hidden
      );

      // Calculate progress for available badges
      const availableWithProgress = await Promise.all(
        availableBadges.map(async (badge) => {
          const progress = await this.calculateBadgeProgress(userId, badge);
          return {
            ...badge,
            progress: progress.current,
            progressText: `${progress.current}/${progress.required}`
          };
        })
      );

      return {
        earned: earnedBadges,
        available: availableWithProgress
      };
    } catch (error) {
      console.error('Error getting user badges with progress:', error);
      return { earned: [], available: [] };
    }
  }

  /**
   * Calculate progress towards a specific badge
   */
  private static async calculateBadgeProgress(userId: number, badge: BadgeDefinition): Promise<{
    current: number;
    required: number;
  }> {
    const criteria = badge.criteria;
    let current = 0;
    const required = criteria.threshold || 1;

    try {
      switch (criteria.type) {
        case 'xp_total':
          const { data: user } = await supabaseAdmin
            .from('users')
            .select('total_xp')
            .eq('user_id', userId)
            .single();
          current = user?.total_xp || 0;
          break;

        case 'submissions_count':
          const { count: submissionCount } = await supabaseAdmin
            .from('submissions')
            .select('*', { count: 'exact', head: true })
            .eq('author_id', userId);
          current = submissionCount || 0;
          break;

        case 'streak_days':
          const { data: streakUser } = await supabaseAdmin
            .from('users')
            .select('current_streak')
            .eq('user_id', userId)
            .single();
          current = streakUser?.current_streak || 0;
          break;

        case 'comments_helpful':
          const { count: helpfulCount } = await supabaseAdmin
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('author_id', userId)
            .eq('is_helpful', true);
          current = helpfulCount || 0;
          break;

        // Add other criteria types as needed
        default:
          current = 0;
      }
    } catch (error) {
      console.error('Error calculating badge progress:', error);
    }

    return {
      current: Math.min(current, required),
      required
    };
  }

  /**
   * Get user's earned badges
   */
  static async getUserBadges(userId: number): Promise<Badge[]> {
    try {
      const { data: badges, error } = await supabaseAdmin
        .from('badges')
        .select('*')
        .eq('user_id', userId)
        .order('earned_at', { ascending: true });

      if (error) {
        console.error('Error fetching user badges:', error);
        return [];
      }

      return badges || [];
    } catch (error) {
      console.error('Error getting user badges:', error);
      return [];
    }
  }

  /**
   * Get badge progress for user
   */
  static async getBadgeProgress(userId: number): Promise<BadgeProgress[]> {
    try {
      const progress: BadgeProgress[] = [];
      
      // Get available badges that user hasn't earned yet
      const earnedBadges = await this.getUserBadges(userId);
      const earnedBadgeIds = earnedBadges.map(badge => badge.id);
      
      for (const badgeDefinition of this.BADGE_DEFINITIONS) {
        if (!earnedBadgeIds.includes(badgeDefinition.id)) {
          const progressInfo = await this.calculateBadgeProgress(userId, badgeDefinition);
          
          progress.push({
            badge_id: badgeDefinition.id,
            user_id: userId,
            current_progress: progressInfo.current,
            required_progress: progressInfo.required,
            is_completed: false,
            last_updated: new Date().toISOString()
          });
        }
      }
      
      return progress;
    } catch (error) {
      console.error('Error getting badge progress:', error);
      return [];
    }
  }

  /**
   * Update user's Slack profile status with latest badge
   */
  static async updateSlackProfile(userId: number, slackUserId: string): Promise<void> {
    try {
      const userBadges = await this.getUserBadges(userId);
      
      if (userBadges.length === 0) {
        return; // No badges to display
      }
      
      // Get the most recent badge
      const latestBadge = userBadges[userBadges.length - 1];
      const badgeDefinition = this.getBadgeDefinition(latestBadge.id);
      
      if (!badgeDefinition) {
        return;
      }
      
      // Create status text
      const statusText = `${badgeDefinition.emoji} ${badgeDefinition.name} - AI Games`;
      const statusEmoji = badgeDefinition.emoji;
      
      // Note: This would require additional Slack app permissions and setup
      // For now, we'll log what the update would be
      console.log(`Would update Slack profile for ${slackUserId}:`, {
        statusText,
        statusEmoji,
        badgeName: badgeDefinition.name
      });
      
      // TODO: Implement actual Slack profile update when permissions are available
      // This requires the users.profile:write scope and user token
      
    } catch (error) {
      console.error('Error updating Slack profile:', error);
    }
  }

  /**
   * Format badges for Slack display
   */
  static formatBadgesForSlack(
    earnedBadges: Badge[],
    availableBadges: Array<BadgeDefinition & { progress?: number; progressText?: string }>,
    showProgress = false
  ): any[] {
    const blocks = [];

    // Earned badges section
    if (earnedBadges.length > 0) {
      const badgesByRarity = earnedBadges.reduce((acc, badge) => {
        const rarity = badge.rarity || 'common';
        if (!acc[rarity]) acc[rarity] = [];
        acc[rarity].push(badge);
        return acc;
      }, {} as Record<string, Badge[]>);

      const rarityOrder: Array<'legendary' | 'epic' | 'rare' | 'common'> = ['legendary', 'epic', 'rare', 'common'];
      const rarityEmojis = {
        legendary: '💎',
        epic: '🟣',
        rare: '🔵',
        common: '⚪'
      };

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🏆 *Your Badges* (${earnedBadges.length} earned)`
        }
      });

      rarityOrder.forEach(rarity => {
        if (badgesByRarity[rarity]) {
          const badgeText = badgesByRarity[rarity]
            .map(badge => `${badge.emoji} ${badge.name}`)
            .join(' • ');
          
          blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${rarityEmojis[rarity]} **${rarity.toUpperCase()}:** ${badgeText}`
            }
          });
        }
      });
    } else {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '🏆 *Your Badges*\nNo badges earned yet. Complete challenges to unlock your first badge!'
        }
      });
    }

    // Progress section
    if (showProgress && availableBadges.length > 0) {
      blocks.push({
        type: 'divider'
      });

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '📈 *Badge Progress*'
        }
      });

      // Show next 5 closest badges
      const sortedByProgress = availableBadges
        .filter(badge => badge.progress !== undefined)
        .sort((a, b) => {
          const aPercent = ((a.progress || 0) / (a.criteria.threshold || 1)) * 100;
          const bPercent = ((b.progress || 0) / (b.criteria.threshold || 1)) * 100;
          return bPercent - aPercent;
        })
        .slice(0, 5);

      sortedByProgress.forEach(badge => {
        const percent = Math.floor(((badge.progress || 0) / (badge.criteria.threshold || 1)) * 100);
        const progressBar = '█'.repeat(Math.floor(percent / 10)) + '░'.repeat(10 - Math.floor(percent / 10));
        
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${badge.emoji} **${badge.name}**\n${progressBar} ${percent}% (${badge.progressText})`
          }
        });
      });
    }

    return blocks;
  }
}