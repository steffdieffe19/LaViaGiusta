import { Redis } from 'ioredis';
import { env } from './env.js';

let redisConnection: Redis;

// export function getRedisConnection(): Redis {
//   if (!redisConnection) {
//     redisConnection = new Redis(env.REDIS_URL, {
//       maxRetriesPerRequest: null, // BullMQ requirement
//     });
//
//     redisConnection.on('connect', () => {
//       console.log('✅ Redis connected');
//     });
//
//     redisConnection.on('error', (err: Error) => {
//       console.error('❌ Redis connection error:', err);
//     });
//   }
//   return redisConnection;
// }

export function getRedisConnection(): Redis | null {
  return null;
}
