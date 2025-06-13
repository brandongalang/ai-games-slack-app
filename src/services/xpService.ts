import { supabaseAdmin } from '../database/supabase';
import { XP_EVENTS, XP_VALUES, XPEvent } from '../database/types';
import { UserService } from './userService';

export interface XPEventData {
  userId: number;
  eventType: keyof typeof XP_EVENTS;
  xpValue?: number; // Optional override for dynamic values
  submissionId?: number;
  metadata?: Record<string, any>;
  seasonId?: number;
}

export interface XPCalculationResult {
  baseXP: number;
  bonusXP: number;
  penaltyXP: number;
  totalXP: number;
  multiplier: number;
  events: XPEventData[];
  breakdown: string[];
}

export interface QualityMetrics {
  clarityScore?: number;
  helpfulnessScore?: number;
  originalityScore?: number;
  engagementScore?: number;
}

export interface SeasonalXPStats {
  totalXP: number;
  eventCounts: Record<string, number>;
  qualityAverage: number;
  engagementLevel: 'low' | 'medium' | 'high' | 'elite';
  decayApplied: number;
}

export class XPService {
  /**
   * Award XP for a specific event with comprehensive calculation
   */
  static async awardXP(eventData: XPEventData): Promise<XPCalculationResult> {
    const { userId, eventType, submissionId, metadata = {}, seasonId } = eventData;
    
    // Get current active season if not provided
    const currentSeasonId = seasonId || await this.getCurrentSeasonId();
    
    // Calculate base XP
    const baseXP = eventData.xpValue ?? XP_VALUES[XP_EVENTS[eventType]];
    
    // Calculate quality bonuses and penalties
    const qualityAdjustment = await this.calculateQualityAdjustment(
      userId, 
      eventType, 
      submissionId, 
      metadata
    );
    
    // Calculate engagement multipliers
    const engagementMultiplier = await this.calculateEngagementMultiplier(userId);
    
    // Calculate seasonal bonuses
    const seasonalBonus = await this.calculateSeasonalBonus(userId, currentSeasonId);
    
    // Apply community contribution bonuses
    const communityBonus = await this.calculateCommunityBonus(userId, eventType);
    
    // Calculate final XP
    const adjustedBaseXP = Math.max(0, baseXP + qualityAdjustment.adjustment);
    const bonusXP = seasonalBonus + communityBonus + qualityAdjustment.bonus;
    const penaltyXP = qualityAdjustment.penalty;
    const totalXP = Math.round((adjustedBaseXP + bonusXP - penaltyXP) * engagementMultiplier);
    
    // Create XP event record
    const xpEvent: Omit<XPEvent, 'event_id' | 'created_at'> = {
      user_id: userId,
      submission_id: submissionId,
      event_type: XP_EVENTS[eventType],
      xp_value: totalXP,
      metadata: {
        ...metadata,
        baseXP,
        bonusXP,
        penaltyXP,
        multiplier: engagementMultiplier,
        qualityAdjustment: qualityAdjustment.adjustment,
        breakdown: qualityAdjustment.breakdown
      },
      season_id: currentSeasonId
    };
    
    // Insert XP event
    const { error } = await supabaseAdmin
      .from('xp_events')
      .insert(xpEvent);
    
    if (error) {
      console.error('Error recording XP event:', error);
      throw new Error(`Failed to award XP: ${error.message}`);
    }
    
    // Update user's total XP
    await UserService.addXP(userId, totalXP);
    
    // Log the XP award
    console.log(`Awarded ${totalXP} XP to user ${userId} for ${eventType}`, {
      baseXP,
      bonusXP,
      penaltyXP,
      multiplier: engagementMultiplier
    });
    
    return {
      baseXP,
      bonusXP,
      penaltyXP,
      totalXP,
      multiplier: engagementMultiplier,
      events: [eventData],
      breakdown: qualityAdjustment.breakdown
    };
  }
  
  /**
   * Award XP for submission with comprehensive quality analysis
   */
  static async awardSubmissionXP(
    userId: number, 
    submissionId: number, 
    qualityMetrics: QualityMetrics = {},
    isFirstSubmission = false,
    submissionType: 'workflow' | 'challenge_response' | 'remix' = 'workflow'
  ): Promise<XPCalculationResult> {
    const events: XPEventData[] = [];
    
    // Base submission XP
    events.push({
      userId,
      eventType: 'SUBMISSION_BASE',
      submissionId,
      metadata: { 
        submissionType, 
        qualityMetrics,
        processingTimestamp: new Date().toISOString()
      }
    });
    
    // First submission bonus
    if (isFirstSubmission) {
      events.push({
        userId,
        eventType: 'FIRST_SUBMISSION_BONUS',
        submissionId,
        metadata: { milestone: 'first_submission' }
      });
    }
    
    // Weekly challenge bonus
    if (submissionType === 'challenge_response') {
      events.push({
        userId,
        eventType: 'WEEKLY_CHALLENGE_BONUS',
        submissionId,
        metadata: { challengeType: 'weekly' }
      });
    }
    
    // Quality-based bonuses
    if (qualityMetrics.clarityScore && qualityMetrics.clarityScore >= 8) {
      events.push({
        userId,
        eventType: 'CLARITY_BONUS',
        submissionId,
        metadata: { 
          clarityScore: qualityMetrics.clarityScore,
          threshold: 8
        }
      });
    }
    
    // Process all events and combine results
    const results = await Promise.all(
      events.map(event => this.awardXP(event))
    );
    
    // Combine results
    const combinedResult: XPCalculationResult = {
      baseXP: results.reduce((sum, r) => sum + r.baseXP, 0),
      bonusXP: results.reduce((sum, r) => sum + r.bonusXP, 0),
      penaltyXP: results.reduce((sum, r) => sum + r.penaltyXP, 0),
      totalXP: results.reduce((sum, r) => sum + r.totalXP, 0),
      multiplier: results[0]?.multiplier || 1,
      events,
      breakdown: results.flatMap(r => r.breakdown)
    };
    
    return combinedResult;
  }
  
  /**
   * Calculate quality-based XP adjustments
   */
  private static async calculateQualityAdjustment(
    userId: number,
    eventType: keyof typeof XP_EVENTS,
    submissionId?: number,
    metadata: Record<string, any> = {}
  ): Promise<{
    adjustment: number;
    bonus: number;
    penalty: number;
    breakdown: string[];
  }> {
    let adjustment = 0;
    let bonus = 0;
    let penalty = 0;
    const breakdown: string[] = [];
    
    // Quality bonuses for submissions
    if (submissionId && metadata.qualityMetrics) {
      const { clarityScore, helpfulnessScore, originalityScore } = metadata.qualityMetrics;
      
      // Clarity bonus/penalty
      if (clarityScore !== undefined) {
        if (clarityScore >= 9) {
          bonus += 5;
          breakdown.push('+5 XP: Exceptional clarity (9+)');
        } else if (clarityScore >= 7) {
          bonus += 2;
          breakdown.push('+2 XP: High clarity (7-8)');
        } else if (clarityScore < 4) {
          penalty += 3;
          breakdown.push('-3 XP: Low clarity (<4)');
        }
      }
      
      // Helpfulness bonus
      if (helpfulnessScore !== undefined && helpfulnessScore >= 8) {
        bonus += 3;
        breakdown.push('+3 XP: High helpfulness (8+)');
      }
      
      // Originality bonus
      if (originalityScore !== undefined && originalityScore >= 8) {
        bonus += 4;
        breakdown.push('+4 XP: High originality (8+)');
      }
    }
    
    // Community engagement quality
    if (eventType === 'HELPFUL_COMMENT') {
      // Check if this user consistently gives helpful comments
      const recentComments = await this.getRecentUserActivity(userId, 'helpful_comment', 7);
      if (recentComments >= 5) {
        bonus += 2;
        breakdown.push('+2 XP: Consistent helpful commenting');
      }
    }
    
    // Penalty for rapid-fire low-quality submissions
    if (eventType === 'SUBMISSION_BASE') {
      const recentSubmissions = await this.getRecentUserActivity(userId, 'submission_base', 1);
      if (recentSubmissions >= 5) {
        penalty += 3;
        breakdown.push('-3 XP: Rapid submission penalty');
      }
    }
    
    return { adjustment, bonus, penalty, breakdown };
  }
  
  /**
   * Calculate engagement-based multiplier
   */
  private static async calculateEngagementMultiplier(userId: number): Promise<number> {
    // Get user's recent activity level
    const { data: recentActivity } = await supabaseAdmin
      .from('xp_events')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });
    
    const activityCount = recentActivity?.length || 0;
    
    // Get user's current streak
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('current_streak')
      .eq('user_id', userId)
      .single();
    
    const currentStreak = user?.current_streak || 0;
    
    // Base multiplier
    let multiplier = 1.0;
    
    // Activity level multiplier
    if (activityCount >= 50) {
      multiplier += 0.2; // Very active users get 20% bonus
    } else if (activityCount >= 20) {
      multiplier += 0.1; // Active users get 10% bonus
    } else if (activityCount <= 3) {
      multiplier -= 0.1; // Inactive users get 10% penalty (min 0.9)
    }
    
    // Streak multiplier
    if (currentStreak >= 30) {
      multiplier += 0.15; // Long streaks get 15% bonus
    } else if (currentStreak >= 7) {
      multiplier += 0.05; // Week+ streaks get 5% bonus
    }
    
    return Math.max(0.5, Math.min(1.5, multiplier)); // Cap between 0.5x and 1.5x
  }
  
  /**
   * Calculate seasonal bonuses
   */
  private static async calculateSeasonalBonus(userId: number, seasonId?: number): Promise<number> {
    if (!seasonId) return 0;
    
    // Get user's performance this season
    const { data: seasonStats } = await supabaseAdmin
      .from('xp_events')
      .select('xp_value')
      .eq('user_id', userId)
      .eq('season_id', seasonId);
    
    const seasonXP = seasonStats?.reduce((sum, event) => sum + event.xp_value, 0) || 0;
    
    // Early season bonus (first 1000 XP)
    if (seasonXP < 1000) {
      return 2;
    }
    
    // Mid-season consistency bonus
    if (seasonXP >= 2000 && seasonXP < 5000) {
      return 1;
    }
    
    return 0;
  }
  
  /**
   * Calculate community contribution bonuses
   */
  private static async calculateCommunityBonus(
    userId: number, 
    eventType: keyof typeof XP_EVENTS
  ): Promise<number> {
    // Bonus for helping community members
    if (eventType === 'GIVING_HELPFUL_REACTION') {
      const { data: reactions } = await supabaseAdmin
        .from('xp_events')
        .select('*')
        .eq('user_id', userId)
        .eq('event_type', XP_EVENTS.GIVING_HELPFUL_REACTION)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      
      const reactionCount = reactions?.length || 0;
      
      // Bonus for active community helpers
      if (reactionCount >= 10) {
        return 3;
      } else if (reactionCount >= 5) {
        return 1;
      }
    }
    
    // Bonus for remix contributions
    if (eventType === 'REMIX_IMPROVED') {
      return 2; // Extra bonus for improving others' work
    }
    
    return 0;
  }
  
  /**
   * Apply seasonal XP decay
   */
  static async applySeasonalDecay(seasonId: number, decayFactor = 0.1): Promise<number> {
    console.log(`Applying seasonal decay of ${decayFactor * 100}% for season ${seasonId}`);
    
    // Get all users with XP in this season
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('user_id, total_xp')
      .gt('total_xp', 0);
    
    if (!users) return 0;
    
    let usersUpdated = 0;
    
    for (const user of users) {
      const decayAmount = Math.floor(user.total_xp * decayFactor);
      
      if (decayAmount > 0) {
        // Record decay event
        await supabaseAdmin
          .from('xp_events')
          .insert({
            user_id: user.user_id,
            event_type: 'seasonal_decay',
            xp_value: -decayAmount,
            metadata: { 
              seasonId, 
              decayFactor, 
              originalXP: user.total_xp 
            },
            season_id: seasonId
          });
        
        // Update user XP
        await supabaseAdmin
          .from('users')
          .update({ total_xp: Math.max(0, user.total_xp - decayAmount) })
          .eq('user_id', user.user_id);
        
        usersUpdated++;
      }
    }
    
    console.log(`Applied decay to ${usersUpdated} users`);
    return usersUpdated;
  }
  
  /**
   * Get user's XP breakdown for a period
   */
  static async getUserXPBreakdown(
    userId: number, 
    days = 30
  ): Promise<{
    totalXP: number;
    eventBreakdown: Record<string, { count: number; totalXP: number }>;
    dailyXP: Array<{ date: string; xp: number; events: number }>;
    qualityScore: number;
  }> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const { data: events } = await supabaseAdmin
      .from('xp_events')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });
    
    if (!events) {
      return {
        totalXP: 0,
        eventBreakdown: {},
        dailyXP: [],
        qualityScore: 0
      };
    }
    
    const totalXP = events.reduce((sum, event) => sum + event.xp_value, 0);
    
    // Event breakdown
    const eventBreakdown: Record<string, { count: number; totalXP: number }> = {};
    
    events.forEach(event => {
      if (!eventBreakdown[event.event_type]) {
        eventBreakdown[event.event_type] = { count: 0, totalXP: 0 };
      }
      eventBreakdown[event.event_type].count++;
      eventBreakdown[event.event_type].totalXP += event.xp_value;
    });
    
    // Daily XP
    const dailyXPMap = new Map<string, { xp: number; events: number }>();
    
    events.forEach(event => {
      const date = event.created_at.split('T')[0];
      if (!dailyXPMap.has(date)) {
        dailyXPMap.set(date, { xp: 0, events: 0 });
      }
      const day = dailyXPMap.get(date)!;
      day.xp += event.xp_value;
      day.events++;
    });
    
    const dailyXP = Array.from(dailyXPMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // Calculate quality score based on bonuses received
    const qualityEvents = events.filter(e => 
      e.metadata?.bonus || e.event_type.includes('bonus')
    );
    const qualityScore = Math.min(10, (qualityEvents.length / Math.max(1, events.length)) * 10);
    
    return {
      totalXP,
      eventBreakdown,
      dailyXP,
      qualityScore
    };
  }
  
  /**
   * Helper methods
   */
  private static async getCurrentSeasonId(): Promise<number | undefined> {
    const { data: season } = await supabaseAdmin
      .from('seasons')
      .select('season_id')
      .eq('status', 'active')
      .single();
    
    return season?.season_id;
  }
  
  private static async getRecentUserActivity(
    userId: number, 
    eventType: string, 
    days: number
  ): Promise<number> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const { data } = await supabaseAdmin
      .from('xp_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_type', eventType)
      .gte('created_at', startDate.toISOString());
    
    return data?.length || 0;
  }
  
  /**
   * Format XP breakdown for Slack display
   */
  static formatXPBreakdownForSlack(breakdown: any): any[] {
    const { totalXP, eventBreakdown, qualityScore } = breakdown;
    
    const eventTypes: Record<string, string> = {
      'submission_base': '📝 Submissions',
      'clarity_bonus': '✨ Clarity Bonus',
      'first_submission_bonus': '🌟 First Submit',
      'weekly_challenge_bonus': '🎯 Challenges',
      'helpful_comment': '💬 Comments',
      'giving_helpful_reaction': '👍 Reactions',
      'streak_bonus': '🔥 Streaks'
    };
    
    const topEvents = Object.entries(eventBreakdown)
      .sort(([,a], [,b]) => (b as any).totalXP - (a as any).totalXP)
      .slice(0, 6)
      .map(([type, data]) => ({
        type: eventTypes[type] || type,
        count: (data as any).count,
        xp: (data as any).totalXP
      }));
    
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `💰 *XP Breakdown (Last 30 Days)*\n*Total:* ${totalXP} XP • *Quality Score:* ${qualityScore.toFixed(1)}/10`
        }
      },
      {
        type: 'section',
        fields: topEvents.map(event => ({
          type: 'mrkdwn',
          text: `*${event.type}*\n${event.count}x • ${event.xp} XP`
        }))
      }
    ];
  }
}