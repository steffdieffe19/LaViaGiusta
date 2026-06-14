import { Queue, FlowProducer } from 'bullmq';
import { getRedisConnection } from '../../config/redis.js';
import { prisma } from '../../config/database.js';
import { EmergencyService } from '../emergency/emergency.service.js';
import { SessionStatus } from '../../config/constants.js';

const QUEUE_NAME = 'watchdog-queue';
let watchdogQueue: Queue;

export function getWatchdogQueue(): Queue {
  if (!watchdogQueue) {
    watchdogQueue = new Queue(QUEUE_NAME, {
      connection: getRedisConnection() as any,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
      },
    });
  }
  return watchdogQueue;
}

export class WatchdogService {
  /**
   * Schedules the initial watchdog alert job when a user checks in
   */
  public static async scheduleWatchdogAlert(sessionId: string, delayMs: number): Promise<void> {
    console.log(`⏱️  Scheduling Watchdog Alert for session ${sessionId} in ${delayMs / 1000}s`);
    const queue = getWatchdogQueue();
    const jobId = `alert-timeout-${sessionId}`;

    // Remove any existing job for this session to prevent duplicates
    await this.cancelJob(jobId);

    await queue.add(
      'watchdog-alert-timeout',
      { sessionId },
      { delay: delayMs, jobId }
    );
  }

  /**
   * Schedules the 3-minute emergency timeout job
   */
  public static async scheduleEmergencyTimeout(sessionId: string, delayMs: number): Promise<void> {
    console.log(`⏱️  Scheduling Emergency Timeout for session ${sessionId} in ${delayMs / 1000}s`);
    const queue = getWatchdogQueue();
    const jobId = `emergency-timeout-${sessionId}`;

    await this.cancelJob(jobId);

    await queue.add(
      'watchdog-emergency-timeout',
      { sessionId },
      { delay: delayMs, jobId }
    );
  }

  /**
   * Cancels all pending watchdog jobs for a session (usually on complete/cancel)
   */
  public static async cancelPendingJobs(sessionId: string): Promise<void> {
    console.log(`⏱️  Cancelling all pending jobs for session ${sessionId}`);
    await this.cancelJob(`alert-timeout-${sessionId}`);
    await this.cancelJob(`emergency-timeout-${sessionId}`);
  }

  /**
   * Removes a specific job by ID from the queue
   */
  private static async cancelJob(jobId: string): Promise<void> {
    const queue = getWatchdogQueue();
    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
      console.log(`  🗑️  Job ${jobId} removed from queue`);
    }
  }

  /**
   * Execution logic when the watchdog timer expires
   * Moves status to watchdog_alert and prompts user (push notification simulation)
   */
  public static async handleAlertTimeout(sessionId: string): Promise<void> {
    console.log(`⏰ Watchdog Alert Timer EXPIRED for session: ${sessionId}`);

    const session = await prisma.hikingSession.findUnique({
      where: { id: sessionId },
      include: { user: true, trail: true },
    });

    if (!session || session.status === 'completed' || session.status === 'cancelled' || session.status === 'resolved') {
      console.log(`  ℹ️  Session is inactive (${session?.status}). Ignoring alert.`);
      return;
    }

    // Change status to watchdog_alert
    await prisma.hikingSession.update({
      where: { id: sessionId },
      data: {
        status: 'watchdog_alert',
        watchdogTriggeredAt: new Date(),
      },
    });

    // Emit real-time update
    const { SessionsService } = await import('./sessions.service.js');
    await SessionsService.emitSessionUpdate(sessionId);

    // Send push notification alert
    console.log(`🔔 PUSH NOTIFICATION SENT to ${session.user.fullName}: "Stai bene? Rispondi entro 3 minuti!"`);

    // Schedule emergency trigger in 3 minutes (180,000 ms)
    const timeoutSec = 180; // 3 minutes
    await this.scheduleEmergencyTimeout(sessionId, timeoutSec * 1000);
  }

  /**
   * Execution logic when the 3-minute prompt response timer expires
   * Moves status to emergency and triggers SMS / calls to rescue services
   */
  public static async handleEmergencyTimeout(sessionId: string): Promise<void> {
    console.log(`🚨 Emergency Timer EXPIRED for session: ${sessionId}`);

    const session = await prisma.hikingSession.findUnique({
      where: { id: sessionId },
      include: { user: true, trail: true },
    });

    if (!session || session.status !== 'watchdog_alert') {
      console.log(`  ℹ️  Session is not in watchdog_alert status (${session?.status}). Ignoring emergency trigger.`);
      return;
    }

    // Determine user location
    // Retrieve last position from PostGIS location_logs
    const lastLogs = await prisma.$queryRaw<Array<{ lat: number; lng: number; altitude: number | null }>>`
      SELECT ST_Y(location) as lat, ST_X(location) as lng, altitude
      FROM location_logs
      WHERE session_id = ${sessionId}::uuid
      ORDER BY recorded_at DESC
      LIMIT 1
    `;

    // Trail start point fallback if no logs exist
    const trailStart = await prisma.$queryRaw<Array<{ lat: number; lng: number }>>`
      SELECT ST_Y(start_point) as lat, ST_X(start_point) as lng
      FROM trails
      WHERE id = ${session.trailId}::uuid
      LIMIT 1
    `;

    const location = lastLogs[0] || {
      lat: trailStart[0]?.lat || 42.7400,
      lng: trailStart[0]?.lng || 13.4980,
      altitude: null,
    };

    // Update status to emergency
    await prisma.hikingSession.update({
      where: { id: sessionId },
      data: {
        status: 'emergency',
        emergencyTriggeredAt: new Date(),
      },
    });

    // Emit real-time update
    const { SessionsService } = await import('./sessions.service.js');
    await SessionsService.emitSessionUpdate(sessionId);

    // Create EmergencyEvent log record
    const event = await prisma.emergencyEvent.create({
      data: {
        sessionId: session.id,
        userId: session.userId,
        eventType: 'watchdog_timeout',
        userSnapshot: {
          fullName: session.user.fullName,
          phone: session.user.phone,
          medicalProfile: session.user.medicalProfile,
          emergencyContact: {
            name: session.user.emergencyContactName,
            phone: session.user.emergencyContactPhone,
          },
        },
        callInitiated: true,
        callNumber: process.env.EMERGENCY_CALL_NUMBER || '+39XXXXXXXXXX',
      },
    });

    // Update coordinates in emergency event via raw SQL
    await prisma.$executeRaw`
      UPDATE emergency_events SET
        gps_coordinates = ST_SetSRID(ST_MakePoint(${location.lng}, ${location.lat}), 4326)
      WHERE id = ${event.id}::uuid
    `;

    // Trigger SMS and Calls in parallel
    const smsResults = await EmergencyService.triggerEmergencySMS(session, session.user, location);
    const callResult = await EmergencyService.triggerEmergencyCall(session, session.user, location);

    // Save SMS targets to event log
    const numbersSent = smsResults.map(r => r.number);
    await prisma.emergencyEvent.update({
      where: { id: event.id },
      data: {
        smsSentTo: numbersSent,
      },
    });

    console.log(`🚨 SOS Sent to rescue teams. DB Event logged: ${event.id}`);
  }
}
