import { Router } from 'express';
import { CommunityController } from './community.controller.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';
import { uploadCommunityImage } from '../../shared/middleware/upload.middleware.js';

const router = Router();

// Public routes
router.get('/posts', CommunityController.getPosts);
router.get('/posts/:id/comments', CommunityController.getComments);

// Protected routes
router.post('/posts', requireAuth, uploadCommunityImage.single('image'), CommunityController.createPost);
router.post('/posts/:id/like', requireAuth, CommunityController.toggleLike);
router.post('/posts/:id/comments', requireAuth, CommunityController.createComment);

export default router;
