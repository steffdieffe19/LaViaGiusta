import { Router } from 'express';
import { TrailsController } from './trails.controller.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';

const router = Router();

// Public routes
router.get('/', TrailsController.list);
router.get('/nearby', TrailsController.nearby);
router.get('/:id', TrailsController.get);
router.get('/:id/geojson', TrailsController.geojson);

// Protected routes (import GPX & reviews)
router.post('/import-gpx', requireAuth, TrailsController.importGpx);
router.post('/:id/reviews', requireAuth, TrailsController.createReview);

export default router;
