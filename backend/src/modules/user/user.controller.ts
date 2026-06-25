import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { AuthenticatedRequest } from '../../shared/types/index.js';

const updateProfileSchema = z.object({
  fullName: z.string().min(2, 'Il nome deve essere lungo almeno 2 caratteri'),
  phone: z.string().nullable().optional(),
  bio: z.string().max(500, 'La biografia non può superare i 500 caratteri').nullable().optional(),
  location: z.string().max(150, 'La località non può superare i 150 caratteri').nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
});

export class UserController {
  /**
   * GET /user/profile
   * Retrieves profile details, hiking stats, and user community posts.
   */
  public static async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Non autorizzato: ID utente mancante' });
        return;
      }

      // 1. Fetch User Info
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          bio: true,
          location: true,
          avatarUrl: true,
          fitnessLevel: true,
          locale: true,
          createdAt: true,
        },
      });

      if (!user) {
        res.status(404).json({ success: false, error: 'Utente non trovato' });
        return;
      }

      // 2. Fetch completed Hike Sessions for statistics
      const completedSessions = await prisma.hikingSession.findMany({
        where: {
          userId,
          status: 'completed',
        },
        include: {
          trail: {
            select: {
              distanceMeters: true,
              elevationGain: true,
            },
          },
        },
      });

      const totalHikes = completedSessions.length;
      let totalDistanceMeters = 0;
      let totalElevationGain = 0;

      for (const session of completedSessions) {
        totalDistanceMeters += session.actualDistanceMeters ?? session.trail.distanceMeters ?? 0;
        totalElevationGain += session.trail.elevationGain ?? 0;
      }

      const totalDistanceKm = parseFloat((totalDistanceMeters / 1000).toFixed(1));

      // 3. Fetch User's Community Posts
      const posts = await prisma.communityPost.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              fullName: true,
            },
          },
          trail: {
            select: {
              name: true,
              code: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
          likes: {
            where: { userId },
            select: { userId: true },
          },
        },
      });

      const mappedPosts = posts.map(post => ({
        id: post.id,
        userId: post.userId,
        trailId: post.trailId,
        imagePath: post.imagePath,
        caption: post.caption,
        createdAt: post.createdAt,
        user: post.user,
        trail: post.trail,
        likesCount: post._count.likes,
        commentsCount: post._count.comments,
        hasLiked: post.likes && post.likes.length > 0,
      }));

      res.json({
        success: true,
        data: {
          user,
          stats: {
            totalHikes,
            totalDistanceKm,
            totalElevationGain,
          },
          posts: mappedPosts,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /user/profile
   * Exclusively updates profile fields: fullName, phone, bio, location, and avatarUrl.
   */
  public static async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Non autorizzato: ID utente mancante' });
        return;
      }

      // Query current user to preserve existing avatarUrl if no new one is uploaded
      const userRecord = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!userRecord) {
        res.status(404).json({ success: false, error: 'Utente non trovato' });
        return;
      }

      // Preprocess fields to handle form-data strings ("null", empty string)
      const cleanBody = {
        fullName: req.body.fullName,
        phone: req.body.phone === 'null' || req.body.phone === '' ? null : req.body.phone,
        bio: req.body.bio === 'null' || req.body.bio === '' ? null : req.body.bio,
        location: req.body.location === 'null' || req.body.location === '' ? null : req.body.location,
        avatarUrl: req.body.avatarUrl === 'null' || req.body.avatarUrl === '' ? null : req.body.avatarUrl,
      };

      const parsed = updateProfileSchema.parse(cleanBody);

      // Determine avatar URL: new upload, explicit deletion or keep current
      let avatarUrl = userRecord.avatarUrl;
      if (req.file) {
        avatarUrl = `/uploads/avatars/${req.file.filename}`;
      } else if (cleanBody.avatarUrl === null) {
        avatarUrl = null;
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          fullName: parsed.fullName,
          phone: parsed.phone ?? null,
          bio: parsed.bio ?? null,
          location: parsed.location ?? null,
          avatarUrl,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          bio: true,
          location: true,
          avatarUrl: true,
          fitnessLevel: true,
          locale: true,
        },
      });

      res.json({
        success: true,
        data: updatedUser,
      });
    } catch (err) {
      next(err);
    }
  }
}
