import { supabaseAdmin } from '../database/supabase';
import { Submission, XPEvent, XP_EVENTS, XP_VALUES } from '../database/types';
import { UserService } from './userService';

export interface CreateSubmissionData {
  authorId: number;
  title?: string;
  promptText: string;
  description?: string;
  outputSample?: string;
  outputUrl?: string;
  tags?: string[];
  submissionType?: 'workflow' | 'challenge_response' | 'remix';
  parentSubmissionId?: number;
}

export class SubmissionService {
  /**
   * Create a new submission and award XP
   */
  static async createSubmission(data: CreateSubmissionData): Promise<Submission> {
    // Get current active season
    const { data: season } = await supabaseAdmin
      .from('seasons')
      .select('season_id')
      .eq('status', 'active')
      .single();

    // Create submission
    const { data: submission, error: submissionError } = await supabaseAdmin
      .from('submissions')
      .insert({
        author_id: data.authorId,
        title: data.title,
        prompt_text: data.promptText,
        description: data.description,
        output_sample: data.outputSample,
        output_url: data.outputUrl,
        tags: data.tags || [],
        submission_type: data.submissionType || 'workflow',
        parent_submission_id: data.parentSubmissionId,
        season_id: season?.season_id
      })
      .select()
      .single();

    if (submissionError) {
      throw new Error(`Failed to create submission: ${submissionError.message}`);
    }

    // Award XP for submission
    await this.awardSubmissionXP(data.authorId, submission.submission_id, season?.season_id);

    return submission;
  }

  /**
   * Award XP for a submission
   */
  private static async awardSubmissionXP(
    userId: number, 
    submissionId: number, 
    seasonId?: number
  ): Promise<void> {
    const xpEvents: Omit<XPEvent, 'event_id' | 'created_at'>[] = [];

    // Base submission XP
    xpEvents.push({
      user_id: userId,
      submission_id: submissionId,
      event_type: XP_EVENTS.SUBMISSION_BASE,
      xp_value: XP_VALUES[XP_EVENTS.SUBMISSION_BASE],
      metadata: { source: 'submission_created' },
      season_id: seasonId
    });

    // Check if this is the user's first submission (excluding the one we just created)
    const { count } = await supabaseAdmin
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', userId)
      .neq('submission_id', submissionId);

    const isFirst = (count || 0) === 0;
    if (isFirst) {
      xpEvents.push({
        user_id: userId,
        submission_id: submissionId,
        event_type: XP_EVENTS.FIRST_SUBMISSION_BONUS,
        xp_value: XP_VALUES[XP_EVENTS.FIRST_SUBMISSION_BONUS],
        metadata: { source: 'first_submission' },
        season_id: seasonId
      });
    }

    // Insert XP events
    const { error: xpError } = await supabaseAdmin
      .from('xp_events')
      .insert(xpEvents);

    if (xpError) {
      throw new Error(`Failed to create XP events: ${xpError.message}`);
    }

    // Update user's total XP
    const totalXP = xpEvents.reduce((sum, event) => sum + event.xp_value, 0);
    await UserService.addXP(userId, totalXP);
  }

  /**
   * Get submissions by user
   */
  static async getSubmissionsByUser(userId: number, limit = 10): Promise<Submission[]> {
    const { data, error } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch submissions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get submission by ID
   */
  static async getSubmissionById(submissionId: number): Promise<Submission | null> {
    const { data, error } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('submission_id', submissionId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch submission: ${error.message}`);
    }

    return data;
  }

  /**
   * Get all submissions for remix dropdown
   */
  static async getSubmissionsForRemix(excludeUserId?: number): Promise<{ id: number, title: string }[]> {
    let query = supabaseAdmin
      .from('submissions')
      .select('submission_id, title, prompt_text')
      .order('created_at', { ascending: false })
      .limit(50);

    if (excludeUserId) {
      query = query.neq('author_id', excludeUserId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch submissions for remix: ${error.message}`);
    }

    return (data || []).map(sub => ({
      id: sub.submission_id,
      title: sub.title || sub.prompt_text.substring(0, 50) + '...'
    }));
  }

  /**
   * Record streak activity for a user
   */
  static async recordStreakActivity(
    userId: number, 
    activityType: 'submission' | 'comment' | 'reaction'
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    const { error } = await supabaseAdmin
      .from('user_streaks')
      .insert({
        user_id: userId,
        streak_date: today,
        activity_type: activityType,
        metadata: {}
      })
      .select()
      .single();

    // Ignore duplicate key errors (user already has activity today)
    if (error && !error.message.includes('duplicate key')) {
      console.warn(`Failed to record streak activity: ${error.message}`);
    }
  }
}