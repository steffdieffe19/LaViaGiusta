import { prisma } from '../src/config/database.js';
import { GPXParserService } from '../src/modules/trails/gpx-parser.js';
import { trailsConfig } from '../src/config/trails.config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('🌱 Starting GPX trails seeding...');

  // ── Step 0: Pulizia totale del database (ordine FK-safe) ─────────────────
  // Rispettiamo le FK eliminando dalle tabelle figlio verso quelle padre.
  console.log('\n🗑️  Cleaning existing trail data from database...');
  await prisma.trailStamp.deleteMany({});       // FK → hiking_sessions + trails
  await prisma.emergencyEvent.deleteMany({});    // FK → hiking_sessions
  await prisma.locationLog.deleteMany({});       // FK → hiking_sessions
  await prisma.hikingSession.deleteMany({});     // FK → trails
  await prisma.trailPoi.deleteMany({});          // FK → trails
  await prisma.trail.deleteMany({});             // Root table — ora libera da vincoli
  console.log('   ✅ Database cleared. Starting fresh import.');

  // Upgrade route_geom to accept Z dimension (LineStringZ)
  console.log('🔧 Altering route_geom column to geometry(LINESTRINGZ, 4326)...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE trails ALTER COLUMN route_geom TYPE geometry(LINESTRINGZ, 4326) USING NULL;
  `);

  const gpxDir = path.join(__dirname, '../src/assets/gpx');
  if (!fs.existsSync(gpxDir)) {
    console.log(`📁 Creating GPX directory: ${gpxDir}`);
    fs.mkdirSync(gpxDir, { recursive: true });
    // Place an empty .gitkeep so directory is tracked
    fs.writeFileSync(path.join(gpxDir, '.gitkeep'), '');
  }

  for (const item of trailsConfig) {
    const filePath = path.join(gpxDir, item.gpxFilename);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ GPX file not found: ${item.gpxFilename} at ${filePath}. Skipping...`);
      continue;
    }

    console.log(`\n🧭 Processing trail [${item.code}] from GPX: ${item.gpxFilename}...`);
    const xmlContent = fs.readFileSync(filePath, 'utf-8');

    // 1. Parse GPX XML
    const parsed = GPXParserService.parse(xmlContent);
    const distanceMeters = parsed.distanceMeters;
    const elevationGain = parsed.elevationGain;
    const elevationLoss = parsed.elevationLoss;
    const elevationMin = parsed.elevationMin;
    const elevationMax = parsed.elevationMax;

    // Use config value or compute duration (CAI formula)
    const avgDuration = item.avgDurationMinutes || Math.round((distanceMeters / 1000) * 20 + (elevationGain / 100) * 15);
    const watchdogTolerance = item.watchdogTolerancePct !== undefined ? item.watchdogTolerancePct : 40;
    const isLoop = item.isLoop !== undefined ? item.isLoop : (
      parsed.points[0]!.lat === parsed.points[parsed.points.length - 1]!.lat && 
      parsed.points[0]!.lon === parsed.points[parsed.points.length - 1]!.lon
    );

    // 2. Create trail record (DB was wiped at startup, so always INSERT)
    console.log(`  ➕ Creating trail record: ${item.name} (${item.code})`);
    const created = await prisma.trail.create({
      data: {
        code: item.code,
        name: item.name,
        description: item.description,
        distanceMeters,
        elevationGain,
        elevationLoss,
        elevationMin,
        elevationMax,
        difficulty: item.difficulty,
        avgDurationMinutes: avgDuration,
        watchdogTolerancePct: watchdogTolerance,
        surfaceType: item.surfaceType || null,
        isLoop,
        isActive: true,
        seasonalClosure: item.seasonalClosure || null,
      }
    });
    const trailId = created.id;

    // 3. Update spatial geometries via raw PostGIS SQL
    // Use LINESTRINGZ so elevation (Z) is preserved in route_geom.
    // ST_AsGeoJSON will then return 3D coordinates, enabling real elevation profiles.
    const wktCoords = parsed.points.map(p => `${p.lon} ${p.lat} ${p.ele ?? 0}`).join(',');
    const wktLineString = `LINESTRINGZ(${wktCoords})`;
    const startPt = parsed.points[0]!;
    const endPt = parsed.points[parsed.points.length - 1]!;

    await prisma.$executeRaw`
      UPDATE trails SET
        route_geom = ST_SetSRID(ST_GeomFromText(${wktLineString}), 4326),
        start_point = ST_SetSRID(ST_MakePoint(${startPt.lon}, ${startPt.lat}), 4326),
        end_point = ST_SetSRID(ST_MakePoint(${endPt.lon}, ${endPt.lat}), 4326)
      WHERE id = ${trailId}::uuid
    `;

    // 4. Re-populate POIs (Waypoints) from GPX
    for (const wpt of parsed.waypoints) {
      let category = 'panorama';
      if (wpt.category?.toLowerCase().includes('water') || wpt.category?.toLowerCase().includes('font')) {
        category = 'fontana';
      } else if (wpt.category?.toLowerCase().includes('camp') || wpt.category?.toLowerCase().includes('hut')) {
        category = 'rifugio';
      } else if (wpt.category?.toLowerCase().includes('danger') || wpt.category?.toLowerCase().includes('warning')) {
        category = 'pericolo';
      } else if (wpt.category?.toLowerCase().includes('history') || wpt.category?.toLowerCase().includes('museum')) {
        category = 'storico';
      }

      const dbPoi = await prisma.trailPoi.create({
        data: {
          trailId,
          name: wpt.name,
          description: wpt.desc || `${wpt.name} waypoint.`,
          category,
          isDanger: category === 'pericolo',
        }
      });

      await prisma.$executeRaw`
        UPDATE trail_pois SET
          location = ST_SetSRID(ST_MakePoint(${wpt.lon}, ${wpt.lat}), 4326)
        WHERE id = ${dbPoi.id}::uuid
      `;
    }

    console.log(`  ✅ Seeding complete. Points: ${parsed.points.length}, POIs: ${parsed.waypoints.length}`);
  }

  console.log('\n🎉 GPX Seeding task complete!');
}

main()
  .catch(e => {
    console.error('❌ Seeding script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
