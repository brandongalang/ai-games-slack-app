import {
  fetchUserBySlackId,
  insertUser,
  fetchUserById,
  updateUser,
  countSubmissionsByAuthor,
  incrementXP,
} from '../repositories/userRepository';
import { User } from '../database/types';

export class UserService {
  /**
   * Get or create a user by Slack ID
   */
  static async getOrCreateUser(slackId: string, displayName?: string): Promise<User> {
    // First try to get existing user
    const { data: existingUser, error: fetchError } = await fetchUserBySlackId(slackId);

    if (existingUser && !fetchError) {
      return existingUser;
    }

    // Create new user if not found
    const { data: newUser, error: createError } = await insertUser({
      slack_id: slackId,
      display_name: displayName || null,
      total_xp: 0,
      current_streak: 0,
      badges: [],
      notification_preferences: {
        streak_dms: true,
        weekly_digest: true,
      },
    });

    if (createError) {
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    return newUser;
  }

  /**
   * Update user's XP and recalculate totals
   */
  static async addXP(userId: number, xpValue: number): Promise<void> {
    const { error } = await incrementXP(userId, xpValue);

    if (error) {
      throw new Error(`Failed to update user XP: ${error.message}`);
    }
  }

  /**
   * Update user's streak
   */
  static async updateStreak(userId: number, newStreak: number): Promise<void> {
    const { error } = await updateUser(userId, { current_streak: newStreak });

    if (error) {
      throw new Error(`Failed to update user streak: ${error.message}`);
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: number): Promise<User | null> {
    const { data, error } = await fetchUserById(userId);

    if (error && (error as any).code !== 'PGRST116') { // PGRST116 = not found
      throw new Error(`Failed to fetch user: ${error.message}`);
    }

    return data;
  }

  /**
   * Get user by Slack ID
   */
  static async getUserBySlackId(slackId: string): Promise<User | null> {
    const { data, error } = await fetchUserBySlackId(slackId);

    if (error && (error as any).code !== 'PGRST116') { // PGRST116 = not found
      throw new Error(`Failed to fetch user: ${error.message}`);
    }

    return data;
  }

  /**
   * Check if this is user's first submission
   */
  static async isFirstSubmission(userId: number): Promise<boolean> {
    const { count, error } = await countSubmissionsByAuthor(userId);

    if (error) {
      throw new Error(`Failed to check submission count: ${error.message}`);
    }

    return count === 0;
  }
}