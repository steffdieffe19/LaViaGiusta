import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AuthenticatedRequest } from '../../shared/types/index.js';

export class CommunityController {
  /**
   * Create a new community post with an uploaded photo, tag a trail, and store metadata.
   */
  public static async createPost(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized: Missing user ID' });
        return;
      }

      const { caption, trailId } = req.body;
      const file = req.file;

      if (!caption || !trailId) {
        res.status(400).json({ success: false, error: 'Didascalia e Sentiero taggato sono obbligatori' });
        return;
      }

      if (!file) {
        res.status(400).json({ success: false, error: 'Immagine del post obbligatoria' });
        return;
      }

      // Check if the referenced trail actually exists
      const trail = await prisma.trail.findUnique({
        where: { id: trailId as string }
      });

      if (!trail) {
        res.status(404).json({ success: false, error: 'Sentiero taggato non trovato' });
        return;
      }

      // Store only the relative path to be served statically
      const imagePath = `/uploads/community/${file.filename}`;

      // Insert post inside database
      const post = await prisma.communityPost.create({
        data: {
          userId,
          trailId: trailId as string,
          imagePath,
          caption,
        },
        include: {
          user: {
            select: {
              fullName: true,
            }
          },
          trail: {
            select: {
              name: true,
              code: true,
            }
          }
        }
      });

      res.status(201).json({
        success: true,
        data: {
          id: post.id,
          userId: post.userId,
          trailId: post.trailId,
          imagePath: post.imagePath,
          caption: post.caption,
          createdAt: post.createdAt,
          user: post.user,
          trail: post.trail,
          likesCount: 0,
          commentsCount: 0,
          hasLiked: false
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves all community posts ordered by newest first, calculating likes and comments.
   */
  public static async getPosts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Optional authentication check: if user sends a valid token, we compute hasLiked
      let userId: string | undefined = undefined;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.split(' ')[1]?.trim();
          const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string };
          userId = decoded.id;
        } catch (e) {
          // Ignore invalid token, treat as public/anonymous request
        }
      }

      const posts = await prisma.communityPost.findMany({
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          user: {
            select: {
              fullName: true,
            }
          },
          trail: {
            select: {
              name: true,
              code: true,
            }
          },
          _count: {
            select: {
              likes: true,
              comments: true
            }
          },
          likes: userId ? {
            where: {
              userId
            },
            select: {
              userId: true
            }
          } : undefined
        }
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
        hasLiked: userId ? (post.likes && post.likes.length > 0) : false
      }));

      res.json({
        success: true,
        data: mappedPosts
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Toggles the like status on a post for the authenticated user.
   */
  public static async toggleLike(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized: Missing user ID' });
        return;
      }

      const postId = req.params.id as string;

      // Verify the post exists
      const post = await prisma.communityPost.findUnique({
        where: { id: postId }
      });

      if (!post) {
        res.status(404).json({ success: false, error: 'Post non trovato' });
        return;
      }

      // Check if like already exists
      const existingLike = await prisma.postLike.findUnique({
        where: {
          userId_postId: {
            userId,
            postId
          }
        }
      });

      let liked = false;
      if (existingLike) {
        await prisma.postLike.delete({
          where: {
            id: existingLike.id
          }
        });
        liked = false;
      } else {
        await prisma.postLike.create({
          data: {
            userId,
            postId
          }
        });
        liked = true;
      }

      // Retrieve updated total likes count
      const postWithLikes = await prisma.communityPost.findUnique({
        where: { id: postId },
        select: {
          _count: {
            select: {
              likes: true
            }
          }
        }
      });

      res.json({
        success: true,
        data: {
          liked,
          likesCount: postWithLikes?._count.likes ?? 0
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves comments for a specific post.
   */
  public static async getComments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const postId = req.params.id as string;

      // Verify post exists
      const post = await prisma.communityPost.findUnique({
        where: { id: postId }
      });

      if (!post) {
        res.status(404).json({ success: false, error: 'Post non trovato' });
        return;
      }

      const comments = await prisma.postComment.findMany({
        where: { postId },
        orderBy: {
          createdAt: 'asc'
        },
        include: {
          user: {
            select: {
              fullName: true
            }
          }
        }
      });

      res.json({
        success: true,
        data: comments
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Add a new comment to a community post.
   */
  public static async createComment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized: Missing user ID' });
        return;
      }

      const postId = req.params.id as string;
      const { content } = req.body;

      if (!content || !content.trim()) {
        res.status(400).json({ success: false, error: 'Il contenuto del commento è obbligatorio' });
        return;
      }

      // Verify post exists
      const post = await prisma.communityPost.findUnique({
        where: { id: postId }
      });

      if (!post) {
        res.status(404).json({ success: false, error: 'Post non trovato' });
        return;
      }

      const comment = await prisma.postComment.create({
        data: {
          userId,
          postId,
          content: content.trim()
        },
        include: {
          user: {
            select: {
              fullName: true
            }
          }
        }
      });

      res.status(201).json({
        success: true,
        data: comment
      });
    } catch (err) {
      next(err);
    }
  }
}
