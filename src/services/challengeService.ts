import { supabaseAdmin } from '../database/supabase';
import { SeedPrompt, Season } from '../database/types';

export interface WeeklyChallenge {
  seed_prompt_id: number;
  season_id: number;
  week_number: number;
  prompt_text: string;
  instructions?: string;
  is_active: boolean;
  created_at: string;
}

export class ChallengeService {
  /**
   * Get the current week's challenge
   */
  static async getCurrentWeekChallenge(): Promise<WeeklyChallenge | null> {
    // Get the current active season
    const { data: season } = await supabaseAdmin
      .from('seasons')
      .select('*')
      .eq('status', 'active')
      .single();

    if (!season) {
      throw new Error('No active season found');
    }

    // Calculate current week number based on season start
    const seasonStart = new Date(season.start_date);
    const now = new Date();
    const diffTime = now.getTime() - seasonStart.getTime();
    const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7)) + 1;

    // Get the seed prompt for this week
    const { data: seedPrompt, error } = await supabaseAdmin
      .from('seed_prompts')
      .select('*')
      .eq('season_id', season.season_id)
      .eq('week_number', diffWeeks)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get weekly challenge: ${error.message}`);
    }

    return seedPrompt;
  }

  /**
   * Get the next upcoming challenge (for scheduling)
   */
  static async getNextWeekChallenge(): Promise<WeeklyChallenge | null> {
    const currentChallenge = await this.getCurrentWeekChallenge();
    if (!currentChallenge) {
      return null;
    }

    // Get the next week's challenge
    const { data: nextChallenge, error } = await supabaseAdmin
      .from('seed_prompts')
      .select('*')
      .eq('season_id', currentChallenge.season_id)
      .eq('week_number', currentChallenge.week_number + 1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get next week challenge: ${error.message}`);
    }

    return nextChallenge;
  }

  /**
   * Mark a challenge as active (posted)
   */
  static async markChallengeAsActive(seedPromptId: number): Promise<void> {
    // First, mark all challenges as inactive
    await supabaseAdmin
      .from('seed_prompts')
      .update({ is_active: false })
      .neq('seed_prompt_id', 0); // Update all

    // Then mark the specific challenge as active
    const { error } = await supabaseAdmin
      .from('seed_prompts')
      .update({ is_active: true })
      .eq('seed_prompt_id', seedPromptId);

    if (error) {
      throw new Error(`Failed to mark challenge as active: ${error.message}`);
    }
  }

  /**
   * Create a new seed prompt for a specific week
   */
  static async createSeedPrompt(
    seasonId: number,
    weekNumber: number,
    promptText: string,
    instructions?: string
  ): Promise<SeedPrompt> {
    const { data, error } = await supabaseAdmin
      .from('seed_prompts')
      .insert({
        season_id: seasonId,
        week_number: weekNumber,
        prompt_text: promptText,
        instructions: instructions,
        is_active: false
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create seed prompt: ${error.message}`);
    }

    return data;
  }

  /**
   * Get all seed prompts for a season
   */
  static async getSeedPromptsBySeason(seasonId: number): Promise<SeedPrompt[]> {
    const { data, error } = await supabaseAdmin
      .from('seed_prompts')
      .select('*')
      .eq('season_id', seasonId)
      .order('week_number', { ascending: true });

    if (error) {
      throw new Error(`Failed to get seed prompts: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get submissions for the current challenge
   */
  static async getChallengeSubmissions(seedPromptId: number) {
    const { data, error } = await supabaseAdmin
      .from('submissions')
      .select(`
        *,
        users:author_id (display_name, slack_id)
      `)
      .eq('submission_type', 'challenge_response')
      .eq('season_id', seedPromptId) // Using season_id as a temporary way to link to challenges
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get challenge submissions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get challenge statistics
   */
  static async getChallengeStats(seedPromptId: number) {
    const submissions = await this.getChallengeSubmissions(seedPromptId);
    
    return {
      total_submissions: submissions.length,
      unique_participants: new Set(submissions.map(s => s.author_id)).size,
      avg_xp_score: submissions.reduce((sum, s) => sum + (s.llm_clarity_score || 0), 0) / submissions.length || 0,
      top_submission: submissions.sort((a, b) => (b.llm_clarity_score || 0) - (a.llm_clarity_score || 0))[0]
    };
  }

  /**
   * Format challenge for Slack posting
   */
  static formatChallengeForSlack(challenge: WeeklyChallenge): any {
    const challengeTitle = `🎯 Week ${challenge.week_number} AI Prompt Challenge`;
    
    return {
      text: `${challengeTitle}\n\n${challenge.prompt_text}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: challengeTitle
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*This week's challenge:*\n\n${challenge.prompt_text}`
          }
        },
        ...(challenge.instructions ? [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Instructions:*\n${challenge.instructions}`
          }
        }] : []),
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🏆 *How to participate:*\n• Use \`/submit\` to share your response\n• Tag it as a challenge response\n• Get creative and have fun!\n\n💰 *Bonus XP:* Challenge responses earn +10 bonus XP!`
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '🚀 Submit Response'
              },
              action_id: 'submit_challenge_response',
              style: 'primary'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📊 View Leaderboard'
              },
              action_id: 'view_challenge_leaderboard'
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `💡 *Pro tip:* The best challenge responses are creative, detailed, and show clear thinking. Quality over quantity!`
            }
          ]
        }
      ]
    };
  }
}