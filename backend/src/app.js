import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { getEnv } from './config/env.js';
import { httpLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { mediaRouter } from './routes/media.js';
import { downloadsRouter } from './routes/downloads.js';
import { eventsRouter } from './routes/events.js';


export function createApp() {
  const env = getEnv();
  const app = express();

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Vite development compatibility
      crossOriginEmbedderPolicy: false,
    })
  );

  // Local CORS
  app.use(
    cors({
      origin: [env.FRONTEND_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
    })
  );

  // Rate Limiting (100 requests per minute from local clients)
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again shortly.',
      },
    },
  });
  app.use('/api', limiter);

  // HTTP Request Logging
  app.use(httpLogger);

  // Request body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Routes
  app.use('/api', healthRouter);
  app.use('/api', mediaRouter);
  app.use('/api', downloadsRouter);
  // SSE routes are exempt from rate limiting (long-lived connections)
  app.use('/api', eventsRouter);


  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Endpoint ${req.method} ${req.originalUrl} not found`,
      },
    });
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}
