import { supabaseAdmin } from '../database/supabase';
import { SecurityService } from './securityService';

export class PrivacyService {
  /**
   * Export all user data for GDPR compliance
   */
  static async exportUserData(userId: number): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const userData: any = {
        exportedAt: new Date().toISOString(),
        userId: userId
      };

      // Get basic user information
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (userError) {
        return { success: false, error: 'User not found' };
      }

      userData.profile = {
        slack_id: user.slack_id,
        display_name: user.display_name,
        total_xp: user.total_xp,
        current_streak: user.current_streak,
        longest_streak: user.longest_streak,
        created_at: user.created_at,
        updated_at: user.updated_at
      };

      // Get submissions
      const { data: submissions } = await supabaseAdmin
        .from('submissions')
        .select(`
          submission_id,
          title,
          prompt_text,
          description,
          output_sample,
          tags,
          submission_type,
          created_at,
          updated_at
        `)
        .eq('author_id', userId);

      userData.submissions = submissions || [];

      // Get XP events
      const { data: xpEvents } = await supabaseAdmin
        .from('xp_events')
        .select(`
          event_id,
          event_type,
          xp_value,
          description,
          created_at
        `)
        .eq('user_id', userId);

      userData.xpHistory = xpEvents || [];

      // Get badges
      const { data: badges } = await supabaseAdmin
        .from('badges')
        .select(`
          id,
          name,
          description,
          emoji,
          earned_at,
          category,
          rarity
        `)
        .eq('user_id', userId);

      userData.badges = badges || [];

      // Get comments
      const { data: comments } = await supabaseAdmin
        .from('comments')
        .select(`
          comment_id,
          content,
          is_helpful,
          created_at
        `)
        .eq('author_id', userId);

      userData.comments = comments || [];

      // Get library favorites
      const { data: favorites } = await supabaseAdmin
        .from('library_favorites')
        .select(`
          library_item_id,
          created_at
        `)
        .eq('user_id', userId);

      userData.libraryFavorites = favorites || [];

      // Get activity logs (last 90 days only for privacy)
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const { data: activityLogs } = await supabaseAdmin
        .from('user_activity_logs')
        .select(`
          activity_type,
          created_at
        `)
        .eq('user_id', userId)
        .gte('created_at', ninetyDaysAgo.toISOString());

      userData.recentActivity = activityLogs || [];

      // Add data export metadata
      userData.exportMetadata = {
        totalSubmissions: userData.submissions.length,
        totalXP: userData.profile.total_xp,
        totalBadges: userData.badges.length,
        totalComments: userData.comments.length,
        accountAge: Math.floor((Date.now() - new Date(userData.profile.created_at).getTime()) / (1000 * 60 * 60 * 24)),
        dataRetentionNotice: 'This export contains your data as of the export date. Some historical data may be automatically purged according to our data retention policy.'
      };

      return { success: true, data: userData };

    } catch (error) {
      console.error('Error exporting user data:', error);
      return { success: false, error: 'Failed to export user data' };
    }
  }

  /**
   * Delete all user data (GDPR right to be forgotten)
   */
  static async deleteUserData(userId: number, requestedBy: string): Promise<{
    success: boolean;
    deletedItems?: string[];
    error?: string;
  }> {
    try {
      const deletedItems: string[] = [];

      // First, get user info for logging
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('slack_id, display_name')
        .eq('user_id', userId)
        .single();

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Log the deletion request
      await SecurityService.logSecurityEvent({
        userId: userId,
        slackUserId: requestedBy,
        eventType: 'admin_action',
        description: `User data deletion requested for user ${user.slack_id}`,
        riskLevel: 'high',
        metadata: { targetUser: user.slack_id, requestedBy }
      });

      // Delete in order of dependencies

      // 1. Delete XP events
      const { error: xpError } = await supabaseAdmin
        .from('xp_events')
        .delete()
        .eq('user_id', userId);
      
      if (!xpError) deletedItems.push('XP events');

      // 2. Delete badges
      const { error: badgesError } = await supabaseAdmin
        .from('badges')
        .delete()
        .eq('user_id', userId);
      
      if (!badgesError) deletedItems.push('Badges');

      // 3. Delete comments
      const { error: commentsError } = await supabaseAdmin
        .from('comments')
        .delete()
        .eq('author_id', userId);
      
      if (!commentsError) deletedItems.push('Comments');

      // 4. Delete library favorites
      const { error: favoritesError } = await supabaseAdmin
        .from('library_favorites')
        .delete()
        .eq('user_id', userId);
      
      if (!favoritesError) deletedItems.push('Library favorites');

      // 5. Delete user activity logs
      const { error: activityError } = await supabaseAdmin
        .from('user_activity_logs')
        .delete()
        .eq('user_id', userId);
      
      if (!activityError) deletedItems.push('Activity logs');

      // 6. Handle submissions - mark as deleted but keep for integrity
      const { error: submissionsError } = await supabaseAdmin
        .from('submissions')
        .update({
          author_id: null, // Remove author reference
          title: '[DELETED]',
          prompt_text: '[This content has been deleted at user request]',
          description: '[DELETED]',
          output_sample: '[DELETED]',
          tags: [],
          deleted_at: new Date().toISOString()
        })
        .eq('author_id', userId);
      
      if (!submissionsError) deletedItems.push('Submissions (anonymized)');

      // 7. Delete the user record last
      const { error: userError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('user_id', userId);
      
      if (!userError) deletedItems.push('User profile');

      // 8. Clean up any remaining references in security logs
      await supabaseAdmin
        .from('security_logs')
        .update({ 
          user_id: null,
          description: `${new Date().toISOString()}: User data deleted - original description redacted`
        })
        .eq('user_id', userId);

      deletedItems.push('Security logs (anonymized)');

      await SecurityService.logSecurityEvent({
        slackUserId: requestedBy,
        eventType: 'admin_action',
        description: `Completed user data deletion for user ${user.slack_id}. Deleted: ${deletedItems.join(', ')}`,
        riskLevel: 'high',
        metadata: { deletedItems, targetUser: user.slack_id }
      });

      return { success: true, deletedItems };

    } catch (error) {
      console.error('Error deleting user data:', error);
      await SecurityService.logSecurityEvent({
        userId: userId,
        slackUserId: requestedBy,
        eventType: 'admin_action',
        description: `Failed to delete user data: ${error}`,
        riskLevel: 'high',
        metadata: { error: String(error) }
      });

      return { success: false, error: 'Failed to delete user data' };
    }
  }

  /**
   * Anonymize user data (alternative to deletion)
   */
  static async anonymizeUserData(userId: number, requestedBy: string): Promise<{
    success: boolean;
    anonymizedItems?: string[];
    error?: string;
  }> {
    try {
      const anonymizedItems: string[] = [];

      // Get user info for logging
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('slack_id, display_name')
        .eq('user_id', userId)
        .single();

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Generate anonymous identifier
      const anonymousId = `user_${SecurityService.generateSecureToken(8)}`;

      // Update user profile with anonymous data
      const { error: userError } = await supabaseAdmin
        .from('users')
        .update({
          slack_id: anonymousId,
          display_name: 'Anonymous User',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (!userError) anonymizedItems.push('User profile');

      // Keep submissions but anonymize them
      const { error: submissionsError } = await supabaseAdmin
        .from('submissions')
        .update({
          title: anonymizedItems.includes('title') ? '[Anonymous Submission]' : null,
          updated_at: new Date().toISOString()
        })
        .eq('author_id', userId);

      if (!submissionsError) anonymizedItems.push('Submissions');

      // Remove personal identifiers from comments but keep content
      const { error: commentsError } = await supabaseAdmin
        .from('comments')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('author_id', userId);

      if (!commentsError) anonymizedItems.push('Comments');

      await SecurityService.logSecurityEvent({
        slackUserId: requestedBy,
        eventType: 'admin_action',
        description: `User data anonymized for ${user.slack_id} -> ${anonymousId}`,
        riskLevel: 'medium',
        metadata: { originalUser: user.slack_id, anonymizedId: anonymousId, anonymizedItems }
      });

      return { success: true, anonymizedItems };

    } catch (error) {
      console.error('Error anonymizing user data:', error);
      return { success: false, error: 'Failed to anonymize user data' };
    }
  }

  /**
   * Get user's privacy settings and data summary
   */
  static async getUserPrivacySummary(userId: number): Promise<{
    summary: {
      dataRetained: string[];
      retentionPeriods: Record<string, string>;
      lastDataExport?: string;
      dataProcessingBasis: string;
    };
    rights: {
      export: boolean;
      delete: boolean;
      correct: boolean;
      portability: boolean;
    };
  }> {
    try {
      // Get data counts
      const [
        { count: submissions },
        { count: comments },
        { count: xpEvents },
        { count: badges }
      ] = await Promise.all([
        supabaseAdmin.from('submissions').select('*', { count: 'exact', head: true }).eq('author_id', userId),
        supabaseAdmin.from('comments').select('*', { count: 'exact', head: true }).eq('author_id', userId),
        supabaseAdmin.from('xp_events').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabaseAdmin.from('badges').select('*', { count: 'exact', head: true }).eq('user_id', userId)
      ]);

      return {
        summary: {
          dataRetained: [
            `${submissions || 0} submissions`,
            `${comments || 0} comments`,
            `${xpEvents || 0} XP events`,
            `${badges || 0} badges`,
            'Profile information',
            'Activity logs (90 days)'
          ],
          retentionPeriods: {
            'Profile data': 'Until account deletion',
            'Submissions': '7 years or until deletion request',
            'XP and badge data': '7 years or until deletion request',
            'Comments': '7 years or until deletion request',
            'Activity logs': '90 days (rolling)',
            'Security logs': '2 years (anonymized after deletion)'
          },
          dataProcessingBasis: 'Legitimate interest for gamification and community features',
        },
        rights: {
          export: true,
          delete: true,
          correct: true,
          portability: true
        }
      };

    } catch (error) {
      console.error('Error getting privacy summary:', error);
      throw error;
    }
  }

  /**
   * Update user notification preferences
   */
  static async updateNotificationPreferences(
    userId: number, 
    preferences: {
      streak_dms?: boolean;
      weekly_digest?: boolean;
      badge_notifications?: boolean;
      security_alerts?: boolean;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabaseAdmin
        .from('users')
        .update({
          notification_preferences: preferences,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };

    } catch (error) {
      console.error('Error updating notification preferences:', error);
      return { success: false, error: 'Failed to update preferences' };
    }
  }
}