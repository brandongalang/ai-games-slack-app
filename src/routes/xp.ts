import { Router } from 'express';
import { XPService } from '../services/xpService';

const router = Router();

/**
 * Get user's comprehensive XP breakdown
 */
router.get('/user/:userId/breakdown', async (req: any, res: any) => {
  try {
    const userId = parseInt(req.params.userId);
    const days = parseInt(req.query.days || '30');
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }

    const breakdown = await XPService.getUserXPBreakdown(userId, days);
    
    res.json({
      success: true,
      data: breakdown
    });
    
  } catch (error) {
    console.error('Error fetching user XP breakdown:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Apply seasonal decay (admin endpoint)
 */
router.post('/decay/:seasonId', async (req: any, res: any) => {
  try {
    const seasonId = parseInt(req.params.seasonId);
    const decayFactor = parseFloat(req.body.decayFactor || '0.1');
    
    if (isNaN(seasonId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid season ID'
      });
    }

    if (decayFactor < 0 || decayFactor > 1) {
      return res.status(400).json({
        success: false,
        error: 'Decay factor must be between 0 and 1'
      });
    }

    const usersUpdated = await XPService.applySeasonalDecay(seasonId, decayFactor);
    
    res.json({
      success: true,
      data: {
        seasonId,
        decayFactor,
        usersUpdated,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error applying seasonal decay:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Award manual XP (admin endpoint)
 */
router.post('/award', async (req: any, res: any) => {
  try {
    const { userId, eventType, xpValue, submissionId, metadata } = req.body;
    
    if (!userId || !eventType) {
      return res.status(400).json({
        success: false,
        error: 'userId and eventType are required'
      });
    }

    const result = await XPService.awardXP({
      userId: parseInt(userId),
      eventType,
      xpValue: xpValue ? parseInt(xpValue) : undefined,
      submissionId: submissionId ? parseInt(submissionId) : undefined,
      metadata: metadata || {}
    });
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Error awarding manual XP:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get XP statistics across all users
 */
router.get('/stats', async (req: any, res: any) => {
  try {
    const days = parseInt(req.query.days || '30');
    
    // This would require aggregating across all users
    // For now, return a simple response
    res.json({
      success: true,
      data: {
        message: 'XP statistics endpoint - implementation pending',
        days
      }
    });
    
  } catch (error) {
    console.error('Error fetching XP statistics:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Test XP calculation without awarding
 */
router.post('/test-calculation', async (req: any, res: any) => {
  try {
    const { userId, eventType, qualityMetrics } = req.body;
    
    if (!userId || !eventType) {
      return res.status(400).json({
        success: false,
        error: 'userId and eventType are required'
      });
    }

    // This would simulate XP calculation without actually awarding
    // For now, return the base values
    res.json({
      success: true,
      data: {
        message: 'XP calculation test - implementation pending',
        userId,
        eventType,
        qualityMetrics
      }
    });
    
  } catch (error) {
    console.error('Error testing XP calculation:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as xpRouter };