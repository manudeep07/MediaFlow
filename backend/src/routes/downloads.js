import { Router } from 'express';
import { ssrfMiddleware } from '../middleware/ssrf.js';
import {
  createDownloadHandler,
  listDownloadsHandler,
  getDownloadStatusHandler,
  downloadFileHandler,
  deleteDownloadHandler,
  getPlaylistItemsHandler,
  downloadArchiveHandler,
  cancelDownloadHandler,
  retryDownloadHandler,
} from '../controllers/downloadsController.js';

export const downloadsRouter = Router();

downloadsRouter.post('/downloads', ssrfMiddleware, createDownloadHandler);
downloadsRouter.get('/downloads', listDownloadsHandler);
downloadsRouter.get('/downloads/:id', getDownloadStatusHandler);
downloadsRouter.get('/downloads/:id/file', downloadFileHandler);
downloadsRouter.get('/downloads/:id/items', getPlaylistItemsHandler);
downloadsRouter.get('/downloads/:id/archive', downloadArchiveHandler);
downloadsRouter.post('/downloads/:id/cancel', cancelDownloadHandler);
downloadsRouter.post('/downloads/:id/retry', retryDownloadHandler);
downloadsRouter.delete('/downloads/:id', deleteDownloadHandler);

