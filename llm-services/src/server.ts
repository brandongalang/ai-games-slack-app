import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { clarityRouter } from './routes/clarity';
import { similarityRouter } from './routes/similarity';
import { digestRouter } from './routes/digest';
import { authMiddleware } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'ai-games-llm-services',
    version: '1.0.0'
  });
});

// Authentication middleware for protected routes
app.use('/api', authMiddleware);

// LLM service routes
app.use('/api/clarity', clarityRouter);
app.use('/api/similarity', similarityRouter);
app.use('/api/digest', digestRouter);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource was not found'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 LLM Services running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});