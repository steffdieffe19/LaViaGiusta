import { Router } from 'express';
import { SessionsController } from './sessions.controller.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';

const router = Router();

// Protect all routes
router.use(requireAuth);

router.post('/check-in', SessionsController.checkIn);
router.get('/active', SessionsController.getActive);
router.post('/:id/start', SessionsController.start);
router.post('/:id/location', SessionsController.location);
router.post('/:id/respond-alert', SessionsController.respondAlert);
router.post('/:id/sos', SessionsController.sos);
router.post('/:id/complete', SessionsController.complete);

export default router;
