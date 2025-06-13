import { Router } from 'express';
import { StreakService } from '../services/streakService';

const router = Router();

/**
 * Daily streak processing endpoint
 * Should be called once per day by a cron job or scheduler
 */
router.post('/process-daily', async (req, res) => {
  try {
    console.log('Starting daily streak processing via API...');
    
    // Get the Slack app instance from Express app
    const slackApp = req.app.get('slackApp');
    
    if (!slackApp) {
      throw new Error('Slack app not available');
    }

    // Process daily streaks
    const streakStats = await StreakService.processDailyStreaks();
    
    // Send nudge DMs to at-risk users
    const nudgeCount = await StreakService.sendDailyNudges(slackApp);
    
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        ...streakStats,
        nudgesSent: nudgeCount
      },
      message: 'Daily streak processing completed successfully'
    };

    console.log('Daily streak processing completed:', response.stats);
    res.json(response);
    
  } catch (error) {
    console.error('Error processing daily streaks:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get streak statistics endpoint
 */
router.get('/stats', async (req, res) => {
  try {
    const streakLeaders = await StreakService.getStreakLeaders(20);
    const atRiskUsers = await StreakService.getAtRiskUsers();
    
    res.json({
      success: true,
      data: {
        streakLeaders,
        atRiskUsersCount: atRiskUsers.length,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error fetching streak stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get specific user's streak data
 */
router.get('/user/:userId', async (req: any, res: any) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }

    const streakData = await StreakService.calculateUserStreak(userId);
    
    res.json({
      success: true,
      data: streakData
    });
    
  } catch (error) {
    console.error('Error fetching user streak data:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Manual nudge endpoint (for testing or admin use)
 */
router.post('/send-nudges', async (req, res) => {
  try {
    const slackApp = req.app.get('slackApp');
    
    if (!slackApp) {
      throw new Error('Slack app not available');
    }

    const nudgeCount = await StreakService.sendDailyNudges(slackApp);
    
    res.json({
      success: true,
      nudgesSent: nudgeCount,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error sending nudges:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Test endpoint to simulate daily processing without sending actual DMs
 */
router.post('/test-daily', async (req, res) => {
  try {
    console.log('Running test daily streak processing...');
    
    // Process daily streaks (without DMs)
    const streakStats = await StreakService.processDailyStreaks();
    
    // Get at-risk users but don't send DMs
    const atRiskUsers = await StreakService.getAtRiskUsers();
    
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        ...streakStats,
        atRiskUsersCount: atRiskUsers.length,
        atRiskUsers: atRiskUsers.map(user => ({
          username: user.username,
          currentStreak: user.currentStreak,
          streakStatus: user.streakStatus
        }))
      },
      message: 'Test daily streak processing completed (no DMs sent)'
    };

    console.log('Test daily streak processing completed:', response.stats);
    res.json(response);
    
  } catch (error) {
    console.error('Error in test daily streak processing:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export { router as streaksRouter };