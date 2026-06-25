import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../config/redis.js';
import { WatchdogService } from '../modules/sessions/watchdog.service.js';

const QUEUE_NAME = 'watchdog-queue';
let watchdogWorker: Worker;

export function startWatchdogWorker(): Worker | null {
  if (!watchdogWorker) {
    const connection = getRedisConnection();
    if (!connection) {
      console.warn('⚠️  Redis connection is not available. Skipping Watchdog Worker startup.');
      return null;
    }
    console.log('⏱️  Starting Watchdog Worker...');
    watchdogWorker = new Worker(
      QUEUE_NAME,
      async (job: Job) => {
        const { sessionId } = job.data;
        console.log(`👷 Worker processing job ${job.name} (id: ${job.id}) for session ${sessionId}`);

        try {
          if (job.name === 'watchdog-alert-timeout') {
            await WatchdogService.handleAlertTimeout(sessionId);
          } else if (job.name === 'watchdog-emergency-timeout') {
            await WatchdogService.handleEmergencyTimeout(sessionId);
          } else {
            console.warn(`  ⚠️ Unknown job type: ${job.name}`);
          }
        } catch (error: any) {
          console.error(`  ❌ Worker job ${job.id} failed:`, error.message);
          throw error;
        }
      },
      {
        connection: connection as any,
        concurrency: 5,
      }
    );

    watchdogWorker.on('completed', (job) => {
      console.log(`👷 Job ${job.name} (id: ${job.id}) completed successfully`);
    });

    watchdogWorker.on('failed', (job, err) => {
      console.error(`👷 Job ${job?.name} (id: ${job?.id}) failed:`, err.message);
    });
  }
  
  return watchdogWorker;
}
