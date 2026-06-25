import { Router } from 'express';
import { SessionsController } from './sessions.controller.js';
import { requireAuth, requireRole } from '../../shared/middleware/auth.middleware.js';

const router = Router();

// Protect all routes with requireAuth
router.use(requireAuth);

// Explicitly accept users with tourist role for hiker session actions
router.post('/check-in', requireRole('tourist'), SessionsController.checkIn);
router.get('/active', requireRole('tourist'), SessionsController.getActive);
router.post('/:id/start', requireRole('tourist'), SessionsController.start);
router.post('/:id/location', requireRole('tourist'), SessionsController.location);
router.post('/:id/respond-alert', requireRole('tourist'), SessionsController.respondAlert);
router.post('/:id/sos', requireRole('tourist'), SessionsController.sos);
router.post('/:id/complete', requireRole('tourist'), SessionsController.complete);

export default router;
