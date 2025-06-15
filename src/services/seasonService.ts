import { supabaseAdmin } from '../database/supabase';
import { Season, User, XPEvent } from '../database/types';
import { XPService } from './xpService';
import { BadgeService } from './badgeService';
import { SecurityService } from './securityService';

export interface SeasonRankings {
  userId: number;
  slackId: string;
  displayName: string;
  seasonXP: number;
  rank: number;
  badges: number;
  submissions: number;
  qualityAverage: number;
}

export interface SeasonStats {
  season: Season;
  totalParticipants: number;
  totalSubmissions: number;
  averageQuality: number;
  topPerformers: SeasonRankings[];
  xpDistribution: {
    range: string;
    count: number;
  }[];
}

export interface SeasonTransition {
  endingSeason: Season;
  newSeason: Season;
  affectedUsers: number;
  xpDecayApplied: number;
  newSeasonBonuses: number;
}

export class SeasonService {
  /**
   * Get the current active season
   */
  static async getCurrentSeason(): Promise<Season | null> {
    try {
      const { data: season, error } = await supabaseAdmin
        .from('seasons')
        .select('*')
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error fetching current season:', error);
        return null;
      }

      return season;
    } catch (error) {
      console.error('Error in getCurrentSeason:', error);
      return null;
    }
  }

  /**
   * Create a new season
   */
  static async createSeason(data: {
    seasonNumber: number;
    startDate: string;
    endDate: string;
    decayFactor?: number;
  }): Promise<{ success: boolean; season?: Season; error?: string }> {
    try {
      const { seasonNumber, startDate, endDate, decayFactor = 0.1 } = data;

      // Validate dates
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (start >= end) {
        return { success: false, error: 'Start date must be before end date' };
      }

      if (start < new Date()) {
        return { success: false, error: 'Start date cannot be in the past' };
      }

      // Check for overlapping seasons
      const { data: overlapping } = await supabaseAdmin
        .from('seasons')
        .select('season_id')
        .or(`and(start_date.lte.${endDate},end_date.gte.${startDate})`)
        .neq('status', 'ended');

      if (overlapping && overlapping.length > 0) {
        return { success: false, error: 'Season dates overlap with existing season' };
      }

      // Create the season
      const { data: season, error } = await supabaseAdmin
        .from('seasons')
        .insert({
          season_number: seasonNumber,
          start_date: startDate,
          end_date: endDate,
          status: 'active',
          decay_factor: decayFactor,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      await SecurityService.logSecurityEvent({
        eventType: 'admin_action',
        description: `Created new season ${seasonNumber} (${startDate} to ${endDate})`,
        riskLevel: 'medium',
        metadata: { seasonId: season.season_id, seasonNumber }
      });

      return { success: true, season };

    } catch (error) {
      console.error('Error creating season:', error);
      return { success: false, error: 'Failed to create season' };
    }
  }

  /**
   * End the current season and apply XP decay
   */
  static async endSeason(seasonId: number): Promise<SeasonTransition | null> {
    try {
      // Get the season to end
      const { data: endingSeason } = await supabaseAdmin
        .from('seasons')
        .select('*')
        .eq('season_id', seasonId)
        .single();

      if (!endingSeason) {
        throw new Error('Season not found');
      }

      // Get all users with XP in this season
      const { data: seasonUsers } = await supabaseAdmin
        .from('users')
        .select('user_id, total_xp, slack_id')
        .gt('total_xp', 0);

      let affectedUsers = 0;
      let totalXpDecayApplied = 0;

      // Apply XP decay to all users
      if (seasonUsers) {
        for (const user of seasonUsers) {
          const decayAmount = Math.floor(user.total_xp * endingSeason.decay_factor);
          const newXP = Math.max(0, user.total_xp - decayAmount);

          await supabaseAdmin
            .from('users')
            .update({ total_xp: newXP })
            .eq('user_id', user.user_id);

          // Log the decay as an XP event
          await supabaseAdmin
            .from('xp_events')
            .insert({
              user_id: user.user_id,
              event_type: 'season_decay',
              xp_value: -decayAmount,
              metadata: {
                season_id: seasonId,
                decay_factor: endingSeason.decay_factor,
                original_xp: user.total_xp
              },
              season_id: seasonId,
              created_at: new Date().toISOString()
            });

          affectedUsers++;
          totalXpDecayApplied += decayAmount;
        }
      }

      // Mark season as ended
      await supabaseAdmin
        .from('seasons')
        .update({ 
          status: 'ended',
          updated_at: new Date().toISOString()
        })
        .eq('season_id', seasonId);

      // Create next season (automatically start 1 day after current ends)
      const nextStartDate = new Date(endingSeason.end_date);
      nextStartDate.setDate(nextStartDate.getDate() + 1);
      
      const nextEndDate = new Date(nextStartDate);
      nextEndDate.setMonth(nextEndDate.getMonth() + 3); // 3 month seasons

      const nextSeasonResult = await this.createSeason({
        seasonNumber: endingSeason.season_number + 1,
        startDate: nextStartDate.toISOString(),
        endDate: nextEndDate.toISOString(),
        decayFactor: endingSeason.decay_factor
      });

      await SecurityService.logSecurityEvent({
        eventType: 'admin_action',
        description: `Ended season ${endingSeason.season_number}, affected ${affectedUsers} users, applied ${totalXpDecayApplied} XP decay`,
        riskLevel: 'high',
        metadata: { 
          seasonId, 
          affectedUsers, 
          totalXpDecayApplied,
          newSeasonId: nextSeasonResult.season?.season_id 
        }
      });

      return {
        endingSeason,
        newSeason: nextSeasonResult.season!,
        affectedUsers,
        xpDecayApplied: totalXpDecayApplied,
        newSeasonBonuses: 0
      };

    } catch (error) {
      console.error('Error ending season:', error);
      return null;
    }
  }

  /**
   * Get season rankings and leaderboard
   */
  static async getSeasonRankings(
    seasonId?: number, 
    limit: number = 50
  ): Promise<SeasonRankings[]> {
    try {
      const currentSeason = seasonId ? 
        await this.getSeasonById(seasonId) : 
        await this.getCurrentSeason();

      if (!currentSeason) {
        return [];
      }

      // Get users with their season XP (from XP events in this season)
      const { data: rankings } = await supabaseAdmin
        .from('users')
        .select(`
          user_id,
          slack_id,
          display_name,
          total_xp
        `)
        .order('total_xp', { ascending: false })
        .limit(limit);

      if (!rankings) {
        return [];
      }

      const seasonRankings: SeasonRankings[] = [];

      for (let i = 0; i < rankings.length; i++) {
        const user = rankings[i];

        // Get season-specific XP
        const { data: seasonXpEvents } = await supabaseAdmin
          .from('xp_events')
          .select('xp_value')
          .eq('user_id', user.user_id)
          .eq('season_id', currentSeason.season_id);

        const seasonXP = seasonXpEvents?.reduce((sum, event) => sum + event.xp_value, 0) || 0;

        // Get user badges count
        const { count: badgesCount } = await supabaseAdmin
          .from('badges')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.user_id);

        // Get submissions count in this season
        const { count: submissionsCount } = await supabaseAdmin
          .from('submissions')
          .select('*', { count: 'exact', head: true })
          .eq('author_id', user.user_id)
          .eq('season_id', currentSeason.season_id);

        // Calculate quality average for this season
        const { data: submissions } = await supabaseAdmin
          .from('submissions')
          .select('clarity_score')
          .eq('author_id', user.user_id)
          .eq('season_id', currentSeason.season_id)
          .not('clarity_score', 'is', null);

        const qualityAverage = submissions && submissions.length > 0 ?
          submissions.reduce((sum, sub) => sum + (sub.clarity_score || 0), 0) / submissions.length :
          0;

        seasonRankings.push({
          userId: user.user_id,
          slackId: user.slack_id,
          displayName: user.display_name || 'Unknown User',
          seasonXP,
          rank: i + 1,
          badges: badgesCount || 0,
          submissions: submissionsCount || 0,
          qualityAverage: Math.round(qualityAverage * 10) / 10
        });
      }

      // Sort by season XP instead of total XP
      seasonRankings.sort((a, b) => b.seasonXP - a.seasonXP);
      
      // Update ranks after sorting
      seasonRankings.forEach((ranking, index) => {
        ranking.rank = index + 1;
      });

      return seasonRankings;

    } catch (error) {
      console.error('Error getting season rankings:', error);
      return [];
    }
  }

  /**
   * Get comprehensive season statistics
   */
  static async getSeasonStats(seasonId?: number): Promise<SeasonStats | null> {
    try {
      const season = seasonId ? 
        await this.getSeasonById(seasonId) : 
        await this.getCurrentSeason();

      if (!season) {
        return null;
      }

      // Get basic stats
      const [
        { count: totalParticipants },
        { count: totalSubmissions },
        { data: submissions }
      ] = await Promise.all([
        supabaseAdmin
          .from('xp_events')
          .select('user_id', { count: 'exact', head: true })
          .eq('season_id', season.season_id),
        
        supabaseAdmin
          .from('submissions')
          .select('*', { count: 'exact', head: true })
          .eq('season_id', season.season_id),
        
        supabaseAdmin
          .from('submissions')
          .select('clarity_score')
          .eq('season_id', season.season_id)
          .not('clarity_score', 'is', null)
      ]);

      const averageQuality = submissions && submissions.length > 0 ?
        submissions.reduce((sum, sub) => sum + (sub.clarity_score || 0), 0) / submissions.length :
        0;

      // Get top performers
      const topPerformers = await this.getSeasonRankings(season.season_id, 10);

      // Get XP distribution
      const { data: xpEvents } = await supabaseAdmin
        .from('xp_events')
        .select('user_id, xp_value')
        .eq('season_id', season.season_id);

      const userXpTotals = new Map<number, number>();
      xpEvents?.forEach(event => {
        const current = userXpTotals.get(event.user_id) || 0;
        userXpTotals.set(event.user_id, current + event.xp_value);
      });

      const xpValues = Array.from(userXpTotals.values());
      const xpDistribution = [
        { range: '0-50', count: xpValues.filter(xp => xp >= 0 && xp <= 50).length },
        { range: '51-100', count: xpValues.filter(xp => xp > 50 && xp <= 100).length },
        { range: '101-250', count: xpValues.filter(xp => xp > 100 && xp <= 250).length },
        { range: '251-500', count: xpValues.filter(xp => xp > 250 && xp <= 500).length },
        { range: '501-1000', count: xpValues.filter(xp => xp > 500 && xp <= 1000).length },
        { range: '1000+', count: xpValues.filter(xp => xp > 1000).length }
      ];

      return {
        season,
        totalParticipants: totalParticipants || 0,
        totalSubmissions: totalSubmissions || 0,
        averageQuality: Math.round(averageQuality * 10) / 10,
        topPerformers,
        xpDistribution
      };

    } catch (error) {
      console.error('Error getting season stats:', error);
      return null;
    }
  }

  /**
   * Get season by ID
   */
  static async getSeasonById(seasonId: number): Promise<Season | null> {
    try {
      const { data: season } = await supabaseAdmin
        .from('seasons')
        .select('*')
        .eq('season_id', seasonId)
        .single();

      return season;
    } catch (error) {
      console.error('Error getting season by ID:', error);
      return null;
    }
  }

  /**
   * Get all seasons with pagination
   */
  static async getAllSeasons(
    limit: number = 20, 
    offset: number = 0
  ): Promise<{ seasons: Season[]; total: number }> {
    try {
      const [
        { data: seasons },
        { count: total }
      ] = await Promise.all([
        supabaseAdmin
          .from('seasons')
          .select('*')
          .order('season_number', { ascending: false })
          .limit(limit)
          .range(offset, offset + limit - 1),
        
        supabaseAdmin
          .from('seasons')
          .select('*', { count: 'exact', head: true })
      ]);

      return {
        seasons: seasons || [],
        total: total || 0
      };

    } catch (error) {
      console.error('Error getting all seasons:', error);
      return { seasons: [], total: 0 };
    }
  }

  /**
   * Pause/Resume a season
   */
  static async updateSeasonStatus(
    seasonId: number, 
    status: 'active' | 'paused' | 'ended'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabaseAdmin
        .from('seasons')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('season_id', seasonId);

      if (error) {
        return { success: false, error: error.message };
      }

      await SecurityService.logSecurityEvent({
        eventType: 'admin_action',
        description: `Updated season ${seasonId} status to ${status}`,
        riskLevel: 'medium',
        metadata: { seasonId, newStatus: status }
      });

      return { success: true };

    } catch (error) {
      console.error('Error updating season status:', error);
      return { success: false, error: 'Failed to update season status' };
    }
  }

  /**
   * Award season end rewards to top performers
   */
  static async awardSeasonRewards(seasonId: number): Promise<{
    success: boolean;
    rewardsAwarded: number;
    error?: string;
  }> {
    try {
      const topPerformers = await this.getSeasonRankings(seasonId, 10);
      let rewardsAwarded = 0;

      for (const performer of topPerformers) {
        let bonusXP = 0;
        let badgeId = '';

        // Award bonuses based on ranking
        if (performer.rank === 1) {
          bonusXP = 500;
          badgeId = 'season_champion';
        } else if (performer.rank <= 3) {
          bonusXP = 250;
          badgeId = 'season_podium';
        } else if (performer.rank <= 10) {
          bonusXP = 100;
          badgeId = 'season_top_ten';
        }

        if (bonusXP > 0) {
          // Award bonus XP
          await supabaseAdmin
            .from('xp_events')
            .insert({
              user_id: performer.userId,
              event_type: 'season_reward',
              xp_value: bonusXP,
              metadata: {
                season_id: seasonId,
                rank: performer.rank,
                reward_type: 'season_end_bonus'
              },
              created_at: new Date().toISOString()
            });

          // Update user's total XP
          await supabaseAdmin
            .from('users')
            .update({ 
              total_xp: supabaseAdmin.rpc('increment_xp', { 
                user_id: performer.userId, 
                amount: bonusXP 
              })
            })
            .eq('user_id', performer.userId);

          rewardsAwarded++;
        }

        // Award special badges (if they exist in badge definitions)
        if (badgeId) {
          const badgeDefinition = BadgeService.getBadgeDefinition(badgeId);
          if (badgeDefinition) {
            await BadgeService.awardBadge(performer.userId, badgeDefinition);
          }
        }
      }

      await SecurityService.logSecurityEvent({
        eventType: 'admin_action',
        description: `Awarded season rewards for season ${seasonId} to ${rewardsAwarded} users`,
        riskLevel: 'medium',
        metadata: { seasonId, rewardsAwarded }
      });

      return { success: true, rewardsAwarded };

    } catch (error) {
      console.error('Error awarding season rewards:', error);
      return { success: false, rewardsAwarded: 0, error: 'Failed to award season rewards' };
    }
  }

  /**
   * Format season statistics for Slack display
   */
  static formatSeasonStatsForSlack(stats: SeasonStats): any[] {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🏆 Season ${stats.season.season_number} Statistics`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Status:* ${stats.season.status === 'active' ? '🟢 Active' : stats.season.status === 'paused' ? '🟡 Paused' : '🔴 Ended'}`
          },
          {
            type: 'mrkdwn',
            text: `*Duration:* ${new Date(stats.season.start_date).toLocaleDateString()} - ${new Date(stats.season.end_date).toLocaleDateString()}`
          },
          {
            type: 'mrkdwn',
            text: `*Participants:* ${stats.totalParticipants}`
          },
          {
            type: 'mrkdwn',
            text: `*Submissions:* ${stats.totalSubmissions}`
          },
          {
            type: 'mrkdwn',
            text: `*Avg Quality:* ${stats.averageQuality}/10`
          },
          {
            type: 'mrkdwn',
            text: `*Decay Factor:* ${(stats.season.decay_factor * 100).toFixed(1)}%`
          }
        ]
      }
    ];

    // Add top performers
    if (stats.topPerformers.length > 0) {
      const topPerformersText = stats.topPerformers
        .slice(0, 5)
        .map((performer, index) => {
          const medal = ['🥇', '🥈', '🥉', '🏅', '🏅'][index] || '🏅';
          return `${medal} ${performer.displayName}: ${performer.seasonXP} XP`;
        })
        .join('\n');

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🏆 Top Performers:*\n${topPerformersText}`
        }
      });
    }

    // Add XP distribution
    const distributionText = stats.xpDistribution
      .filter(dist => dist.count > 0)
      .map(dist => `${dist.range} XP: ${dist.count} users`)
      .join('\n');

    if (distributionText) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*📊 XP Distribution:*\n${distributionText}`
        }
      });
    }

    return blocks;
  }
}