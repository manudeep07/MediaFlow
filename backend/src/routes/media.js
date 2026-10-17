import { Router } from 'express';
import { ssrfMiddleware } from '../middleware/ssrf.js';
import { inspectMediaHandler } from '../controllers/mediaController.js';

export const mediaRouter = Router();

mediaRouter.post('/media/inspect', ssrfMiddleware, inspectMediaHandler);
