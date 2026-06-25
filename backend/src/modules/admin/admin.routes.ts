import { Router, Response, NextFunction } from 'express';
import { SessionsService } from '../sessions/sessions.service.js';
import { eventBus, EVENTS } from '../../shared/utils/event-bus.js';
import { requireAuth, requireRole } from '../../shared/middleware/auth.middleware.js';
import { AuthenticatedRequest } from '../../shared/types/index.js';

const router = Router();

/**
 * GET /api/v1/admin/hikes/active
 * Retrieve all active hiker sessions for the municipality dashboard
 */
router.get('/hikes/active', requireAuth, requireRole('operator'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const active = await SessionsService.getAllActiveSessions();
    res.json({
      success: true,
      data: active
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/admin/hikes/stream
 * Real-time Server-Sent Events stream for hiker session updates
 */
router.get('/hikes/stream', requireAuth, requireRole('operator'), (req: AuthenticatedRequest, res: Response): void => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  res.write(': sse connection established\n\n');

  const onHikeUpdate = (payload: any) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  eventBus.on(EVENTS.HIKE_UPDATE, onHikeUpdate);

  const heartbeat = setInterval(() => {
    res.write(': keep-alive heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventBus.off(EVENTS.HIKE_UPDATE, onHikeUpdate);
    console.log('🔌 SSE connection closed by admin client.');
  });
});

/**
 * POST /api/v1/admin/hikes/:id/resolve
 * Resolve a hiker session from emergency (take-charge)
 */
router.post('/hikes/:id/resolve', requireAuth, requireRole('operator'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const notes = req.body.notes as string | undefined;
    const operatorId = req.user?.id;

    if (!operatorId) {
      res.status(401).json({ success: false, error: 'Unauthorized: missing user ID' });
      return;
    }

    const updated = await SessionsService.resolveSession(id, operatorId, notes);
    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/admin/hikes/:id/take-charge
 * Take charge of a hiker session alert (operator takes responsibility)
 */
router.post('/hikes/:id/take-charge', requireAuth, requireRole('operator'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const operatorId = req.user?.id;

    if (!operatorId) {
      res.status(401).json({ success: false, error: 'Unauthorized: missing user ID' });
      return;
    }

    const updated = await SessionsService.takeChargeSession(id, operatorId);
    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    next(error);
  }
});

export default router;
