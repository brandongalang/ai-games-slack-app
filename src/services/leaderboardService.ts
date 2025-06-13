import { supabase } from '../database/supabase';
import { User } from '../database/types';

export interface LeaderboardEntry {
  user_id: number;
  slack_user_id: string;
  username: string;
  total_xp: number;
  current_streak: number;
  rank: number;
  season_rank?: number;
  badges?: string[];
}

export interface UserRanking {
  user: LeaderboardEntry;
  totalUsers: number;
  percentile: number;
  xpUntilNextRank?: number;
  nextRankUser?: LeaderboardEntry;
}

export class LeaderboardService {
  /**
   * Get the global leaderboard with specified limit
   */
  static async getGlobalLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
    const { data, error } = await supabase.rpc('get_leaderboard', {
      limit_count: limit
    });

    if (error) {
      console.error('Error fetching leaderboard:', error);
      throw new Error('Failed to fetch leaderboard');
    }

    return data || [];
  }

  /**
   * Get the current season leaderboard
   */
  static async getSeasonLeaderboard(seasonId?: number, limit = 10): Promise<LeaderboardEntry[]> {
    // For now, use global leaderboard. In the future, we can filter by season
    // when season-specific XP tracking is implemented
    return this.getGlobalLeaderboard(limit);
  }

  /**
   * Get a user's current ranking and stats
   */
  static async getUserRanking(slackUserId: string): Promise<UserRanking | null> {
    // First get the user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('slack_user_id', slackUserId)
      .single();

    if (userError || !userData) {
      console.error('Error fetching user:', userError);
      return null;
    }

    // Get full leaderboard to determine rank
    const { data: leaderboardData, error: leaderboardError } = await supabase.rpc('get_leaderboard', {
      limit_count: 1000 // Get all users to calculate accurate rank
    });

    if (leaderboardError) {
      console.error('Error fetching leaderboard for ranking:', leaderboardError);
      throw new Error('Failed to calculate user ranking');
    }

    const leaderboard = leaderboardData || [];
    const userIndex = leaderboard.findIndex((entry: any) => entry.slack_user_id === slackUserId);
    
    if (userIndex === -1) {
      return null;
    }

    const userEntry = leaderboard[userIndex];
    const totalUsers = leaderboard.length;
    const percentile = Math.round(((totalUsers - userEntry.rank) / totalUsers) * 100);
    
    // Find next rank user (person directly above them)
    const nextRankUser = userIndex > 0 ? leaderboard[userIndex - 1] : undefined;
    const xpUntilNextRank = nextRankUser ? nextRankUser.total_xp - userEntry.total_xp : undefined;

    return {
      user: userEntry,
      totalUsers,
      percentile,
      xpUntilNextRank,
      nextRankUser
    };
  }

  /**
   * Get leaderboard for users who participated in a specific challenge
   */
  static async getChallengeLeaderboard(challengeId: number, limit = 10): Promise<LeaderboardEntry[]> {
    // Get users who submitted to this challenge
    const { data: challengeParticipants, error } = await supabase
      .from('submissions')
      .select(`
        author_id,
        users!inner (
          user_id,
          slack_user_id,
          username,
          total_xp,
          current_streak,
          badges
        )
      `)
      .eq('submission_type', 'challenge_response')
      .not('users', 'is', null);

    if (error) {
      console.error('Error fetching challenge participants:', error);
      throw new Error('Failed to fetch challenge leaderboard');
    }

    // Extract and format user data
    const userMap = new Map();
    challengeParticipants?.forEach((submission: any) => {
      const user = submission.users;
      if (user && !userMap.has(user.user_id)) {
        userMap.set(user.user_id, user);
      }
    });

    // Convert to array and sort by XP
    const participants = Array.from(userMap.values())
      .sort((a: any, b: any) => b.total_xp - a.total_xp)
      .slice(0, limit)
      .map((user: any, index: number) => ({
        user_id: user.user_id,
        slack_user_id: user.slack_user_id,
        username: user.username,
        total_xp: user.total_xp,
        current_streak: user.current_streak,
        rank: index + 1,
        badges: user.badges || []
      }));

    return participants;
  }

  /**
   * Format leaderboard for Slack display
   */
  static formatLeaderboardForSlack(
    entries: LeaderboardEntry[], 
    title = '🏆 Leaderboard',
    currentUserId?: string
  ): any[] {
    const blocks: any[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${title}*`
        }
      },
      {
        type: 'divider'
      }
    ];

    if (entries.length === 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '📭 No participants yet. Be the first to submit a prompt!'
        }
      });
      return blocks;
    }

    // Format each entry
    entries.forEach((entry, index) => {
      const isCurrentUser = entry.slack_user_id === currentUserId;
      const rankEmoji = this.getRankEmoji(entry.rank);
      const streakText = entry.current_streak > 0 ? ` • 🔥 ${entry.current_streak}` : '';
      const badgeText = entry.badges && entry.badges.length > 0 ? ` ${entry.badges.slice(0, 3).join(' ')}` : '';
      
      const userText = isCurrentUser 
        ? `*#${entry.rank} <@${entry.slack_user_id}>* ⭐`
        : `#${entry.rank} <@${entry.slack_user_id}>`;

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${rankEmoji} ${userText}\n💰 ${entry.total_xp} XP${streakText}${badgeText}`
        }
      });
    });

    // Add footer with last updated time
    blocks.push(
      {
        type: 'divider'
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `📊 Updated ${new Date().toLocaleTimeString()}`
          }
        ]
      }
    );

    return blocks;
  }

  /**
   * Format user ranking for Slack display
   */
  static formatUserRankingForSlack(ranking: UserRanking): any[] {
    const { user, totalUsers, percentile, xpUntilNextRank, nextRankUser } = ranking;
    
    const rankEmoji = this.getRankEmoji(user.rank);
    const streakText = user.current_streak > 0 ? ` • 🔥 ${user.current_streak} day streak` : '';
    const badgeText = user.badges && user.badges.length > 0 ? `\n🏅 ${user.badges.join(' ')}` : '';
    
    let nextRankText = '';
    if (xpUntilNextRank && nextRankUser) {
      nextRankText = `\n📈 *${xpUntilNextRank} XP* to reach #${nextRankUser.rank} (<@${nextRankUser.slack_user_id}>)`;
    } else if (user.rank === 1) {
      nextRankText = '\n👑 *You\'re #1!* Keep up the great work!';
    }

    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${rankEmoji} *Your Ranking*\n\n*#${user.rank}* out of ${totalUsers} players (Top ${percentile}%)\n💰 *${user.total_xp} XP*${streakText}${badgeText}${nextRankText}`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🏆 View Full Leaderboard'
            },
            action_id: 'view_full_leaderboard'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📊 View Home Tab'
            },
            action_id: 'view_home_tab'
          }
        ]
      }
    ];
  }

  /**
   * Get appropriate emoji for rank
   */
  private static getRankEmoji(rank: number): string {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      case 4:
      case 5: return '🏅';
      default: return '📊';
    }
  }

  /**
   * Get leaderboard stats summary
   */
  static async getLeaderboardStats(): Promise<{
    totalUsers: number;
    totalXP: number;
    averageXP: number;
    topStreak: number;
  }> {
    const { data, error } = await supabase
      .from('users')
      .select('total_xp, current_streak');

    if (error) {
      console.error('Error fetching leaderboard stats:', error);
      throw new Error('Failed to fetch leaderboard statistics');
    }

    const users = data || [];
    const totalUsers = users.length;
    const totalXP = users.reduce((sum, user) => sum + (user.total_xp || 0), 0);
    const averageXP = totalUsers > 0 ? Math.round(totalXP / totalUsers) : 0;
    const topStreak = users.reduce((max, user) => Math.max(max, user.current_streak || 0), 0);

    return {
      totalUsers,
      totalXP,
      averageXP,
      topStreak
    };
  }
}