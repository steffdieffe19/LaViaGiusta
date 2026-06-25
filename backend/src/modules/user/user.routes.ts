import { Router } from 'express';
import { UserController } from './user.controller.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';
import { uploadAvatar } from '../../shared/middleware/upload.middleware.js';

const router = Router();

router.get('/profile', requireAuth, UserController.getProfile);
router.put('/profile', requireAuth, uploadAvatar.single('avatar'), UserController.updateProfile);

export default router;
