import { supabaseAdmin } from '../database/supabase';
import { XPService } from './xpService';
import { LLMService } from './llmService';

export interface SimilarityAnalysis {
  submissionId: number;
  targetSubmissionId: number;
  similarityScore: number; // 0-100
  similarityType: 'exact_duplicate' | 'near_duplicate' | 'remix' | 'inspired' | 'original';
  confidence: number; // 0-100
  reasoning: string;
  matchedSections: Array<{
    sourceText: string;
    targetText: string;
    similarity: number;
  }>;
  recommendations: {
    shouldAllow: boolean;
    xpAdjustment: number;
    flagForReview: boolean;
    suggestedActions: string[];
  };
}

export interface RemixQualityAnalysis {
  originalSubmissionId: number;
  remixSubmissionId: number;
  improvementScore: number; // 0-100
  improvementAreas: string[];
  addedValue: string[];
  qualityDelta: number; // -100 to +100
  isGenuineImprovement: boolean;
  reasoning: string;
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  duplicateOf?: number;
  similarityScore: number;
  action: 'allow' | 'flag' | 'reject';
  reasoning: string;
}

export class SimilarityService {
  /**
   * Analyze similarity between two submissions
   */
  static async analyzeSimilarity(
    submissionId: number,
    targetSubmissionId: number
  ): Promise<SimilarityAnalysis> {
    // Get both submissions
    const [submission, targetSubmission] = await Promise.all([
      this.getSubmissionContent(submissionId),
      this.getSubmissionContent(targetSubmissionId)
    ]);

    if (!submission || !targetSubmission) {
      throw new Error('One or both submissions not found');
    }

    // Perform LLM-based similarity analysis
    const analysis = await this.performLLMSimilarityAnalysis(
      submission,
      targetSubmission
    );

    // Store similarity result
    await this.storeSimilarityResult(submissionId, targetSubmissionId, analysis);

    return analysis;
  }

  /**
   * Check for duplicates when creating a new submission
   */
  static async checkForDuplicates(
    promptText: string,
    authorId: number,
    excludeSubmissionIds: number[] = []
  ): Promise<DuplicateDetectionResult> {
    // Get recent submissions from other users for comparison
    const { data: recentSubmissions } = await supabaseAdmin
      .from('submissions')
      .select('submission_id, prompt_text, author_id, title')
      .neq('author_id', authorId) // Exclude user's own submissions
      .not('submission_id', 'in', `(${excludeSubmissionIds.join(',') || '0'})`)
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()) // Last 90 days
      .order('created_at', { ascending: false })
      .limit(50);

    if (!recentSubmissions || recentSubmissions.length === 0) {
      return {
        isDuplicate: false,
        similarityScore: 0,
        action: 'allow',
        reasoning: 'No similar submissions found for comparison'
      };
    }

    // Find the most similar submission
    let highestSimilarity = 0;
    let mostSimilarSubmission: any = null;

    for (const existing of recentSubmissions) {
      const similarity = await this.calculateTextSimilarity(promptText, existing.prompt_text);
      
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        mostSimilarSubmission = existing;
      }
    }

    // Determine action based on similarity
    let action: 'allow' | 'flag' | 'reject' = 'allow';
    let reasoning = '';

    if (highestSimilarity >= 90) {
      action = 'reject';
      reasoning = `Exact duplicate detected (${highestSimilarity}% similar to submission by ${mostSimilarSubmission?.title || 'another user'})`;
    } else if (highestSimilarity >= 75) {
      action = 'flag';
      reasoning = `Near duplicate detected (${highestSimilarity}% similar). Consider adding more original content or explicitly marking as a remix.`;
    } else if (highestSimilarity >= 50) {
      action = 'allow';
      reasoning = `Some similarity detected (${highestSimilarity}%), but within acceptable range for inspired content.`;
    } else {
      reasoning = `Original content detected (${highestSimilarity}% similarity).`;
    }

    return {
      isDuplicate: highestSimilarity >= 75,
      duplicateOf: highestSimilarity >= 75 ? mostSimilarSubmission?.submission_id : undefined,
      similarityScore: highestSimilarity,
      action,
      reasoning
    };
  }

  /**
   * Analyze remix quality compared to original
   */
  static async analyzeRemixQuality(
    originalSubmissionId: number,
    remixSubmissionId: number
  ): Promise<RemixQualityAnalysis> {
    const [original, remix] = await Promise.all([
      this.getSubmissionContent(originalSubmissionId),
      this.getSubmissionContent(remixSubmissionId)
    ]);

    if (!original || !remix) {
      throw new Error('Original or remix submission not found');
    }

    // Perform LLM-based remix quality analysis
    const analysis = await this.performLLMRemixAnalysis(original, remix);

    // Store remix analysis
    await this.storeRemixAnalysis(originalSubmissionId, remixSubmissionId, analysis);

    // Award appropriate XP based on remix quality
    if (analysis.isGenuineImprovement) {
      await XPService.awardXP({
        userId: remix.authorId,
        eventType: 'REMIX_IMPROVED',
        submissionId: remixSubmissionId,
        metadata: {
          originalSubmissionId,
          improvementScore: analysis.improvementScore,
          qualityDelta: analysis.qualityDelta,
          addedValue: analysis.addedValue
        }
      });
    } else {
      await XPService.awardXP({
        userId: remix.authorId,
        eventType: 'REMIX_ORIGINAL',
        submissionId: remixSubmissionId,
        metadata: {
          originalSubmissionId,
          improvementScore: analysis.improvementScore,
          reasoning: analysis.reasoning
        }
      });
    }

    return analysis;
  }

  /**
   * Get all similar submissions for a given submission
   */
  static async findSimilarSubmissions(
    submissionId: number,
    threshold = 30,
    limit = 10
  ): Promise<Array<{
    submission: any;
    similarityScore: number;
    similarityType: string;
  }>> {
    const submission = await this.getSubmissionContent(submissionId);
    if (!submission) {
      throw new Error('Submission not found');
    }

    // Get all other submissions for comparison
    const { data: allSubmissions } = await supabaseAdmin
      .from('submissions')
      .select('submission_id, prompt_text, title, author_id, created_at')
      .neq('submission_id', submissionId)
      .order('created_at', { ascending: false })
      .limit(200); // Limit for performance

    if (!allSubmissions) return [];

    const similarities = [];

    for (const other of allSubmissions) {
      const similarity = await this.calculateTextSimilarity(
        submission.promptText,
        other.prompt_text
      );

      if (similarity >= threshold) {
        similarities.push({
          submission: other,
          similarityScore: similarity,
          similarityType: this.classifySimilarity(similarity)
        });
      }
    }

    return similarities
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit);
  }

  /**
   * Generate similarity report for admin review
   */
  static async generateSimilarityReport(days = 7): Promise<{
    totalSubmissions: number;
    duplicatesDetected: number;
    remixesIdentified: number;
    flaggedForReview: number;
    topSimilarities: Array<{
      submission1: any;
      submission2: any;
      similarityScore: number;
      action: string;
    }>;
  }> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    // Get recent submissions
    const { data: recentSubmissions } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (!recentSubmissions) {
      return {
        totalSubmissions: 0,
        duplicatesDetected: 0,
        remixesIdentified: 0,
        flaggedForReview: 0,
        topSimilarities: []
      };
    }

    // This would involve extensive similarity checking
    // For now, return mock data structure
    return {
      totalSubmissions: recentSubmissions.length,
      duplicatesDetected: 0,
      remixesIdentified: 0,
      flaggedForReview: 0,
      topSimilarities: []
    };
  }

  /**
   * Private helper methods
   */
  private static async getSubmissionContent(submissionId: number): Promise<{
    submissionId: number;
    promptText: string;
    title?: string;
    description?: string;
    authorId: number;
    tags: string[];
    submissionType: string;
  } | null> {
    const { data, error } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('submission_id', submissionId)
      .single();

    if (error || !data) return null;

    return {
      submissionId: data.submission_id,
      promptText: data.prompt_text,
      title: data.title,
      description: data.description,
      authorId: data.author_id,
      tags: data.tags || [],
      submissionType: data.submission_type
    };
  }

  private static async performLLMSimilarityAnalysis(
    submission1: any,
    submission2: any
  ): Promise<SimilarityAnalysis> {
    try {
      // Use LiteLLM with Gemini to analyze similarity
      const llmAnalysis = await LLMService.analyzeSimilarity(
        submission1.promptText,
        submission2.promptText
      );

      const shouldAllow = llmAnalysis.similarityScore < 90;
      const xpAdjustment = this.calculateXPAdjustment(llmAnalysis.similarityScore, llmAnalysis.similarityType);
      const flagForReview = llmAnalysis.similarityScore >= 75;

      return {
        submissionId: submission1.submissionId,
        targetSubmissionId: submission2.submissionId,
        similarityScore: llmAnalysis.similarityScore,
        similarityType: llmAnalysis.similarityType,
        confidence: llmAnalysis.confidence,
        reasoning: llmAnalysis.reasoning,
        matchedSections: llmAnalysis.matchedSections,
        recommendations: {
          shouldAllow,
          xpAdjustment,
          flagForReview,
          suggestedActions: this.generateSuggestedActions(llmAnalysis.similarityScore, llmAnalysis.similarityType)
        }
      };
    } catch (error) {
      console.error('LLM similarity analysis failed, falling back to basic analysis:', error);
      
      // Fallback to basic text similarity if LLM fails
      const textSimilarity = await this.calculateTextSimilarity(
        submission1.promptText,
        submission2.promptText
      );

      let similarityType: SimilarityAnalysis['similarityType'] = 'original';
      let reasoning = 'Basic text similarity analysis (LLM unavailable)';

      if (textSimilarity >= 90) {
        similarityType = 'exact_duplicate';
        reasoning = 'Text is nearly identical with minimal variation';
      } else if (textSimilarity >= 75) {
        similarityType = 'near_duplicate';
        reasoning = 'Substantial similarity with minor modifications';
      } else if (textSimilarity >= 50) {
        similarityType = 'remix';
        reasoning = 'Clear inspiration with meaningful modifications';
      } else if (textSimilarity >= 25) {
        similarityType = 'inspired';
        reasoning = 'Some similar concepts but mostly original';
      }

      const shouldAllow = textSimilarity < 90;
      const xpAdjustment = this.calculateXPAdjustment(textSimilarity, similarityType);
      const flagForReview = textSimilarity >= 75;

      return {
        submissionId: submission1.submissionId,
        targetSubmissionId: submission2.submissionId,
        similarityScore: textSimilarity,
        similarityType,
        confidence: 70,
        reasoning,
        matchedSections: [],
        recommendations: {
          shouldAllow,
          xpAdjustment,
          flagForReview,
          suggestedActions: this.generateSuggestedActions(textSimilarity, similarityType)
        }
      };
    }
  }

  private static async performLLMRemixAnalysis(
    original: any,
    remix: any
  ): Promise<RemixQualityAnalysis> {
    try {
      // Use LiteLLM with Gemini to analyze remix quality
      const llmAnalysis = await LLMService.analyzeRemixQuality(
        original.promptText,
        remix.promptText
      );

      return {
        originalSubmissionId: original.submissionId,
        remixSubmissionId: remix.submissionId,
        improvementScore: llmAnalysis.improvementScore,
        improvementAreas: llmAnalysis.improvementAreas,
        addedValue: llmAnalysis.addedValue,
        qualityDelta: llmAnalysis.qualityDelta,
        isGenuineImprovement: llmAnalysis.isGenuineImprovement,
        reasoning: llmAnalysis.reasoning
      };
    } catch (error) {
      console.error('LLM remix analysis failed, falling back to basic analysis:', error);
      
      // Fallback to basic analysis if LLM fails
      const textSimilarity = await this.calculateTextSimilarity(
        original.promptText,
        remix.promptText
      );

      const improvementScore = Math.max(0, 100 - textSimilarity + Math.random() * 30);
      const qualityDelta = (improvementScore - 50) * 2; // -100 to +100
      const isGenuineImprovement = improvementScore > 60 && qualityDelta > 10;

      const improvementAreas = [];
      const addedValue = [];

      if (remix.promptText.length > original.promptText.length * 1.2) {
        improvementAreas.push('Added more detailed instructions');
        addedValue.push('Enhanced clarity and specificity');
      }

      if (remix.description && remix.description.length > (original.description?.length || 0)) {
        improvementAreas.push('Improved documentation');
        addedValue.push('Better explanation of use cases');
      }

      const reasoning = isGenuineImprovement
        ? `Significant improvements detected: ${addedValue.join(', ')} (basic analysis - LLM unavailable)`
        : 'Minimal improvements over original submission (basic analysis - LLM unavailable)';

      return {
        originalSubmissionId: original.submissionId,
        remixSubmissionId: remix.submissionId,
        improvementScore,
        improvementAreas,
        addedValue,
        qualityDelta,
        isGenuineImprovement,
        reasoning
      };
    }
  }

  private static async calculateTextSimilarity(text1: string, text2: string): Promise<number> {
    // Simple similarity calculation - in production, use more sophisticated methods
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    const jaccardSimilarity = intersection.size / union.size;
    
    // Adjust for length differences
    const lengthRatio = Math.min(text1.length, text2.length) / Math.max(text1.length, text2.length);
    
    return Math.round((jaccardSimilarity * lengthRatio) * 100);
  }

  private static classifySimilarity(score: number): string {
    if (score >= 90) return 'exact_duplicate';
    if (score >= 75) return 'near_duplicate';
    if (score >= 50) return 'remix';
    if (score >= 25) return 'inspired';
    return 'original';
  }

  private static calculateXPAdjustment(similarity: number, type: string): number {
    if (type === 'exact_duplicate') return -10;
    if (type === 'near_duplicate') return -5;
    if (type === 'remix') return 0;
    if (type === 'inspired') return 2;
    return 5; // original content bonus
  }

  private static generateSuggestedActions(similarity: number, type: string): string[] {
    const actions = [];
    
    if (similarity >= 90) {
      actions.push('Reject submission as duplicate');
      actions.push('Notify user about duplicate content policy');
    } else if (similarity >= 75) {
      actions.push('Flag for manual review');
      actions.push('Suggest user marks as remix if intentional');
    } else if (similarity >= 50) {
      actions.push('Consider marking as remix');
      actions.push('Award remix XP if improvements are present');
    } else {
      actions.push('Approve as original content');
      actions.push('Award standard XP');
    }
    
    return actions;
  }

  private static async storeSimilarityResult(
    submissionId: number,
    targetSubmissionId: number,
    analysis: SimilarityAnalysis
  ): Promise<void> {
    try {
      // Store similarity analysis (would require a new table)
      console.log(`Similarity analysis stored: ${submissionId} vs ${targetSubmissionId} = ${analysis.similarityScore}%`);
      
      // Update submission with similarity score
      await supabaseAdmin
        .from('submissions')
        .update({ 
          llm_similarity_score: analysis.similarityScore,
          updated_at: new Date().toISOString()
        })
        .eq('submission_id', submissionId);
        
    } catch (error) {
      console.error('Error storing similarity result:', error);
    }
  }

  private static async storeRemixAnalysis(
    originalId: number,
    remixId: number,
    analysis: RemixQualityAnalysis
  ): Promise<void> {
    try {
      console.log(`Remix analysis stored: ${remixId} improves ${originalId} by ${analysis.improvementScore}%`);
      
      // Update remix submission with quality metrics
      await supabaseAdmin
        .from('submissions')
        .update({
          llm_similarity_score: analysis.improvementScore,
          updated_at: new Date().toISOString()
        })
        .eq('submission_id', remixId);
        
    } catch (error) {
      console.error('Error storing remix analysis:', error);
    }
  }

  /**
   * Format similarity analysis for Slack display
   */
  static formatSimilarityForSlack(analysis: SimilarityAnalysis): any[] {
    const { similarityScore, similarityType, reasoning, recommendations } = analysis;
    
    const typeEmoji = {
      exact_duplicate: '🚨',
      near_duplicate: '⚠️',
      remix: '🎵',
      inspired: '💡',
      original: '✨'
    };

    const typeText = {
      exact_duplicate: 'Exact Duplicate',
      near_duplicate: 'Near Duplicate',
      remix: 'Remix',
      inspired: 'Inspired Content',
      original: 'Original Content'
    };

    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${typeEmoji[similarityType]} *Similarity Analysis*\n\n*Type:* ${typeText[similarityType]}\n*Similarity Score:* ${similarityScore}%\n*Recommendation:* ${recommendations.shouldAllow ? 'Allow' : 'Review'}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Analysis:* ${reasoning}`
        }
      },
      ...(recommendations.suggestedActions.length > 0 ? [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Suggested Actions:*\n${recommendations.suggestedActions.map(action => `• ${action}`).join('\n')}`
        }
      }] : [])
    ];
  }
}