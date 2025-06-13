import { supabaseAdmin } from '../database/supabase';
import { LLMService } from './llmService';
import { XPService } from './xpService';

export interface ClarityAnalysis {
  clarityScore: number;
  reasoning: string;
  suggestions: string[];
  categories: string[];
  strengths: string[];
  weaknesses: string[];
  analyzedAt: string;
}

export interface ClarityScoreData {
  submissionId: number;
  clarityScore: number;
  analysis: ClarityAnalysis;
  xpImpact: {
    baseScore: number;
    clarityBonus: number;
    totalXP: number;
  };
}

export class ClarityService {
  /**
   * Analyze prompt clarity and store results
   */
  static async analyzeSubmissionClarity(
    submissionId: number,
    promptText: string,
    promptContext?: { title?: string; description?: string; tags?: string[] }
  ): Promise<ClarityScoreData> {
    try {
      // Get LLM analysis
      const analysis = await LLMService.analyzePromptClarity(promptText, promptContext);
      
      // Calculate XP impact based on clarity score
      const xpImpact = this.calculateClarityXPImpact(analysis.clarityScore);
      
      // Store analysis in database
      await this.storeClarityAnalysis(submissionId, analysis);
      
      // Award or penalize XP based on clarity
      await this.applyClarityXPAdjustment(submissionId, xpImpact);
      
      const result: ClarityScoreData = {
        submissionId,
        clarityScore: analysis.clarityScore,
        analysis: {
          ...analysis,
          analyzedAt: new Date().toISOString()
        },
        xpImpact
      };
      
      console.log('Clarity analysis completed:', {
        submissionId,
        clarityScore: analysis.clarityScore,
        xpImpact: xpImpact.clarityBonus
      });
      
      return result;
    } catch (error) {
      console.error('Error analyzing submission clarity:', error);
      
      // Return fallback result
      const fallbackAnalysis: ClarityAnalysis = {
        clarityScore: 5,
        reasoning: 'Unable to analyze clarity at this time',
        suggestions: [],
        categories: ['general'],
        strengths: [],
        weaknesses: [],
        analyzedAt: new Date().toISOString()
      };
      
      return {
        submissionId,
        clarityScore: 5,
        analysis: fallbackAnalysis,
        xpImpact: {
          baseScore: 5,
          clarityBonus: 0,
          totalXP: 0
        }
      };
    }
  }
  
  /**
   * Calculate XP impact based on clarity score
   */
  private static calculateClarityXPImpact(clarityScore: number): {
    baseScore: number;
    clarityBonus: number;
    totalXP: number;
  } {
    const baseScore = clarityScore;
    let clarityBonus = 0;
    
    // XP bonus/penalty based on clarity score
    if (clarityScore >= 9) {
      clarityBonus = 10; // Exceptional clarity
    } else if (clarityScore >= 7) {
      clarityBonus = 5; // Good clarity
    } else if (clarityScore >= 5) {
      clarityBonus = 0; // Neutral clarity
    } else if (clarityScore >= 3) {
      clarityBonus = -3; // Poor clarity penalty
    } else {
      clarityBonus = -5; // Very poor clarity penalty
    }
    
    const totalXP = Math.max(0, baseScore + clarityBonus);
    
    return {
      baseScore,
      clarityBonus,
      totalXP
    };
  }
  
  /**
   * Store clarity analysis in database
   */
  private static async storeClarityAnalysis(
    submissionId: number,
    analysis: Omit<ClarityAnalysis, 'analyzedAt'>
  ): Promise<void> {
    try {
      // Update submission with clarity score
      await supabaseAdmin
        .from('submissions')
        .update({
          clarity_score: analysis.clarityScore,
          metadata: {
            clarity_analysis: {
              ...analysis,
              analyzed_at: new Date().toISOString()
            }
          }
        })
        .eq('submission_id', submissionId);
        
    } catch (error) {
      console.error('Error storing clarity analysis:', error);
      // Non-critical, don't throw
    }
  }
  
  /**
   * Apply XP adjustments based on clarity score
   */
  private static async applyClarityXPAdjustment(
    submissionId: number,
    xpImpact: { baseScore: number; clarityBonus: number; totalXP: number }
  ): Promise<void> {
    try {
      // Get submission details for user ID
      const { data: submission } = await supabaseAdmin
        .from('submissions')
        .select('author_id, prompt_text')
        .eq('submission_id', submissionId)
        .single();
        
      if (!submission) {
        throw new Error('Submission not found');
      }
      
      // Only award bonus/penalty if significant
      if (Math.abs(xpImpact.clarityBonus) > 0) {
        await XPService.awardXP({
          userId: submission.author_id,
          eventType: xpImpact.clarityBonus > 0 ? 'CLARITY_BONUS' : 'CLARITY_PENALTY',
          submissionId,
          metadata: {
            clarityScore: xpImpact.baseScore,
            clarityBonus: xpImpact.clarityBonus,
            promptLength: submission.prompt_text?.length || 0
          }
        });
      }
    } catch (error) {
      console.error('Error applying clarity XP adjustment:', error);
      // Non-critical, don't throw
    }
  }
  
  /**
   * Get clarity analysis for a submission
   */
  static async getClarityAnalysis(submissionId: number): Promise<ClarityAnalysis | null> {
    try {
      const { data: submission } = await supabaseAdmin
        .from('submissions')
        .select('clarity_score, metadata')
        .eq('submission_id', submissionId)
        .single();
        
      if (!submission || !submission.metadata?.clarity_analysis) {
        return null;
      }
      
      return {
        clarityScore: submission.clarity_score || 0,
        ...submission.metadata.clarity_analysis
      };
    } catch (error) {
      console.error('Error getting clarity analysis:', error);
      return null;
    }
  }
  
  /**
   * Re-analyze clarity for a submission (admin tool)
   */
  static async reanalyzeClarityScore(submissionId: number): Promise<ClarityScoreData | null> {
    try {
      // Get submission details
      const { data: submission } = await supabaseAdmin
        .from('submissions')
        .select('prompt_text, title, description, tags')
        .eq('submission_id', submissionId)
        .single();
        
      if (!submission) {
        throw new Error('Submission not found');
      }
      
      // Re-run clarity analysis
      return await this.analyzeSubmissionClarity(
        submissionId,
        submission.prompt_text,
        {
          title: submission.title,
          description: submission.description,
          tags: submission.tags
        }
      );
    } catch (error) {
      console.error('Error re-analyzing clarity:', error);
      return null;
    }
  }
  
  /**
   * Get clarity statistics for admin dashboard
   */
  static async getClarityStats(days = 30): Promise<{
    totalAnalyzed: number;
    averageScore: number;
    highQualityCount: number;
    lowQualityCount: number;
    distributionByScore: Array<{ score: number; count: number }>;
    topCategories: Array<{ category: string; count: number }>;
  }> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const { data: submissions } = await supabaseAdmin
        .from('submissions')
        .select('clarity_score, metadata, created_at')
        .gte('created_at', startDate.toISOString())
        .not('clarity_score', 'is', null);
        
      if (!submissions || submissions.length === 0) {
        return {
          totalAnalyzed: 0,
          averageScore: 0,
          highQualityCount: 0,
          lowQualityCount: 0,
          distributionByScore: [],
          topCategories: []
        };
      }
      
      const scores = submissions.map(s => s.clarity_score).filter(s => s !== null);
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const highQualityCount = scores.filter(score => score >= 7).length;
      const lowQualityCount = scores.filter(score => score <= 4).length;
      
      // Score distribution
      const distributionMap = new Map<number, number>();
      scores.forEach(score => {
        const rounded = Math.floor(score);
        distributionMap.set(rounded, (distributionMap.get(rounded) || 0) + 1);
      });
      
      const distributionByScore = Array.from(distributionMap.entries())
        .map(([score, count]) => ({ score, count }))
        .sort((a, b) => a.score - b.score);
      
      // Category analysis from metadata
      const categoryMap = new Map<string, number>();
      submissions.forEach(sub => {
        const categories = sub.metadata?.clarity_analysis?.categories || [];
        categories.forEach((category: string) => {
          categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
        });
      });
      
      const topCategories = Array.from(categoryMap.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      return {
        totalAnalyzed: submissions.length,
        averageScore: Math.round(averageScore * 100) / 100,
        highQualityCount,
        lowQualityCount,
        distributionByScore,
        topCategories
      };
    } catch (error) {
      console.error('Error getting clarity stats:', error);
      return {
        totalAnalyzed: 0,
        averageScore: 0,
        highQualityCount: 0,
        lowQualityCount: 0,
        distributionByScore: [],
        topCategories: []
      };
    }
  }
  
  /**
   * Format clarity analysis for Slack display
   */
  static formatClarityForSlack(analysis: ClarityAnalysis): any[] {
    const scoreEmoji = analysis.clarityScore >= 8 ? '🟢' : 
                     analysis.clarityScore >= 6 ? '🟡' : '🔴';
                     
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${scoreEmoji} *Clarity Analysis*\n\n📊 **Score:** ${analysis.clarityScore}/10\n💭 **Assessment:** ${analysis.reasoning}`
        }
      }
    ];
    
    if (analysis.strengths.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✅ **Strengths:**\n${analysis.strengths.map(s => `• ${s}`).join('\n')}`
        }
      });
    }
    
    if (analysis.weaknesses.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `⚠️ **Areas for Improvement:**\n${analysis.weaknesses.map(w => `• ${w}`).join('\n')}`
        }
      });
    }
    
    if (analysis.suggestions.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `💡 **Suggestions:**\n${analysis.suggestions.map(s => `• ${s}`).join('\n')}`
        }
      });
    }
    
    return blocks;
  }
}