import { supabaseAdmin } from '../database/supabase';
import { Comment } from '../database/types';
import { XPService } from './xpService';
import { UserService } from './userService';
import { LLMService } from './llmService';

export interface CreateCommentData {
  submissionId: number;
  authorId: number;
  commentText: string;
  parentCommentId?: number;
  isHelpful?: boolean;
  skipLLMAnalysis?: boolean; // For admin/manual comments
}

export interface CommentAnalysisResult {
  helpfulnessScore: number;
  isHelpful: boolean;
  confidence: number;
  reasoning: string;
  categories: string[];
  suggestedImprovements?: string[];
}

export class CommentService {
  /**
   * Create a new comment with LLM analysis and award XP
   */
  static async createComment(data: CreateCommentData): Promise<Comment & { analysis?: CommentAnalysisResult }> {
    const { submissionId, authorId, commentText, parentCommentId, isHelpful, skipLLMAnalysis } = data;
    
    let llmAnalysis: CommentAnalysisResult | undefined;
    let finalIsHelpful = isHelpful;

    // Analyze comment helpfulness using LLM if not skipped
    if (!skipLLMAnalysis && !isHelpful) {
      try {
        // Get submission context for analysis
        const { data: submission } = await supabaseAdmin
          .from('submissions')
          .select('prompt_text, title, description, tags')
          .eq('submission_id', submissionId)
          .single();

        if (submission) {
          const analysis = await LLMService.analyzeCommentHelpfulness(
            submission.prompt_text,
            commentText,
            {
              title: submission.title,
              description: submission.description,
              tags: submission.tags
            }
          );

          llmAnalysis = analysis;
          
          // Auto-mark as helpful if LLM confidence is high
          if (analysis.isHelpful && analysis.confidence >= 80) {
            finalIsHelpful = true;
          }
        }
      } catch (error) {
        console.error('Error analyzing comment helpfulness:', error);
        // Continue without analysis if LLM fails
      }
    }
    
    // Create comment
    const { data: comment, error: commentError } = await supabaseAdmin
      .from('comments')
      .insert({
        submission_id: submissionId,
        author_id: authorId,
        comment_text: commentText,
        parent_comment_id: parentCommentId,
        is_helpful: finalIsHelpful
      })
      .select()
      .single();

    if (commentError) {
      throw new Error(`Failed to create comment: ${commentError.message}`);
    }

    // Store LLM analysis if available
    if (llmAnalysis) {
      await this.storeCommentAnalysis(comment.comment_id, llmAnalysis);
    }

    // Award XP for helpful comment
    if (finalIsHelpful) {
      await XPService.awardXP({
        userId: authorId,
        eventType: 'HELPFUL_COMMENT',
        metadata: { 
          commentId: comment.comment_id,
          submissionId,
          commentLength: commentText.length,
          isReply: !!parentCommentId,
          helpfulnessScore: llmAnalysis?.helpfulnessScore,
          categories: llmAnalysis?.categories,
          autoDetected: !isHelpful && finalIsHelpful
        }
      });
    }

    return { ...comment, analysis: llmAnalysis };
  }

  /**
   * Mark a comment as helpful and award XP
   */
  static async markCommentHelpful(commentId: number, markerId: number): Promise<void> {
    // Get comment details
    const { data: comment, error: commentError } = await supabaseAdmin
      .from('comments')
      .select('*')
      .eq('comment_id', commentId)
      .single();

    if (commentError || !comment) {
      throw new Error('Comment not found');
    }

    // Update comment
    await supabaseAdmin
      .from('comments')
      .update({ is_helpful: true })
      .eq('comment_id', commentId);

    // Award XP to comment author for receiving helpful mark
    await XPService.awardXP({
      userId: comment.author_id,
      eventType: 'RECEIVING_HELPFUL_REACTION',
      metadata: { 
        commentId,
        markerId,
        submissionId: comment.submission_id
      }
    });

    // Award XP to marker for giving helpful reaction
    await XPService.awardXP({
      userId: markerId,
      eventType: 'GIVING_HELPFUL_REACTION',
      metadata: { 
        commentId,
        commentAuthorId: comment.author_id,
        submissionId: comment.submission_id
      }
    });
  }

  /**
   * Get comments for a submission
   */
  static async getCommentsBySubmission(submissionId: number): Promise<Comment[]> {
    const { data, error } = await supabaseAdmin
      .from('comments')
      .select(`
        *,
        users!comments_author_id_fkey (
          username,
          slack_user_id
        )
      `)
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch comments: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get recent helpful comments by user
   */
  static async getRecentHelpfulComments(userId: number, days = 30): Promise<Comment[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const { data, error } = await supabaseAdmin
      .from('comments')
      .select('*')
      .eq('author_id', userId)
      .eq('is_helpful', true)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch helpful comments: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Store LLM analysis results for a comment
   */
  private static async storeCommentAnalysis(commentId: number, analysis: CommentAnalysisResult): Promise<void> {
    try {
      // Store in a metadata table or as JSON in comments table
      await supabaseAdmin
        .from('comments')
        .update({
          metadata: {
            llm_analysis: {
              helpfulness_score: analysis.helpfulnessScore,
              confidence: analysis.confidence,
              reasoning: analysis.reasoning,
              categories: analysis.categories,
              suggested_improvements: analysis.suggestedImprovements,
              analyzed_at: new Date().toISOString()
            }
          }
        })
        .eq('comment_id', commentId);
    } catch (error) {
      console.error('Failed to store comment analysis:', error);
      // Non-critical, don't throw
    }
  }

  /**
   * Re-analyze a comment with LLM
   */
  static async reanalyzeComment(commentId: number): Promise<CommentAnalysisResult | null> {
    try {
      // Get comment and submission details
      const { data: comment } = await supabaseAdmin
        .from('comments')
        .select(`
          *,
          submissions!comments_submission_id_fkey (
            prompt_text, title, description, tags
          )
        `)
        .eq('comment_id', commentId)
        .single();

      if (!comment || !comment.submissions) {
        throw new Error('Comment or submission not found');
      }

      const submission = comment.submissions;
      const analysis = await LLMService.analyzeCommentHelpfulness(
        submission.prompt_text,
        comment.comment_text,
        {
          title: submission.title,
          description: submission.description,
          tags: submission.tags
        }
      );

      // Store updated analysis
      await this.storeCommentAnalysis(commentId, analysis);

      // Update helpfulness if confidence is high and not already helpful
      if (analysis.isHelpful && analysis.confidence >= 80 && !comment.is_helpful) {
        await supabaseAdmin
          .from('comments')
          .update({ is_helpful: true })
          .eq('comment_id', commentId);

        // Award XP for the newly detected helpful comment
        await XPService.awardXP({
          userId: comment.author_id,
          eventType: 'HELPFUL_COMMENT',
          metadata: { 
            commentId,
            submissionId: comment.submission_id,
            helpfulnessScore: analysis.helpfulnessScore,
            categories: analysis.categories,
            autoDetected: true,
            reanalyzed: true
          }
        });
      }

      return analysis;
    } catch (error) {
      console.error('Error re-analyzing comment:', error);
      return null;
    }
  }

  /**
   * Get comment analysis statistics
   */
  static async getCommentAnalysisStats(days = 30): Promise<{
    totalComments: number;
    helpfulComments: number;
    autoDetectedHelpful: number;
    averageHelpfulnessScore: number;
    topCategories: Array<{ category: string; count: number }>;
  }> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // This would ideally be done with proper SQL queries
    // For now, simplified stats
    const { data: comments } = await supabaseAdmin
      .from('comments')
      .select('is_helpful, metadata')
      .gte('created_at', startDate.toISOString());

    const totalComments = comments?.length || 0;
    const helpfulComments = comments?.filter(c => c.is_helpful)?.length || 0;
    
    // Count auto-detected helpful comments from metadata
    const autoDetectedHelpful = comments?.filter(c => 
      c.metadata?.llm_analysis && c.is_helpful
    )?.length || 0;

    // Calculate average helpfulness score
    const scoresWithAnalysis = comments?.filter(c => 
      c.metadata?.llm_analysis?.helpfulness_score
    )?.map(c => c.metadata.llm_analysis.helpfulness_score) || [];
    
    const averageHelpfulnessScore = scoresWithAnalysis.length > 0
      ? scoresWithAnalysis.reduce((sum, score) => sum + score, 0) / scoresWithAnalysis.length
      : 0;

    return {
      totalComments,
      helpfulComments,
      autoDetectedHelpful,
      averageHelpfulnessScore: Math.round(averageHelpfulnessScore),
      topCategories: [] // Would need more complex query for this
    };
  }

  /**
   * Format comment analysis for Slack display
   */
  static formatAnalysisForSlack(analysis: CommentAnalysisResult): any[] {
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🔍 *Comment Analysis*\n\n📊 **Helpfulness Score:** ${analysis.helpfulnessScore}/100\n🤖 **Assessment:** ${analysis.isHelpful ? '✅ Helpful' : '❌ Not Helpful'}\n🎯 **Confidence:** ${analysis.confidence}%`
        }
      }
    ];

    if (analysis.categories.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📝 **Categories:** ${analysis.categories.join(', ')}`
        }
      });
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `💭 **Reasoning:** ${analysis.reasoning}`
      }
    });

    if (analysis.suggestedImprovements && analysis.suggestedImprovements.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `💡 **Suggestions:**\n${analysis.suggestedImprovements.map(s => `• ${s}`).join('\n')}`
        }
      });
    }

    return blocks;
  }
}