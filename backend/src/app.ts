import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import authRoutes from './modules/auth/auth.routes.js';
import trailRoutes from './modules/trails/trails.routes.js';
import sessionRoutes from './modules/sessions/sessions.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import communityRoutes from './modules/community/community.routes.js';
import userRoutes from './modules/user/user.routes.js';
import { startWatchdogWorker } from './jobs/watchdog-worker.js';
import { errorHandler } from './shared/middleware/error-handler.js';

const app = express();

// ── Global crash guards (visible in tsx watch output) ──────
process.on('uncaughtException', (err) => {
  console.error('🔴 Crash Critico (uncaughtException):', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('🔴 Promise Rifiutata (unhandledRejection):', reason);
});

// ── Middleware ──────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
    const isVercel = origin.endsWith('.vercel.app') || origin.includes('vercel.app');
    let isFrontendUrl = false;
    if (env.FRONTEND_URL) {
      try {
        const parsed = new URL(env.FRONTEND_URL);
        isFrontendUrl = origin === parsed.origin;
      } catch {
        isFrontendUrl = origin === env.FRONTEND_URL;
      }
    }
    if (isLocalhost || isVercel || isFrontendUrl) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(process.cwd(), 'src/public/uploads')));

// ── Health Check ───────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '0.1.0' });
});

// ── API Routes (will be added incrementally) ───────────────
app.use(`${env.API_PREFIX}/auth`, authRoutes);
app.use(`${env.API_PREFIX}/trails`, trailRoutes);
app.use(`${env.API_PREFIX}/sessions`, sessionRoutes);
app.use(`${env.API_PREFIX}/admin`, adminRoutes);
app.use(`${env.API_PREFIX}/community`, communityRoutes);
app.use(`${env.API_PREFIX}/user`, userRoutes);

// ── Error Handler ──────────────────────────────────────────
app.use(errorHandler);

// ── Server Startup ─────────────────────────────────────────
async function start(): Promise<void> {
  await connectDatabase();
  startWatchdogWorker();

  console.log(`⏳ Tentativo di avvio sulla porta: ${env.PORT}`);
  app.listen(env.PORT, '::', () => {
    console.log(`\n🏔️  LaViaGiusta Backend`);
    console.log(`   Environment: ${env.NODE_ENV}`);
    console.log(`   Port: ${env.PORT}`);
    console.log(`   Binding: :: (dual-stack IPv4 + IPv6)`);
    console.log(`   API: http://localhost:${env.PORT}${env.API_PREFIX}`);
    console.log(`   Health: http://localhost:${env.PORT}/health\n`);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\nSIGTERM received. Shutting down...');
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received. Shutting down...');
  await disconnectDatabase();
  process.exit(0);
});

start().catch(console.error);

export default app;
