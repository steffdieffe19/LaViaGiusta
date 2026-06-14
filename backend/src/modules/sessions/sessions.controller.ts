import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { SessionsService } from './sessions.service.js';
import { ApiResponse, AuthenticatedRequest } from '../../shared/types/index.js';

// Input validations
const checkInSchema = z.object({
  trailId: z.string().uuid('Invalid trail ID'),
  groupId: z.string().uuid().optional(),
  watchdogTolerancePct: z.number().min(0).max(200).optional(),
  groupSize: z.number().min(1).optional(),
  groupNotes: z.string().optional(),
});

const locationUpdateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().optional(),
  accuracy: z.number().optional(),
  speed: z.number().optional(),
  heading: z.number().optional(),
  batteryLevel: z.number().min(0).max(100).optional(),
  timestamp: z.string().datetime(),
});

const respondAlertSchema = z.object({
  response: z.enum(['ok', 'help', 'extend']),
});

export class SessionsController {
  /**
   * POST /sessions/check-in
   * User check-in at the trailhead
   */
  public static async checkIn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      
      const parsed = checkInSchema.parse(req.body);
      const result = await SessionsService.checkIn(
        userId, 
        parsed.trailId, 
        parsed.groupId, 
        parsed.watchdogTolerancePct
      );

      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /sessions/active
   * Retrieve active session of current logged-in user
   */
  public static async getActive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;

      const session = await SessionsService.getActiveSession(userId);
      const response: ApiResponse<typeof session> = {
        success: true,
        data: session,
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /sessions/:id/start
   * Start hike session (begins active status)
   */
  public static async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const sessionId = req.params.id as string;

      const session = await SessionsService.startHike(sessionId, userId);
      const response: ApiResponse<typeof session> = {
        success: true,
        data: session,
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /sessions/:id/location
   * Upload user location and run geofencing checks
   */
  public static async location(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const sessionId = req.params.id as string;

      const parsed = locationUpdateSchema.parse(req.body);
      const result = await SessionsService.recordLocation(sessionId, userId, parsed);

      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /sessions/:id/respond-alert
   * User responses to watchdog timeouts
   */
  public static async respondAlert(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const sessionId = req.params.id as string;

      const parsed = respondAlertSchema.parse(req.body);
      const session = await SessionsService.respondToAlert(sessionId, userId, parsed.response);

      const response: ApiResponse<typeof session> = {
        success: true,
        data: session,
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /sessions/:id/sos
   * Trigger immediate manual SOS emergency trigger
   */
  public static async sos(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const sessionId = req.params.id as string;

      const session = await SessionsService.triggerSOS(sessionId, userId);
      const response: ApiResponse<typeof session> = {
        success: true,
        data: session,
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /sessions/:id/complete
   * Hike completion check-out
   */
  public static async complete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const sessionId = req.params.id as string;

      const summary = await SessionsService.completeHike(sessionId, userId);
      
      // Resolve trail name for cleaner output
      const trail = await prisma.trail.findUnique({
        where: { id: summary.session.trailId },
      });
      if (trail) {
        summary.trailName = trail.name;
      }

      const response: ApiResponse<typeof summary> = {
        success: true,
        data: summary,
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}
