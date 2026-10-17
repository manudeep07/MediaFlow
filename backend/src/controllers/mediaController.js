import { z } from 'zod';
import { inspectMedia } from '../adapters/ytdlpAdapter.js';
import { logger } from '../middleware/logger.js';

const inspectRequestSchema = z.object({
  url: z.string().url('A valid URL is required'),
});

export async function inspectMediaHandler(req, res, next) {
  try {
    const parseResult = inspectRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0]?.message || 'Invalid request body',
        },
      });
    }

    const { url } = parseResult.data;

    // Use URL validated by SSRF middleware if present
    const targetUrl = req.validatedMedia?.url || url;

    logger.info({ targetUrl }, 'Processing media inspection request');
    const mediaInfo = await inspectMedia(targetUrl);

    return res.status(200).json({
      success: true,
      data: mediaInfo,
    });
  } catch (err) {
    logger.error({ err }, 'Media inspection handler error');
    return res.status(422).json({
      success: false,
      error: {
        code: 'MEDIA_INSPECTION_FAILED',
        message: err.message || 'Unable to inspect media source',
      },
    });
  }
}
