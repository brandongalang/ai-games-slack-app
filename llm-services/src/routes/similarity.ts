import { Router, Request, Response } from 'express';
import OpenAI from 'openai';

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-testing',
});

interface SimilarityRequest {
  prompt1: string;
  prompt2: string;
  title1?: string;
  title2?: string;
}

interface SimilarityResponse {
  similarity_score: number; // 0-1 scale
  is_remix: boolean;
  reasoning: string;
  key_differences?: string[];
}

/**
 * POST /api/similarity/compare
 * Compare two prompts for similarity and remix detection
 */
router.post('/compare', async (req: Request, res: Response) => {
  try {
    const { prompt1, prompt2, title1, title2 }: SimilarityRequest = req.body;

    if (!prompt1 || !prompt2) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Both prompt1 and prompt2 are required'
      });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert at analyzing AI prompts for similarity and remix detection.

Your task is to compare two AI prompts and determine:
1. How similar they are (0.0 = completely different, 1.0 = identical)
2. Whether the second prompt is a "remix" (meaningful variation/improvement) of the first
3. Key differences between them

A "remix" is when someone takes an existing prompt and:
- Adds meaningful improvements or variations
- Adapts it for a different use case
- Enhances clarity or effectiveness
- Builds upon the original concept

Respond with a JSON object containing:
- similarity_score: number (0.0-1.0)
- is_remix: boolean (true if prompt2 is a remix of prompt1)
- reasoning: string (explanation of your analysis)
- key_differences: array of strings (notable differences between the prompts)

Example response:
{
  "similarity_score": 0.7,
  "is_remix": true,
  "reasoning": "The second prompt builds on the first by adding specific formatting requirements and target audience details.",
  "key_differences": ["Added output format specification", "Included target audience", "More specific constraints"]
}`
        },
        {
          role: 'user',
          content: `Compare these two AI prompts:

PROMPT 1${title1 ? ` (${title1})` : ''}:
${prompt1}

PROMPT 2${title2 ? ` (${title2})` : ''}:
${prompt2}`
        }
      ],
      temperature: 0.2,
      max_tokens: 600
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('No response from OpenAI');
    }

    try {
      const result: SimilarityResponse = JSON.parse(responseText);
      
      // Validate response structure
      if (typeof result.similarity_score !== 'number' || 
          result.similarity_score < 0 || 
          result.similarity_score > 1) {
        throw new Error('Invalid similarity score format');
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
          similarity_score: 0.5,
          is_remix: false,
          reasoning: 'Unable to analyze prompt similarity at this time',
          key_differences: []
        },
        metadata: {
          model: 'gpt-4o-mini',
          timestamp: new Date().toISOString(),
          fallback: true
        }
      });
    }

  } catch (error) {
    console.error('Similarity analysis error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to analyze prompt similarity'
    });
  }
});

export { router as similarityRouter };