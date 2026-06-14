import { prisma } from '../../config/database.js';
import { WatchdogService } from './watchdog.service.js';
import { ValidationError, NotFoundError, UnauthorizedError } from '../../shared/middleware/error-handler.js';
import { 
  HikingSession, 
  CheckInResponse, 
  Coordinate, 
  LocationUpdate,
  SessionSummary 
} from '../../../../shared/types/index.js';
import { SessionStatus } from '../../config/constants.js';
import { eventBus, EVENTS } from '../../shared/utils/event-bus.js';

interface DbSession {
  id: string;
  user_id: string;
  trail_id: string;
  status: string;
  check_in_at: Date;
  started_at: Date | null;
  expected_end_at: Date | null;
  watchdog_triggered_at: Date | null;
  user_responded_at: Date | null;
  emergency_triggered_at: Date | null;
  completed_at: Date | null;
  group_id: string | null;
  is_group_leader: boolean;
  is_offline: boolean;
  offline_since: Date | null;
  actual_duration_minutes: number | null;
  actual_distance_meters: number | null;
  avg_speed_kmh: number | null;
  last_lat: number | null;
  last_lng: number | null;
}

export class SessionsService {
  /**
   * Maps raw database session to clean HikingSession shape
   */
  private static mapDbSession(db: DbSession): HikingSession {
    return {
      id: db.id,
      userId: db.user_id,
      trailId: db.trail_id,
      status: db.status as any,
      checkInAt: db.check_in_at.toISOString(),
      startedAt: db.started_at?.toISOString(),
      expectedEndAt: db.expected_end_at?.toISOString(),
      watchdogTriggeredAt: db.watchdog_triggered_at?.toISOString(),
      userRespondedAt: db.user_responded_at?.toISOString(),
      emergencyTriggeredAt: db.emergency_triggered_at?.toISOString(),
      completedAt: db.completed_at?.toISOString(),
      groupId: db.group_id || undefined,
      isGroupLeader: db.is_group_leader,
      isOffline: db.is_offline,
      actualDurationMinutes: db.actual_duration_minutes || undefined,
      actualDistanceMeters: db.actual_distance_meters || undefined,
      avgSpeedKmh: db.avg_speed_kmh || undefined,
      lastLocation: db.last_lat && db.last_lng ? {
        latitude: db.last_lat,
        longitude: db.last_lng,
      } : undefined,
    };
  }

  /**
   * Helper to retrieve session with coordinates from PostGIS
   */
  private static async getSessionWithCoords(sessionId: string): Promise<DbSession> {
    const rawSessions = await prisma.$queryRaw<DbSession[]>`
      SELECT 
        id, user_id, trail_id, status::text, check_in_at, started_at, expected_end_at, 
        watchdog_triggered_at, user_responded_at, emergency_triggered_at, completed_at, 
        group_id, is_group_leader, last_location_at, last_battery_level, is_offline, 
        offline_since, actual_duration_minutes, actual_distance_meters, avg_speed_kmh, 
        created_at, updated_at,
        ST_Y(last_known_location) as last_lat,
        ST_X(last_known_location) as last_lng
      FROM hiking_sessions
      WHERE id = ${sessionId}::uuid LIMIT 1
    `;
    const s = rawSessions[0];
    if (!s) throw new NotFoundError('Session');
    return s;
  }

  /**
   * Checks if user has any active hiking session
   */
  public static async getActiveSession(userId: string): Promise<HikingSession | null> {
    const rawSessions = await prisma.$queryRaw<DbSession[]>`
      SELECT 
        id, user_id, trail_id, status::text, check_in_at, started_at, expected_end_at, 
        watchdog_triggered_at, user_responded_at, emergency_triggered_at, completed_at, 
        group_id, is_group_leader, last_location_at, last_battery_level, is_offline, 
        offline_since, actual_duration_minutes, actual_distance_meters, avg_speed_kmh, 
        created_at, updated_at,
        ST_Y(last_known_location) as last_lat,
        ST_X(last_known_location) as last_lng
      FROM hiking_sessions
      WHERE user_id = ${userId}::uuid 
        AND status IN ('checked_in', 'active', 'watchdog_alert', 'emergency')
      LIMIT 1
    `;

    const dbSession = rawSessions[0];
    return dbSession ? this.mapDbSession(dbSession) : null;
  }

  /**
   * Initiates check-in at the trailhead and schedules the watchdog alert job
   */
  public static async checkIn(
    userId: string, 
    trailId: string, 
    groupId?: string, 
    customTolerancePct?: number
  ): Promise<CheckInResponse> {
    // 1. Assert no active session exists
    const active = await this.getActiveSession(userId);
    if (active) {
      throw new ValidationError('You already have an active hiking session. Close or cancel it first.');
    }

    // 2. Fetch trail details
    const trail = await prisma.trail.findUnique({
      where: { id: trailId, isActive: true },
    });
    if (!trail) {
      throw new NotFoundError('Trail');
    }

    // 3. Compute expected end time (Avg Duration * (1 + Tolerance%))
    const now = new Date();
    const tolerancePct = customTolerancePct !== undefined ? customTolerancePct : trail.watchdogTolerancePct;
    const durationMinutes = trail.avgDurationMinutes;
    const totalMinutesAllowed = Math.round(durationMinutes * (1 + tolerancePct / 100));
    const expectedEndAt = new Date(now.getTime() + totalMinutesAllowed * 60 * 1000);

    // 4. Create hiking session
    const session = await prisma.hikingSession.create({
      data: {
        userId,
        trailId,
        status: 'checked_in',
        expectedEndAt,
        groupId: groupId || null,
        isGroupLeader: !groupId, // Leader by default if solo
      },
    });

    // 5. Schedule BullMQ watchdog alert job
    const delayMs = expectedEndAt.getTime() - now.getTime();
    await WatchdogService.scheduleWatchdogAlert(session.id, delayMs);

    // Emit real-time update
    setTimeout(() => {
      SessionsService.emitSessionUpdate(session.id);
    }, 100);

    return {
      sessionId: session.id,
      expectedEndAt: expectedEndAt.toISOString(),
      trailName: trail.name,
      estimatedDurationMinutes: durationMinutes,
    };
  }

  /**
   * Starts the hike and begins GPS tracking
   */
  public static async startHike(sessionId: string, userId: string): Promise<HikingSession> {
    const dbSession = await this.getSessionWithCoords(sessionId);
    if (dbSession.user_id !== userId) {
      throw new UnauthorizedError('Unauthorized session access');
    }

    if (dbSession.status !== 'checked_in') {
      throw new ValidationError(`Cannot start hike from status ${dbSession.status}`);
    }

    const updated = await prisma.hikingSession.update({
      where: { id: sessionId },
      data: {
        status: 'active',
        startedAt: new Date(),
      },
    });

    const refreshed = await this.getSessionWithCoords(sessionId);
    SessionsService.emitSessionUpdate(sessionId);
    return this.mapDbSession(refreshed);
  }

  /**
   * Records a location update, runs geofencing logic, and logs coords to PostGIS
   */
  public static async recordLocation(
    sessionId: string, 
    userId: string, 
    update: LocationUpdate
  ): Promise<{ isOutOfBounds: boolean; distanceToPathMeters: number }> {
    const dbSession = await this.getSessionWithCoords(sessionId);
    
    if (dbSession.user_id !== userId) {
      throw new UnauthorizedError('Unauthorized session access');
    }

    if (!['active', 'watchdog_alert', 'emergency'].includes(dbSession.status)) {
      throw new ValidationError(`Cannot record location for inactive session status: ${dbSession.status}`);
    }

    // 1. Log position in location_logs
    const log = await prisma.locationLog.create({
      data: {
        sessionId,
        altitude: update.altitude,
        accuracy: update.accuracy,
        speed: update.speed,
        heading: update.heading,
        batteryLevel: update.batteryLevel,
        isOffline: false,
        recordedAt: new Date(update.timestamp),
      },
    });

    // Update location coordinate geometry via raw SQL
    await prisma.$executeRaw`
      UPDATE location_logs SET
        location = ST_SetSRID(ST_MakePoint(${update.longitude}, ${update.latitude}), 4326)
      WHERE id = ${log.id}::uuid
    `;

    // 2. Update session last known location
    await prisma.hikingSession.update({
      where: { id: sessionId },
      data: {
        lastLocationAt: new Date(update.timestamp),
        lastBatteryLevel: update.batteryLevel || null,
        isOffline: false,
        offlineSince: null,
      },
    });

    await prisma.$executeRaw`
      UPDATE hiking_sessions SET
        last_known_location = ST_SetSRID(ST_MakePoint(${update.longitude}, ${update.latitude}), 4326)
      WHERE id = ${sessionId}::uuid
    `;

    // 3. Geofencing check: Compute distance from GPS point to the trail LineString (route_geom)
    const geofenceResult = await prisma.$queryRaw<Array<{ distance_meters: number; buffer: number }>>`
      SELECT 
        ST_Distance(
          ST_SetSRID(ST_MakePoint(${update.longitude}, ${update.latitude}), 4326)::geography, 
          t.route_geom::geography
        ) as distance_meters,
        t.geofence_buffer as buffer
      FROM hiking_sessions hs
      JOIN trails t ON hs.trail_id = t.id
      WHERE hs.id = ${sessionId}::uuid LIMIT 1
    `;

    const distance = geofenceResult[0]?.distance_meters || 0;
    const buffer = geofenceResult[0]?.buffer || 200;
    const isOutOfBounds = distance > buffer;

    if (isOutOfBounds) {
      console.warn(`⚠️  User ${userId} in session ${sessionId} is OUT OF BOUNDS! Distance to trail: ${distance.toFixed(1)}m (limit: ${buffer}m)`);
      // Future phase: send local alarm/push notifying they are off path
    }

    // Emit real-time location update
    SessionsService.emitSessionUpdate(sessionId);

    return {
      isOutOfBounds,
      distanceToPathMeters: Math.round(distance),
    };
  }

  /**
   * Responds to a watchdog alert ("Sto bene" -> extends timer, "Aiuto" -> triggers emergency)
   */
  public static async respondToAlert(sessionId: string, userId: string, response: 'ok' | 'help' | 'extend'): Promise<HikingSession> {
    const dbSession = await this.getSessionWithCoords(sessionId);
    if (dbSession.user_id !== userId) {
      throw new UnauthorizedError('Unauthorized session access');
    }

    if (dbSession.status !== 'watchdog_alert') {
      throw new ValidationError(`Cannot respond to alert when session status is ${dbSession.status}`);
    }

    // Cancel the pending emergency job since the user responded
    await WatchdogService.cancelPendingJobs(sessionId);

    const now = new Date();

    if (response === 'help') {
      // Immediately trigger emergency rescue workflow
      await WatchdogService.handleEmergencyTimeout(sessionId);
    } else {
      // "ok" or "extend" -> Reschedule alert. Extend by +30 minutes or customized tolerance
      const minutesToExtend = response === 'extend' ? 60 : 30;
      const newExpectedEnd = new Date(now.getTime() + minutesToExtend * 60 * 1000);

      await prisma.hikingSession.update({
        where: { id: sessionId },
        data: {
          status: 'active',
          expectedEndAt: newExpectedEnd,
          userRespondedAt: now,
        },
      });

      // Schedule new alert timeout job
      await WatchdogService.scheduleWatchdogAlert(sessionId, minutesToExtend * 60 * 1000);
      console.log(`✅ User responded 'OK'. Watchdog alert extended by ${minutesToExtend} mins.`);
    }

    const refreshed = await this.getSessionWithCoords(sessionId);
    SessionsService.emitSessionUpdate(sessionId);
    return this.mapDbSession(refreshed);
  }

  /**
   * Triggers manual SOS emergency event immediately
   */
  public static async triggerSOS(sessionId: string, userId: string): Promise<HikingSession> {
    const dbSession = await this.getSessionWithCoords(sessionId);
    if (dbSession.user_id !== userId) {
      throw new UnauthorizedError('Unauthorized session access');
    }

    // Cancel pending watchdog timers
    await WatchdogService.cancelPendingJobs(sessionId);

    // Set to watchdog_alert momentarily to allow emergency handler execution
    await prisma.hikingSession.update({
      where: { id: sessionId },
      data: {
        status: 'watchdog_alert',
      },
    });

    // Run emergency trigger immediately
    await WatchdogService.handleEmergencyTimeout(sessionId);

    const refreshed = await this.getSessionWithCoords(sessionId);
    SessionsService.emitSessionUpdate(sessionId);
    return this.mapDbSession(refreshed);
  }

  /**
   * Completes the hike (check-out) and cancels background timers
   */
  public static async completeHike(sessionId: string, userId: string): Promise<SessionSummary> {
    const dbSession = await this.getSessionWithCoords(sessionId);
    if (dbSession.user_id !== userId) {
      throw new UnauthorizedError('Unauthorized session access');
    }

    if (!['active', 'watchdog_alert', 'emergency'].includes(dbSession.status)) {
      throw new ValidationError(`Cannot complete hike from status: ${dbSession.status}`);
    }

    // 1. Cancel background watchdog jobs
    await WatchdogService.cancelPendingJobs(sessionId);

    const now = new Date();
    const startedAt = dbSession.started_at || dbSession.check_in_at;
    const durationMinutes = Math.max(1, Math.round((now.getTime() - startedAt.getTime()) / 60000));

    // 2. Fetch GPS logs to calculate actual distance
    // PostGIS query to get cumulative distance along coordinates
    const pathResult = await prisma.$queryRaw<Array<{ length_meters: number }>>`
      SELECT ST_Length(ST_MakeLine(location)::geography) as length_meters
      FROM (
        SELECT location 
        FROM location_logs 
        WHERE session_id = ${sessionId}::uuid AND location IS NOT NULL
        ORDER BY recorded_at ASC
      ) points
    `;
    const actualDistanceMeters = Math.round(pathResult[0]?.length_meters || 0);
    const distanceKm = actualDistanceMeters / 1000;
    const avgSpeedKmh = durationMinutes > 0 ? (distanceKm / (durationMinutes / 60)) : 0;

    // 3. Update database record
    await prisma.hikingSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        completedAt: now,
        actualDurationMinutes: durationMinutes,
        actualDistanceMeters,
        avgSpeedKmh,
      },
    });

    // 4. Digital Passport (Fase 2 stamps / badges placeholders)
    // We can reward stamp for the trail completed
    let stampEarned = false;
    try {
      await prisma.trailStamp.create({
        data: {
          userId,
          trailId: dbSession.trail_id,
          sessionId,
          stampImageUrl: `/stamps/stamp_${dbSession.trail_id}.png`,
        },
      });
      stampEarned = true;
      console.log(`🎫 Digital Stamp awarded for trail: ${dbSession.trail_id}`);
    } catch (e) {
      console.log(`🎫 Stamp already earned previously for trail: ${dbSession.trail_id}`);
    }

    const refreshed = await this.getSessionWithCoords(sessionId);
    SessionsService.emitSessionUpdate(sessionId);

    return {
      session: this.mapDbSession(refreshed),
      trailName: dbSession.trail_id, // Placeholder (resolved in routes)
      durationMinutes,
      distanceKm: parseFloat(distanceKm.toFixed(2)),
      elevationGain: 0, // Placeholder
      avgSpeedKmh: parseFloat(avgSpeedKmh.toFixed(1)),
      badgesEarned: [], // Placeholder
      stampEarned,
    };
  }

  /**
   * Retrieves all active sessions across all users (for admin dashboard)
   */
  public static async getAllActiveSessions(): Promise<any[]> {
    const rawSessions = await prisma.$queryRaw<any[]>`
      SELECT 
        s.id,
        u.full_name as user_name,
        u.phone as user_phone,
        u.emergency_contact_name,
        u.emergency_contact_phone,
        u.medical_profile,
        t.name as trail_name,
        s.status::text,
        s.expected_end_at as scheduled_checkout_time,
        ST_Y(s.last_known_location) as last_lat,
        ST_X(s.last_known_location) as last_lng
      FROM hiking_sessions s
      JOIN users u ON s.user_id = u.id
      JOIN trails t ON s.trail_id = t.id
      WHERE s.status IN ('active', 'watchdog_alert', 'emergency')
    `;

    return rawSessions.map(s => {
      let color: 'green' | 'yellow' | 'red' | 'gray' = 'green';
      let statusStr = s.status;
      
      if (s.status === 'watchdog_alert') {
        color = 'yellow';
        statusStr = 'alert_pending';
      } else if (s.status === 'emergency') {
        color = 'red';
        statusStr = 'emergency_triggered';
      }

      return {
        id: s.id,
        user_name: s.user_name,
        user_phone: s.user_phone,
        emergency_contact_name: s.emergency_contact_name,
        emergency_contact_phone: s.emergency_contact_phone,
        medical_profile: s.medical_profile,
        trail_name: s.trail_name,
        status: statusStr,
        color,
        last_known_location: s.last_lat && s.last_lng ? {
          lat: s.last_lat,
          lon: s.last_lng
        } : null,
        scheduled_checkout_time: s.scheduled_checkout_time?.toISOString() || null
      };
    });
  }

  /**
   * Helper to format and emit real-time session update to EventBus
   */
  public static async emitSessionUpdate(sessionId: string): Promise<void> {
    try {
      const rawSessions = await prisma.$queryRaw<any[]>`
        SELECT 
          s.id,
          u.full_name as user_name,
          u.phone as user_phone,
          u.emergency_contact_name,
          u.emergency_contact_phone,
          u.medical_profile,
          t.name as trail_name,
          s.status::text,
          s.expected_end_at as scheduled_checkout_time,
          ST_Y(s.last_known_location) as last_lat,
          ST_X(s.last_known_location) as last_lng
        FROM hiking_sessions s
        JOIN users u ON s.user_id = u.id
        JOIN trails t ON s.trail_id = t.id
        WHERE s.id = ${sessionId}::uuid
        LIMIT 1
      `;
      const s = rawSessions[0];
      if (!s) return;

      let color: 'green' | 'yellow' | 'red' | 'gray' = 'green';
      let statusStr = s.status;
      
      if (s.status === 'watchdog_alert') {
        color = 'yellow';
        statusStr = 'alert_pending';
      } else if (s.status === 'emergency') {
        color = 'red';
        statusStr = 'emergency_triggered';
      } else if (['completed', 'cancelled', 'resolved'].includes(s.status)) {
        color = 'gray';
        statusStr = s.status;
      }

      const payload = {
        id: s.id,
        user_name: s.user_name,
        user_phone: s.user_phone,
        emergency_contact_name: s.emergency_contact_name,
        emergency_contact_phone: s.emergency_contact_phone,
        medical_profile: s.medical_profile,
        trail_name: s.trail_name,
        status: statusStr,
        color,
        last_known_location: s.last_lat && s.last_lng ? {
          lat: s.last_lat,
          lon: s.last_lng
        } : null,
        scheduled_checkout_time: s.scheduled_checkout_time?.toISOString() || null
      };

      eventBus.emit(EVENTS.HIKE_UPDATE, payload);
    } catch (err) {
      console.error('Error emitting session update:', err);
    }
  }

  /**
   * Resolves an emergency hike session by setting status to 'resolved' and updating active emergency events.
   */
  public static async resolveSession(sessionId: string, operatorId: string, notes?: string): Promise<HikingSession> {
    const dbSession = await this.getSessionWithCoords(sessionId);

    // Cancel watchdog timers
    await WatchdogService.cancelPendingJobs(sessionId);

    const now = new Date();

    // Update session status to resolved
    await prisma.hikingSession.update({
      where: { id: sessionId },
      data: {
        status: 'resolved',
        completedAt: now,
      },
    });

    // Check if there is an active emergency event and mark it as resolved
    const activeEmergency = await prisma.emergencyEvent.findFirst({
      where: {
        sessionId: sessionId,
        resolvedAt: null,
      },
    });

    if (activeEmergency) {
      await prisma.emergencyEvent.update({
        where: { id: activeEmergency.id },
        data: {
          resolvedAt: now,
          resolvedBy: operatorId,
          resolutionNotes: notes || 'Risolto da operatore centrale',
          falseAlarm: false,
        },
      });
    }

    const refreshed = await this.getSessionWithCoords(sessionId);
    SessionsService.emitSessionUpdate(sessionId);
    return this.mapDbSession(refreshed);
  }
}

