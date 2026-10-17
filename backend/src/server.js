import { createApp } from './app.js';
import { getEnv } from './config/env.js';
import { initDatabase, closeDatabase } from './database/index.js';
import { recoverInterruptedJobs } from './services/jobManager.js';
import { logger } from './middleware/logger.js';

const env = getEnv();

// Initialize SQLite database and recover interrupted jobs
try {
  initDatabase();
  logger.info({ dbPath: env.DB_PATH }, 'SQLite database connected and initialized');
  recoverInterruptedJobs();
} catch (err) {
  logger.fatal({ err }, 'Failed to initialize SQLite database');
  process.exit(1);
}

const app = createApp();

const server = app.listen(env.PORT, env.HOST, () => {
  logger.info(
    `MediaFlow backend server running at http://${env.HOST}:${env.PORT}`
  );
});

function gracefulShutdown(signal) {
  logger.info(`Received ${signal}, closing server gracefully...`);
  server.close(() => {
    closeDatabase();
    logger.info('Closed HTTP server and SQLite database connection.');
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
