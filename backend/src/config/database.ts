import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');

    // Verify PostGIS extension
    const result = await prisma.$queryRaw<Array<{ postgis_full_version: string }>>`SELECT PostGIS_full_version();`;
    console.log('✅ PostGIS version:', result[0]?.postgis_full_version?.split(' ')[0]);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log('Database disconnected');
}
