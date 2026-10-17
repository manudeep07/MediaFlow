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
} from '../controllers/downloadsController.js';

export const downloadsRouter = Router();

downloadsRouter.post('/downloads', ssrfMiddleware, createDownloadHandler);
downloadsRouter.get('/downloads', listDownloadsHandler);
downloadsRouter.get('/downloads/:id', getDownloadStatusHandler);
downloadsRouter.get('/downloads/:id/file', downloadFileHandler);
downloadsRouter.get('/downloads/:id/items', getPlaylistItemsHandler);
downloadsRouter.get('/downloads/:id/archive', downloadArchiveHandler);
downloadsRouter.delete('/downloads/:id', deleteDownloadHandler);
