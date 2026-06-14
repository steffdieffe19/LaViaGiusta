import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { TrailsService } from './trails.service.js';
import { prisma } from '../../config/database.js';
import { ApiResponse, AuthenticatedRequest } from '../../shared/types/index.js';

// Input validations
const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().positive().default(5000), // Default 5km radius
});

const importGpxSchema = z.object({
  gpxContent: z.string().min(10, 'GPX content is required'),
  code: z.string().min(2).max(20),
  difficulty: z.enum(['T', 'E', 'EE', 'EEA']),
  surfaceType: z.string().optional(),
  watchdogTolerancePct: z.coerce.number().min(0).max(500).default(40),
});

export class TrailsController {
  /**
   * GET /trails
   * Lists all active trails
   */
  public static async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const trails = await TrailsService.listTrails();
      const response: ApiResponse<typeof trails> = {
        success: true,
        data: trails,
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /trails/:id
   * Get specific trail details with POIs, rating metrics, and reviews
   */
  public static async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const trail = await TrailsService.getTrailById(id);

      // Aggregate reviews
      const reviewAggregate = await prisma.trailReview.aggregate({
        where: { trailId: id },
        _avg: {
          rating: true
        },
        _count: {
          id: true
        }
      });

      const averageRating = reviewAggregate._avg.rating ? parseFloat(reviewAggregate._avg.rating.toFixed(1)) : 0;
      const reviewsCount = reviewAggregate._count.id;

      // Get reviews
      const reviews = await prisma.trailReview.findMany({
        where: { trailId: id },
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: {
          user: {
            select: {
              fullName: true
            }
          }
        }
      });

      const trailWithReviews = {
        ...trail,
        averageRating,
        reviewsCount,
        reviews: reviews.map(r => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt.toISOString(),
          user: {
            fullName: r.user.fullName
          }
        }))
      };

      const response: ApiResponse<typeof trailWithReviews> = {
        success: true,
        data: trailWithReviews,
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /trails/:id/geojson
   * Get dynamic GeoJSON linestring for client maps rendering
   */
  public static async geojson(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const geojson = await TrailsService.getTrailGeoJson(id);
      res.json(geojson); // Respond directly with GeoJSON specs
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /trails/nearby
   * Find nearby trails in radius using PostGIS geographic index
   */
  public static async nearby(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = nearbyQuerySchema.parse(req.query);
      const trails = await TrailsService.getNearbyTrails(parsed.lat, parsed.lng, parsed.radius);
      
      const response: ApiResponse<typeof trails> = {
        success: true,
        data: trails,
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /trails/import-gpx
   * Create trail from uploaded GPX file structure (Admin/Operator only)
   */
  public static async importGpx(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = importGpxSchema.parse(req.body);
      const trail = await TrailsService.createTrailFromGPX(
        parsed.gpxContent,
        parsed.code,
        parsed.difficulty,
        parsed.surfaceType,
        parsed.watchdogTolerancePct
      );

      const response: ApiResponse<typeof trail> = {
        success: true,
        data: trail,
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /trails/:id/reviews
   * Add or update a review for a specific trail (Authenticated users)
   */
  public static async createReview(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized: Missing user ID' });
        return;
      }

      const trailId = req.params.id as string;
      const { rating, comment } = req.body;

      // Validate input rating (1 to 5)
      const ratingInt = parseInt(rating, 10);
      if (isNaN(ratingInt) || ratingInt < 1 || ratingInt > 5) {
        res.status(400).json({ success: false, error: 'Valutazione non valida. Deve essere un valore tra 1 e 5.' });
        return;
      }

      if (!comment || !comment.trim()) {
        res.status(400).json({ success: false, error: 'Il commento descrittivo è obbligatorio.' });
        return;
      }

      // Check if trail exists
      const trail = await prisma.trail.findUnique({
        where: { id: trailId }
      });

      if (!trail) {
        res.status(404).json({ success: false, error: 'Sentiero non trovato.' });
        return;
      }

      // Perform upsert (one review per user per trail)
      const review = await prisma.trailReview.upsert({
        where: {
          userId_trailId: {
            userId,
            trailId
          }
        },
        update: {
          rating: ratingInt,
          comment: comment.trim(),
          createdAt: new Date()
        },
        create: {
          userId,
          trailId,
          rating: ratingInt,
          comment: comment.trim()
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
        data: review
      });
    } catch (err) {
      next(err);
    }
  }
}
