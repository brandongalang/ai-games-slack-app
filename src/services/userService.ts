import { supabaseAdmin } from '../database/supabase';
import { User } from '../database/types';

export class UserService {
  /**
   * Get or create a user by Slack ID
   */
  static async getOrCreateUser(slackId: string, displayName?: string): Promise<User> {
    // First try to get existing user
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('slack_id', slackId)
      .single();

    if (existingUser && !fetchError) {
      return existingUser;
    }

    // Create new user if not found
    const { data: newUser, error: createError } = await supabaseAdmin
      .from('users')
      .insert({
        slack_id: slackId,
        display_name: displayName || null,
        total_xp: 0,
        current_streak: 0,
        badges: [],
        notification_preferences: {
          streak_dms: true,
          weekly_digest: true
        }
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    return newUser;
  }

  /**
   * Update user's XP and recalculate totals
   */
  static async addXP(userId: number, xpValue: number): Promise<void> {
    const { error } = await supabaseAdmin.rpc('increment_user_xp', { 
      user_id: userId, 
      xp_amount: xpValue 
    });

    if (error) {
      throw new Error(`Failed to update user XP: ${error.message}`);
    }
  }

  /**
   * Update user's streak
   */
  static async updateStreak(userId: number, newStreak: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from('users')
      .update({ current_streak: newStreak })
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to update user streak: ${error.message}`);
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: number): Promise<User | null> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw new Error(`Failed to fetch user: ${error.message}`);
    }

    return data;
  }

  /**
   * Get user by Slack ID
   */
  static async getUserBySlackId(slackId: string): Promise<User | null> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('slack_id', slackId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw new Error(`Failed to fetch user: ${error.message}`);
    }

    return data;
  }

  /**
   * Check if this is user's first submission
   */
  static async isFirstSubmission(userId: number): Promise<boolean> {
    const { count, error } = await supabaseAdmin
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', userId);

    if (error) {
      throw new Error(`Failed to check submission count: ${error.message}`);
    }

    return count === 0;
  }
}