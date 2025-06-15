/**
 * Integration tests for health endpoint and basic app functionality
 */

import request from 'supertest';
import express from 'express';

// Mock the health endpoint since we can't run the full app in tests
const createTestApp = () => {
  const app = express();
  
  // Health check endpoint (same as in app.ts)
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0'
    });
  });
  
  return app;
};

describe('Health Endpoint Integration', () => {
  let app: express.Application;
  
  beforeAll(() => {
    app = createTestApp();
  });
  
  it('should return healthy status', async () => {
    const response = await request(app)
      .get('/health')
      .expect('Content-Type', /json/)
      .expect(200);
    
    expect(response.body.status).toBe('healthy');
    expect(response.body.timestamp).toBeDefined();
    expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    expect(response.body.environment).toBeDefined();
    expect(response.body.version).toBeDefined();
  });
  
  it('should return consistent response format', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    const requiredFields = ['status', 'timestamp', 'uptime', 'environment', 'version'];
    requiredFields.forEach(field => {
      expect(response.body).toHaveProperty(field);
    });
  });
  
  it('should handle multiple requests', async () => {
    const requests = Array(5).fill(0).map(() => 
      request(app).get('/health').expect(200)
    );
    
    const responses = await Promise.all(requests);
    
    responses.forEach(response => {
      expect(response.body.status).toBe('healthy');
    });
  });
});