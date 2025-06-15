import helmet from 'helmet';
import { SecurityService } from '../services/securityService';

// Security middleware for Express
export const securityMiddleware = [
  // Basic security headers
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Slack may need inline scripts
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // May interfere with Slack
  }),

  // General rate limiting
  SecurityService.createRateLimit(SecurityService.RATE_LIMITS.GENERAL),
];

// Submission-specific security middleware
export const submissionSecurityMiddleware = [
  SecurityService.createRateLimit(SecurityService.RATE_LIMITS.SUBMISSION),
  SecurityService.createSlowDown(SecurityService.SLOW_DOWN.SUBMISSION),
];

// Comment-specific security middleware
export const commentSecurityMiddleware = [
  SecurityService.createRateLimit(SecurityService.RATE_LIMITS.COMMENTS),
];

// Admin-only middleware
export const adminOnlyMiddleware = (req: any, res: any, next: any) => {
  const slackUserId = req.body?.user_id || req.headers['x-slack-user-id'];
  
  if (!slackUserId || !SecurityService.isAdmin(slackUserId)) {
    return res.status(403).json({ 
      error: 'Forbidden: Admin access required' 
    });
  }
  
  next();
};

// Request validation middleware
export const validateRequest = (req: any, res: any, next: any) => {
  // Basic request validation
  if (!req.body) {
    return res.status(400).json({ 
      error: 'Bad Request: Missing request body' 
    });
  }

  // Validate required Slack fields
  if (!req.body.user_id || !req.body.team_id) {
    return res.status(400).json({ 
      error: 'Bad Request: Missing required Slack fields' 
    });
  }

  next();
};