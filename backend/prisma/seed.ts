import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Create Admin User ──
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@vallecastellana.it' },
    update: {},
    create: {
      email: 'admin@vallecastellana.it',
      passwordHash: adminPassword,
      fullName: 'Amministratore Comunale',
      role: 'admin',
      phone: '+39XXXXXXXXXX',
    },
  });
  console.log(`  ✅ Admin user: ${admin.email}`);

  // ── Create Test User ──
  const userPassword = await bcrypt.hash('test1234', 12);
  const user = await prisma.user.upsert({
    where: { email: 'escursionista@test.it' },
    update: {},
    create: {
      email: 'escursionista@test.it',
      passwordHash: userPassword,
      fullName: 'Mario Rossi',
      phone: '+393331234567',
      role: 'tourist',
      emergencyContactName: 'Luigi Rossi',
      emergencyContactPhone: '+393339876543',
      medicalProfile: {
        blood_type: 'A+',
        allergies: ['penicillina'],
        conditions: [],
        medications: [],
      },
      fitnessLevel: 'intermediate',
      privacyConsent: true,
      privacyConsentDate: new Date(),
    },
  });
  console.log(`  ✅ Test user: ${user.email}`);

  // ── Create Test Operator ──
  const operatorPassword = await bcrypt.hash('operator123', 12);
  const operator = await prisma.user.upsert({
    where: { email: 'operator@vallecastellana.it' },
    update: {},
    create: {
      email: 'operator@vallecastellana.it',
      passwordHash: operatorPassword,
      fullName: 'Operatore Centrale',
      phone: '+39333999888',
      role: 'operator',
      privacyConsent: true,
      privacyConsentDate: new Date(),
    },
  });
  console.log(`  ✅ Test operator: ${operator.email}`);

  // ── Create Sample Trail ──
  // Note: PostGIS geometry columns must be set via raw SQL
  const trail = await prisma.trail.upsert({
    where: { code: 'T01' },
    update: {},
    create: {
      code: 'T01',
      name: 'Sentiero delle Cascate - Valle Castellana',
      description: 'Un percorso panoramico attraverso le cascate del territorio di Valle Castellana. Adatto a escursionisti di livello intermedio.',
      distanceMeters: 8500,
      elevationGain: 450,
      elevationLoss: 450,
      elevationMin: 600,
      elevationMax: 1050,
      difficulty: 'E',
      avgDurationMinutes: 180,
      minDurationMinutes: 140,
      maxDurationMinutes: 240,
      watchdogTolerancePct: 40,
      surfaceType: 'sentiero',
      isLoop: true,
      isActive: true,
      seasonalClosure: 'dic-mar',
    },
  });
  console.log(`  ✅ Trail: ${trail.code} - ${trail.name}`);

  // Set PostGIS geometry via raw SQL (sample coordinates near Valle Castellana)
  try {
    await prisma.$executeRaw`
      UPDATE trails SET
        route_geom = ST_SetSRID(ST_MakeLine(ARRAY[
          ST_MakePoint(13.4980, 42.7400),
          ST_MakePoint(13.5010, 42.7420),
          ST_MakePoint(13.5050, 42.7450),
          ST_MakePoint(13.5080, 42.7470),
          ST_MakePoint(13.5100, 42.7500),
          ST_MakePoint(13.5080, 42.7520),
          ST_MakePoint(13.5050, 42.7490),
          ST_MakePoint(13.5020, 42.7460),
          ST_MakePoint(13.4980, 42.7400)
        ]), 4326),
        start_point = ST_SetSRID(ST_MakePoint(13.4980, 42.7400), 4326),
        end_point = ST_SetSRID(ST_MakePoint(13.4980, 42.7400), 4326)
      WHERE code = 'T01'
    `;
    console.log('  ✅ Trail geometry set (PostGIS)');
  } catch (err) {
    console.log('  ⚠️ PostGIS columns route_geom not yet present (must run migration first)');
  }

  // ── Create Sample Trail 2 ──
  const trail2 = await prisma.trail.upsert({
    where: { code: 'T02' },
    update: {},
    create: {
      code: 'T02',
      name: 'Sentiero del Monte Comunitore',
      description: 'Percorso impegnativo verso la vetta del Monte Comunitore con vista panoramica sui Monti della Laga.',
      distanceMeters: 12000,
      elevationGain: 850,
      elevationLoss: 850,
      elevationMin: 700,
      elevationMax: 1550,
      difficulty: 'EE',
      avgDurationMinutes: 300,
      minDurationMinutes: 240,
      maxDurationMinutes: 400,
      watchdogTolerancePct: 40,
      surfaceType: 'roccioso',
      isLoop: false,
      isActive: true,
    },
  });
  console.log(`  ✅ Trail: ${trail2.code} - ${trail2.name}`);

  try {
    await prisma.$executeRaw`
      UPDATE trails SET
        route_geom = ST_SetSRID(ST_MakeLine(ARRAY[
          ST_MakePoint(13.4850, 42.7300),
          ST_MakePoint(13.4880, 42.7340),
          ST_MakePoint(13.4920, 42.7380),
          ST_MakePoint(13.4950, 42.7420),
          ST_MakePoint(13.4970, 42.7460)
        ]), 4326),
        start_point = ST_SetSRID(ST_MakePoint(13.4850, 42.7300), 4326),
        end_point = ST_SetSRID(ST_MakePoint(13.4970, 42.7460), 4326)
      WHERE code = 'T02'
    `;
    console.log('  ✅ Trail 2 geometry set (PostGIS)');
  } catch (err) {
    console.log('  ⚠️ PostGIS columns route_geom not yet present for T02');
  }

  // ── Watchdog Config defaults ──
  const configs = [
    { key: 'default_tolerance_pct', value: 40, description: 'Tolleranza % timer watchdog di default' },
    { key: 'alert_response_timeout_sec', value: 180, description: 'Secondi per rispondere al prompt (3 min)' },
    { key: 'offline_timeout_minutes', value: 30, description: 'Minuti senza segnale prima di allerta offline' },
    { key: 'emergency_sms_numbers', value: ['118', '+39XXXXXXXXXX'], description: 'Numeri per SMS emergenza' },
    { key: 'emergency_call_number', value: '+39XXXXXXXXXX', description: 'Numero Protezione Civile locale' },
    { key: 'location_update_interval_sec', value: 30, description: 'Intervallo aggiornamento GPS in secondi' },
    { key: 'geofence_alert_enabled', value: true, description: 'Alert se utente esce dal corridoio sentiero' },
  ];

  for (const config of configs) {
    await prisma.watchdogConfig.upsert({
      where: { key: config.key },
      update: {},
      create: {
        key: config.key,
        value: config.value as any,
        description: config.description,
      },
    });
  }
  console.log('  ✅ Watchdog config defaults set');

  // ── Sample Badges ──
  const badges = [
    {
      code: 'first_hike',
      name: 'Prima Escursione',
      description: 'Completa la tua prima escursione a Valle Castellana',
      iconUrl: '/badges/first_hike.png',
      category: 'achievement',
      criteria: { type: 'count', entity: 'trails_completed', threshold: 1 },
      points: 10,
      rarity: 'common',
    },
    {
      code: 'all_trails',
      name: 'Esploratore Completo',
      description: 'Completa tutti i sentieri di Valle Castellana',
      iconUrl: '/badges/all_trails.png',
      category: 'achievement',
      criteria: { type: 'all_trails_complete' },
      points: 100,
      rarity: 'legendary',
    },
    {
      code: 'elevation_1000',
      name: 'Scalatore 1000m',
      description: 'Accumula 1000 metri di dislivello positivo',
      iconUrl: '/badges/elevation_1000.png',
      category: 'achievement',
      criteria: { type: 'elevation', total_gain: 1000 },
      points: 50,
      rarity: 'rare',
    },
    {
      code: 'trail_t01',
      name: 'Timbro: Sentiero delle Cascate',
      description: 'Completa il Sentiero delle Cascate',
      iconUrl: '/badges/trail_t01.png',
      category: 'trail',
      criteria: { type: 'trail_complete', trail_code: 'T01' },
      points: 20,
      rarity: 'common',
    },
  ];

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { code: badge.code },
      update: {},
      create: badge,
    });
  }
  console.log(`  ✅ ${badges.length} sample badges created`);

  console.log('\n🌱 Database seeded successfully!\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
