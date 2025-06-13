import { completion } from 'litellm';

export interface LLMResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class LLMService {
  private static readonly DEFAULT_MODEL = process.env.LLM_MODEL || 'gemini/gemini-1.5-flash';
  private static readonly MAX_TOKENS = parseInt(process.env.LLM_MAX_TOKENS || '2048');
  private static readonly TEMPERATURE = parseFloat(process.env.LLM_TEMPERATURE || '0.3');

  /**
   * Make a completion request to the configured LLM
   */
  static async completion(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      responseFormat?: 'text' | 'json';
    } = {}
  ): Promise<LLMResponse> {
    try {
      const response = await completion({
        model: options.model || this.DEFAULT_MODEL,
        messages,
        temperature: options.temperature ?? this.TEMPERATURE,
        max_tokens: options.maxTokens || this.MAX_TOKENS,
        // Add response format handling for JSON responses
        ...(options.responseFormat === 'json' && {
          response_format: { type: 'json_object' }
        })
      });

      return {
        content: response.choices[0]?.message?.content || '',
        usage: response.usage ? {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens
        } : undefined
      };
    } catch (error) {
      console.error('LLM Service Error:', error);
      throw new Error(`LLM completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze similarity between two text submissions
   */
  static async analyzeSimilarity(text1: string, text2: string): Promise<{
    similarityScore: number;
    similarityType: 'exact_duplicate' | 'near_duplicate' | 'remix' | 'inspired' | 'original';
    confidence: number;
    reasoning: string;
    matchedSections: Array<{
      sourceText: string;
      targetText: string;
      similarity: number;
    }>;
  }> {
    const prompt = `Analyze the similarity between these two AI prompt submissions:

**Submission 1:**
${text1}

**Submission 2:**
${text2}

Please provide a detailed similarity analysis in JSON format with:
1. similarityScore (0-100): Overall similarity percentage
2. similarityType: "exact_duplicate", "near_duplicate", "remix", "inspired", or "original"
3. confidence (0-100): How confident you are in this assessment
4. reasoning: Detailed explanation of the similarity assessment
5. matchedSections: Array of similar text segments with their similarity scores

Consider:
- Exact word matches vs. conceptual similarity
- Structure and format similarities
- Intent and purpose alignment
- Whether one builds meaningfully on the other

Respond with valid JSON only.`;

    try {
      const response = await this.completion([
        { role: 'user', content: prompt }
      ], {
        responseFormat: 'json',
        temperature: 0.2
      });

      const analysis = JSON.parse(response.content);
      
      // Validate and sanitize the response
      return {
        similarityScore: Math.min(100, Math.max(0, analysis.similarityScore || 0)),
        similarityType: analysis.similarityType || 'original',
        confidence: Math.min(100, Math.max(0, analysis.confidence || 85)),
        reasoning: analysis.reasoning || 'Analysis completed',
        matchedSections: Array.isArray(analysis.matchedSections) ? analysis.matchedSections : []
      };
    } catch (error) {
      console.error('Error analyzing similarity:', error);
      // Fallback to basic text similarity if LLM fails
      const basicSimilarity = this.calculateBasicSimilarity(text1, text2);
      return {
        similarityScore: basicSimilarity,
        similarityType: basicSimilarity > 90 ? 'exact_duplicate' : 
                       basicSimilarity > 75 ? 'near_duplicate' :
                       basicSimilarity > 50 ? 'remix' :
                       basicSimilarity > 25 ? 'inspired' : 'original',
        confidence: 70,
        reasoning: 'Fallback analysis due to LLM service error',
        matchedSections: []
      };
    }
  }

  /**
   * Analyze remix quality and improvements
   */
  static async analyzeRemixQuality(originalText: string, remixText: string): Promise<{
    improvementScore: number;
    improvementAreas: string[];
    addedValue: string[];
    qualityDelta: number;
    isGenuineImprovement: boolean;
    reasoning: string;
  }> {
    const prompt = `Analyze how this remix improves upon the original AI prompt:

**Original Prompt:**
${originalText}

**Remix/Improved Version:**
${remixText}

Please provide a detailed remix quality analysis in JSON format with:
1. improvementScore (0-100): How much the remix improves the original
2. improvementAreas: Array of specific areas where improvements were made
3. addedValue: Array of specific value additions in the remix
4. qualityDelta (-100 to +100): Overall quality change from original
5. isGenuineImprovement (boolean): Whether this is a meaningful improvement
6. reasoning: Detailed explanation of the quality assessment

Consider:
- Clarity and specificity improvements
- Added context or examples
- Better structure or formatting
- Enhanced instructions or guidance
- Removal of ambiguity
- New use cases or applications

Respond with valid JSON only.`;

    try {
      const response = await this.completion([
        { role: 'user', content: prompt }
      ], {
        responseFormat: 'json',
        temperature: 0.2
      });

      const analysis = JSON.parse(response.content);
      
      return {
        improvementScore: Math.min(100, Math.max(0, analysis.improvementScore || 50)),
        improvementAreas: Array.isArray(analysis.improvementAreas) ? analysis.improvementAreas : [],
        addedValue: Array.isArray(analysis.addedValue) ? analysis.addedValue : [],
        qualityDelta: Math.min(100, Math.max(-100, analysis.qualityDelta || 0)),
        isGenuineImprovement: analysis.isGenuineImprovement || false,
        reasoning: analysis.reasoning || 'Analysis completed'
      };
    } catch (error) {
      console.error('Error analyzing remix quality:', error);
      // Fallback analysis
      const lengthRatio = remixText.length / originalText.length;
      const improvementScore = lengthRatio > 1.2 ? 70 : lengthRatio > 1.1 ? 50 : 30;
      
      return {
        improvementScore,
        improvementAreas: lengthRatio > 1.2 ? ['Added more detail'] : [],
        addedValue: lengthRatio > 1.2 ? ['Enhanced instructions'] : [],
        qualityDelta: improvementScore - 50,
        isGenuineImprovement: improvementScore > 60,
        reasoning: 'Fallback analysis based on length comparison'
      };
    }
  }

  /**
   * Analyze comment helpfulness and quality
   */
  static async analyzeCommentHelpfulness(
    submissionText: string,
    commentText: string,
    submissionContext?: { title?: string; description?: string; tags?: string[] }
  ): Promise<{
    helpfulnessScore: number;
    isHelpful: boolean;
    confidence: number;
    reasoning: string;
    categories: string[];
    suggestedImprovements?: string[];
  }> {
    const contextInfo = submissionContext ? `
**Submission Title:** ${submissionContext.title || 'N/A'}
**Description:** ${submissionContext.description || 'N/A'}
**Tags:** ${submissionContext.tags?.join(', ') || 'N/A'}` : '';

    const prompt = `Analyze the helpfulness of this comment on an AI prompt submission:

**Original Submission:**
${submissionText}
${contextInfo}

**Comment to Analyze:**
${commentText}

Please evaluate the comment's helpfulness in JSON format with:
1. helpfulnessScore (0-100): Overall helpfulness score
2. isHelpful (boolean): Whether the comment provides meaningful value
3. confidence (0-100): Confidence in this assessment
4. reasoning: Detailed explanation of the helpfulness assessment
5. categories: Array of helpful categories (e.g., "improvement_suggestion", "clarification", "use_case", "technical_insight", "encouragement")
6. suggestedImprovements: Array of ways the comment could be more helpful (optional)

Consider these factors for helpfulness:
- Provides specific, actionable feedback
- Suggests concrete improvements
- Adds relevant context or examples
- Clarifies ambiguous parts
- Shares related experiences or use cases
- Offers technical insights
- Encourages constructive iteration

Unhelpful patterns:
- Generic praise without specifics ("Great job!")
- Criticism without constructive suggestions
- Off-topic or irrelevant content
- Spam or low-effort responses

Respond with valid JSON only.`;

    try {
      const response = await this.completion([
        { role: 'user', content: prompt }
      ], {
        responseFormat: 'json',
        temperature: 0.2
      });

      const analysis = JSON.parse(response.content);
      
      return {
        helpfulnessScore: Math.min(100, Math.max(0, analysis.helpfulnessScore || 0)),
        isHelpful: analysis.isHelpful || false,
        confidence: Math.min(100, Math.max(0, analysis.confidence || 85)),
        reasoning: analysis.reasoning || 'Analysis completed',
        categories: Array.isArray(analysis.categories) ? analysis.categories : [],
        suggestedImprovements: Array.isArray(analysis.suggestedImprovements) ? analysis.suggestedImprovements : undefined
      };
    } catch (error) {
      console.error('Error analyzing comment helpfulness:', error);
      
      // Fallback analysis based on comment length and keywords
      const helpfulKeywords = ['improve', 'suggest', 'consider', 'try', 'example', 'better', 'add', 'clarify', 'specific'];
      const unhelpfulKeywords = ['great', 'awesome', 'nice', 'good job', 'love it'];
      
      const helpfulCount = helpfulKeywords.filter(keyword => 
        commentText.toLowerCase().includes(keyword)
      ).length;
      
      const unhelpfulCount = unhelpfulKeywords.filter(keyword => 
        commentText.toLowerCase().includes(keyword)
      ).length;
      
      const lengthScore = Math.min(50, commentText.length / 4); // Up to 50 points for length
      const keywordScore = (helpfulCount * 10) - (unhelpfulCount * 5);
      const helpfulnessScore = Math.min(100, Math.max(0, lengthScore + keywordScore));
      
      return {
        helpfulnessScore,
        isHelpful: helpfulnessScore >= 60,
        confidence: 60,
        reasoning: 'Fallback analysis based on keywords and length (LLM unavailable)',
        categories: helpfulCount > 0 ? ['improvement_suggestion'] : ['general_feedback']
      };
    }
  }

  /**
   * Analyze prompt clarity and provide improvement suggestions
   */
  static async analyzePromptClarity(
    promptText: string,
    promptContext?: { title?: string; description?: string; tags?: string[] }
  ): Promise<{
    clarityScore: number;
    reasoning: string;
    suggestions: string[];
    categories: string[];
    strengths: string[];
    weaknesses: string[];
  }> {
    try {
      const contextInfo = promptContext ? `
**Title:** ${promptContext.title || 'N/A'}
**Description:** ${promptContext.description || 'N/A'}
**Tags:** ${promptContext.tags?.join(', ') || 'N/A'}` : '';

      const prompt = `Analyze the clarity and effectiveness of this AI prompt:

**Prompt to Analyze:**
${promptText}
${contextInfo}

Please evaluate the prompt's clarity in JSON format with:
1. clarityScore (1-10): Overall clarity and effectiveness rating
2. reasoning: Detailed explanation of the score
3. suggestions: Array of specific improvement recommendations
4. categories: Array of clarity aspects (e.g., "specificity", "context", "structure", "actionability", "constraints")
5. strengths: Array of what the prompt does well
6. weaknesses: Array of areas that need improvement

Rating Scale:
- 1-3: Very unclear, vague, or confusing
- 4-6: Moderately clear but needs significant improvement  
- 7-8: Clear and well-structured with minor improvements needed
- 9-10: Exceptionally clear, specific, and effective

Consider these clarity factors:
- Clarity of instructions and expectations
- Specificity of requirements and constraints
- Proper context and background information
- Actionability and measurable outcomes
- Structure and organization
- Grammar and language quality
- Appropriate level of detail
- Clear success criteria`;

      const response = await this.completion(
        [
          {
            role: 'system',
            content: 'You are an expert AI prompt evaluator. Provide thorough, constructive analysis to help improve prompt quality. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        {
          temperature: 0.3,
          maxTokens: 1000,
          responseFormat: 'json'
        }
      );

      const analysis = JSON.parse(response.content);
      
      // Validate and normalize the response
      return {
        clarityScore: Math.min(10, Math.max(1, Number(analysis.clarityScore) || 5)),
        reasoning: analysis.reasoning || 'Unable to provide detailed analysis',
        suggestions: Array.isArray(analysis.suggestions) ? analysis.suggestions : [],
        categories: Array.isArray(analysis.categories) ? analysis.categories : ['general'],
        strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
        weaknesses: Array.isArray(analysis.weaknesses) ? analysis.weaknesses : []
      };
    } catch (error) {
      console.error('Error analyzing prompt clarity:', error);
      
      // Fallback analysis based on basic heuristics
      return this.generateFallbackClarityAnalysis(promptText);
    }
  }

  /**
   * Fallback clarity analysis using basic heuristics
   */
  private static generateFallbackClarityAnalysis(promptText: string): {
    clarityScore: number;
    reasoning: string;
    suggestions: string[];
    categories: string[];
    strengths: string[];
    weaknesses: string[];
  } {
    const text = promptText.toLowerCase();
    const wordCount = promptText.split(/\s+/).length;
    
    let score = 5; // Base score
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const suggestions: string[] = [];
    
    // Word count analysis
    if (wordCount < 10) {
      weaknesses.push('Very short prompt');
      suggestions.push('Add more specific details and context');
      score -= 2;
    } else if (wordCount > 200) {
      weaknesses.push('Very long prompt');
      suggestions.push('Consider breaking down into smaller, focused parts');
      score -= 1;
    } else {
      strengths.push('Appropriate length');
    }
    
    // Question words (good for clarity)
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'which'];
    const hasQuestions = questionWords.some(word => text.includes(word));
    if (hasQuestions) {
      strengths.push('Uses clear question structure');
      score += 1;
    }
    
    // Specific instruction words
    const instructionWords = ['create', 'generate', 'analyze', 'summarize', 'explain', 'list', 'describe'];
    const hasInstructions = instructionWords.some(word => text.includes(word));
    if (hasInstructions) {
      strengths.push('Contains clear action words');
      score += 1;
    } else {
      weaknesses.push('Lacks clear action instructions');
      suggestions.push('Use specific action verbs like "create", "analyze", or "explain"');
    }
    
    // Context indicators
    const contextWords = ['context', 'background', 'purpose', 'goal', 'audience'];
    const hasContext = contextWords.some(word => text.includes(word));
    if (hasContext) {
      strengths.push('Provides context');
      score += 1;
    }
    
    // Constraint indicators  
    const constraintWords = ['format', 'length', 'style', 'tone', 'limit'];
    const hasConstraints = constraintWords.some(word => text.includes(word));
    if (hasConstraints) {
      strengths.push('Includes constraints or format specifications');
      score += 1;
    } else {
      suggestions.push('Consider adding format or style constraints');
    }
    
    // Ensure score is within bounds
    score = Math.min(10, Math.max(1, score));
    
    return {
      clarityScore: score,
      reasoning: `Fallback analysis based on basic heuristics (LLM unavailable). Score: ${score}/10`,
      suggestions,
      categories: ['structure', 'specificity'],
      strengths,
      weaknesses
    };
  }

  /**
   * Fallback basic similarity calculation using simple text comparison
   */
  private static calculateBasicSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return (intersection.size / union.size) * 100;
  }
}