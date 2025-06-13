import { supabaseAdmin } from '../database/supabase';
import { Submission, XPEvent, XP_EVENTS, XP_VALUES } from '../database/types';
import { UserService } from './userService';
import { XPService, QualityMetrics } from './xpService';

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
  qualityMetrics?: QualityMetrics;
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

    // Check if this is the user's first submission
    const { count } = await supabaseAdmin
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', data.authorId)
      .neq('submission_id', submission.submission_id);
    
    const isFirstSubmission = (count || 0) === 0;
    
    // Award XP using the comprehensive XP system
    await XPService.awardSubmissionXP(
      data.authorId,
      submission.submission_id,
      data.qualityMetrics || {},
      isFirstSubmission,
      data.submissionType || 'workflow'
    );

    return submission;
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
    const { StreakService } = await import('./streakService');
    await StreakService.recordActivity(userId, activityType);
  }
}