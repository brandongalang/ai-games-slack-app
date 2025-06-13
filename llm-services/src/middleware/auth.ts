import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  apiKey?: string;
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'] as string;

  // Check for API key in header
  if (!authHeader && !apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required. Provide via Authorization header or x-api-key header.'
    });
  }

  // Extract API key from Authorization header if present
  let providedKey = apiKey;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    providedKey = authHeader.substring(7);
  }

  // Validate API key
  const validApiKey = process.env.LLM_SERVICE_API_KEY;
  if (!validApiKey) {
    console.error('LLM_SERVICE_API_KEY not configured');
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'Authentication not properly configured'
    });
  }

  if (providedKey !== validApiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key'
    });
  }

  req.apiKey = providedKey;
  next();
};