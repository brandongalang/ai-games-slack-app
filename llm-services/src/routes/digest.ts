import { Router, Request, Response } from 'express';
import OpenAI from 'openai';

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-testing',
});

interface DigestRequest {
  prompts: Array<{
    id: number;
    title?: string;
    prompt: string;
    author: string;
    xp_score?: number;
    tags?: string[];
  }>;
  period: 'weekly' | 'mid-week';
  context?: string;
}

interface DigestResponse {
  title: string;
  summary: string;
  highlights: string[];
  trending_themes: string[];
  recommended_prompts: number[];
}

/**
 * POST /api/digest/generate
 * Generate a digest of top prompts for weekly/mid-week summaries
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { prompts, period, context }: DigestRequest = req.body;

    if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Prompts array is required and must not be empty'
      });
    }

    // Prepare prompts data for analysis
    const promptsText = prompts.map((p, index) => 
      `${index + 1}. ${p.title ? `"${p.title}"` : 'Untitled'} by ${p.author}
${p.tags?.length ? `Tags: ${p.tags.join(', ')}` : ''}
${p.xp_score ? `XP Score: ${p.xp_score}` : ''}
Prompt: ${p.prompt.substring(0, 500)}${p.prompt.length > 500 ? '...' : ''}
---`
    ).join('\n\n');

    const periodContext = period === 'weekly' 
      ? 'This is a weekly digest summarizing the best prompts from the past week.'
      : 'This is a mid-week recap highlighting interesting prompts shared recently.';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert content curator for an AI community. Your job is to create engaging digests of submitted AI prompts.

${periodContext}

Your audience is a team of professionals interested in AI tools and workflows. Create a digest that:
- Highlights the most interesting and useful prompts
- Identifies trending themes and patterns
- Provides actionable insights
- Maintains an engaging but professional tone
- Celebrates community contributions

Respond with a JSON object containing:
- title: string (catchy title for the digest)
- summary: string (2-3 sentence overview of the period)
- highlights: array of strings (3-5 key highlights or insights)
- trending_themes: array of strings (2-4 themes/categories that were popular)
- recommended_prompts: array of numbers (indices of 2-3 most recommended prompts from the list, 1-based)

Example response:
{
  "title": "🎯 Weekly AI Prompt Roundup: Creative Solutions Take Center Stage",
  "summary": "This week saw an explosion of creative prompts with a focus on content generation and problem-solving workflows. The community shared 15 new prompts with an average clarity score of 8.2.",
  "highlights": [
    "Creative writing prompts dominated submissions this week",
    "New workflow for automated research showed impressive results",
    "Community engagement up 40% with remix culture taking off"
  ],
  "trending_themes": ["Content Creation", "Research Automation", "Creative Writing"],
  "recommended_prompts": [3, 7, 12]
}`
        },
        {
          role: 'user',
          content: `Create a ${period} digest for these AI prompts:

${context ? `Additional context: ${context}\n\n` : ''}

${promptsText}`
        }
      ],
      temperature: 0.7,
      max_tokens: 800
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('No response from OpenAI');
    }

    try {
      const result: DigestResponse = JSON.parse(responseText);
      
      // Validate response structure
      if (!result.title || !result.summary || !Array.isArray(result.highlights)) {
        throw new Error('Invalid digest format');
      }

      res.json({
        success: true,
        data: result,
        metadata: {
          model: 'gpt-4o-mini',
          timestamp: new Date().toISOString(),
          prompt_count: prompts.length,
          period
        }
      });

    } catch (parseError) {
      console.error('Failed to parse LLM response:', responseText);
      
      // Fallback response
      res.json({
        success: true,
        data: {
          title: `${period === 'weekly' ? 'Weekly' : 'Mid-Week'} AI Prompt Digest`,
          summary: `Here are the ${prompts.length} prompts shared this ${period === 'weekly' ? 'week' : 'period'}.`,
          highlights: [
            `${prompts.length} new prompts shared`,
            'Community continues to grow and share valuable workflows'
          ],
          trending_themes: ['AI Workflows', 'Productivity'],
          recommended_prompts: prompts.slice(0, 3).map((_, index) => index + 1)
        },
        metadata: {
          model: 'gpt-4o-mini',
          timestamp: new Date().toISOString(),
          prompt_count: prompts.length,
          period,
          fallback: true
        }
      });
    }

  } catch (error) {
    console.error('Digest generation error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate digest'
    });
  }
});

export { router as digestRouter };