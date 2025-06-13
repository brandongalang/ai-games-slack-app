import { Router, Request, Response } from 'express';
import OpenAI from 'openai';

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-testing',
});

interface ClarityRequest {
  prompt: string;
  title?: string;
  description?: string;
}

interface ClarityResponse {
  score: number; // 1-10 scale
  reasoning: string;
  suggestions?: string[];
}

/**
 * POST /api/clarity/score
 * Analyze prompt clarity and provide a score
 */
router.post('/score', async (req: Request, res: Response) => {
  try {
    const { prompt, title, description }: ClarityRequest = req.body;

    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Prompt text is required'
      });
    }

    // Create context for the LLM
    const contextParts = [
      title && `Title: ${title}`,
      description && `Description: ${description}`,
      `Prompt: ${prompt}`
    ].filter(Boolean);

    const contextText = contextParts.join('\n\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert AI prompt evaluator. Your job is to analyze AI prompts for clarity, specificity, and effectiveness.

Rate the prompt on a scale of 1-10 where:
- 1-3: Very unclear, vague, or confusing
- 4-6: Moderately clear but could be improved
- 7-8: Clear and well-structured
- 9-10: Exceptionally clear, specific, and effective

Consider these factors:
- Clarity of instructions
- Specificity of requirements
- Proper context and constraints
- Actionability and measurable outcomes
- Grammar and structure

Respond with a JSON object containing:
- score: number (1-10)
- reasoning: string (brief explanation of the score)
- suggestions: array of strings (optional improvement suggestions)

Example response:
{
  "score": 7,
  "reasoning": "The prompt is clear and specific but could benefit from more context about the target audience.",
  "suggestions": ["Add target audience specification", "Include desired output format"]
}`
        },
        {
          role: 'user',
          content: `Please evaluate this AI prompt:\n\n${contextText}`
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('No response from OpenAI');
    }

    try {
      const result: ClarityResponse = JSON.parse(responseText);
      
      // Validate response structure
      if (typeof result.score !== 'number' || result.score < 1 || result.score > 10) {
        throw new Error('Invalid score format');
      }

      res.json({
        success: true,
        data: result,
        metadata: {
          model: 'gpt-4o-mini',
          timestamp: new Date().toISOString()
        }
      });

    } catch (parseError) {
      console.error('Failed to parse LLM response:', responseText);
      
      // Fallback response
      res.json({
        success: true,
        data: {
          score: 5,
          reasoning: 'Unable to analyze prompt clarity at this time',
          suggestions: []
        },
        metadata: {
          model: 'gpt-4o-mini',
          timestamp: new Date().toISOString(),
          fallback: true
        }
      });
    }

  } catch (error) {
    console.error('Clarity scoring error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to analyze prompt clarity'
    });
  }
});

export { router as clarityRouter };