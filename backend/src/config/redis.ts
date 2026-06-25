// import { Redis } from 'ioredis';
// import { env } from './env.js';
//
// let redisConnection: Redis;
//
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

import { Redis } from 'ioredis';
import { env } from './env.js';

let redisConnection: Redis | null = null;

export function getRedisConnection(): Redis | null {
  // Se non c'è l'URL di Redis, restituiamo null e non facciamo nulla
  if (!env.REDIS_URL) {
    console.log('⚠️ Redis URL non trovato: connessione saltata.');
    return null;
  }

  if (!redisConnection) {
    redisConnection = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // BullMQ requirement
    });

    redisConnection.on('connect', () => {
      console.log('✅ Redis connected');
    });

    redisConnection.on('error', (err: Error) => {
      console.error('❌ Redis connection error:', err);
    });
  }
  return redisConnection;
}
