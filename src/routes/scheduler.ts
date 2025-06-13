import { Router, Request, Response, NextFunction } from 'express';
import { ChallengeService } from '../services/challengeService';
import { SlackService } from '../services/slackService';
import { App } from '@slack/bolt';

const router = Router();

// Middleware to verify scheduler requests (simple API key auth)
const verifySchedulerAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const expectedKey = process.env.SCHEDULER_API_KEY;

  if (!expectedKey) {
    res.status(500).json({
      error: 'Server configuration error',
      message: 'Scheduler authentication not configured'
    });
    return;
  }

  if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid scheduler API key'
    });
    return;
  }

  next();
};

/**
 * POST /scheduler/weekly-challenge
 * Endpoint to be called by cron job every Monday at 9 AM
 */
router.post('/weekly-challenge', verifySchedulerAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Weekly challenge scheduler triggered');

    // Get the current week's challenge
    const currentChallenge = await ChallengeService.getCurrentWeekChallenge();

    if (!currentChallenge) {
      res.status(404).json({
        error: 'No challenge found',
        message: 'No challenge available for the current week'
      });
      return;
    }

    // Check if challenge is already active (already posted)
    if (currentChallenge.is_active) {
      res.json({
        success: true,
        message: 'Challenge already posted this week',
        challenge: currentChallenge
      });
      return;
    }

    // Initialize Slack service (we'll need to pass the app instance)
    const app = req.app.get('slackApp'); // We'll set this in the main app
    if (!app) {
      throw new Error('Slack app not available');
    }

    const slackService = new SlackService(app);

    // Post the challenge
    const messageTs = await slackService.postWeeklyChallenge(currentChallenge);

    res.json({
      success: true,
      message: 'Weekly challenge posted successfully',
      challenge: currentChallenge,
      messageTimestamp: messageTs
    });

  } catch (error) {
    console.error('Error in weekly challenge scheduler:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to post weekly challenge'
    });
  }
});

/**
 * POST /scheduler/challenge-reminder
 * Endpoint for mid-week challenge reminders (Wednesday)
 */
router.post('/challenge-reminder', verifySchedulerAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Challenge reminder scheduler triggered');

    const app = req.app.get('slackApp');
    if (!app) {
      throw new Error('Slack app not available');
    }

    const slackService = new SlackService(app);
    const messageTs = await slackService.postChallengeReminder();

    res.json({
      success: true,
      message: 'Challenge reminder posted successfully',
      messageTimestamp: messageTs
    });

  } catch (error) {
    console.error('Error in challenge reminder scheduler:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to post challenge reminder'
    });
  }
});

/**
 * POST /scheduler/challenge-results
 * Endpoint for weekly challenge results (Sunday evening)
 */
router.post('/challenge-results', verifySchedulerAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Challenge results scheduler triggered');

    const currentChallenge = await ChallengeService.getCurrentWeekChallenge();

    if (!currentChallenge || !currentChallenge.is_active) {
      res.status(404).json({
        error: 'No active challenge found',
        message: 'No active challenge to generate results for'
      });
      return;
    }

    const app = req.app.get('slackApp');
    if (!app) {
      throw new Error('Slack app not available');
    }

    const slackService = new SlackService(app);
    const messageTs = await slackService.postChallengeResults(currentChallenge);

    res.json({
      success: true,
      message: 'Challenge results posted successfully',
      challenge: currentChallenge,
      messageTimestamp: messageTs
    });

  } catch (error) {
    console.error('Error in challenge results scheduler:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to post challenge results'
    });
  }
});

/**
 * GET /scheduler/status
 * Health check and current challenge status
 */
router.get('/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const currentChallenge = await ChallengeService.getCurrentWeekChallenge();
    const nextChallenge = await ChallengeService.getNextWeekChallenge();

    res.json({
      success: true,
      status: 'healthy',
      currentChallenge: currentChallenge ? {
        week: currentChallenge.week_number,
        isActive: currentChallenge.is_active,
        prompt: currentChallenge.prompt_text.substring(0, 100) + '...'
      } : null,
      nextChallenge: nextChallenge ? {
        week: nextChallenge.week_number,
        prompt: nextChallenge.prompt_text.substring(0, 100) + '...'
      } : null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting scheduler status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get scheduler status'
    });
  }
});

/**
 * POST /scheduler/manual-trigger
 * Manual trigger for testing (only in development)
 */
router.post('/manual-trigger', async (req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Manual trigger not allowed in production'
    });
    return;
  }

  try {
    const { type } = req.body;
    const app = req.app.get('slackApp');
    
    if (!app) {
      throw new Error('Slack app not available');
    }

    switch (type) {
      case 'weekly-challenge': {
        const currentChallenge = await ChallengeService.getCurrentWeekChallenge();
        if (!currentChallenge) {
          res.status(404).json({
            error: 'No challenge found',
            message: 'No challenge available for the current week'
          });
          return;
        }

        const slackService = new SlackService(app);
        const messageTs = await slackService.postWeeklyChallenge(currentChallenge);
        
        res.json({
          success: true,
          message: 'Weekly challenge posted successfully',
          challenge: currentChallenge,
          messageTimestamp: messageTs
        });
        return;
      }
        
      case 'reminder': {
        const slackService = new SlackService(app);
        const messageTs = await slackService.postChallengeReminder();
        
        res.json({
          success: true,
          message: 'Challenge reminder posted successfully',
          messageTimestamp: messageTs
        });
        return;
      }
        
      case 'results': {
        const currentChallenge = await ChallengeService.getCurrentWeekChallenge();
        if (!currentChallenge || !currentChallenge.is_active) {
          res.status(404).json({
            error: 'No active challenge found',
            message: 'No active challenge to generate results for'
          });
          return;
        }

        const slackService = new SlackService(app);
        const messageTs = await slackService.postChallengeResults(currentChallenge);
        
        res.json({
          success: true,
          message: 'Challenge results posted successfully',
          challenge: currentChallenge,
          messageTimestamp: messageTs
        });
        return;
      }
        
      default:
        res.status(400).json({
          error: 'Invalid trigger type',
          message: 'Valid types: weekly-challenge, reminder, results'
        });
        return;
    }

  } catch (error) {
    console.error('Error in manual trigger:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to execute manual trigger'
    });
  }
});

export { router as schedulerRouter };