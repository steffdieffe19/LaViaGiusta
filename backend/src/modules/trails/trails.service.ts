import { prisma } from '../../config/database.js';
import { GPXParserService } from './gpx-parser.js';
import { ValidationError, NotFoundError } from '../../shared/middleware/error-handler.js';
import { Trail, TrailWithDetails, TrailPoi, PoiCategory } from '../../../../shared/types/index.js';

interface DbTrail {
  id: string;
  code: string;
  name: string;
  description: string | null;
  distance_meters: number;
  elevation_gain: number | null;
  elevation_loss: number | null;
  elevation_min: number | null;
  elevation_max: number | null;
  difficulty: string;
  avg_duration_minutes: number;
  min_duration_minutes: number | null;
  max_duration_minutes: number | null;
  watchdog_tolerance_pct: number;
  surface_type: string | null;
  is_loop: boolean;
  is_active: boolean;
  seasonal_closure: string | null;
  gpx_file_url: string | null;
  created_at: Date;
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
}

interface DbPoi {
  id: string;
  trail_id: string;
  name: string;
  description: string | null;
  category: string;
  photo_url: string | null;
  is_danger: boolean;
  lat: number;
  lng: number;
}

export class TrailsService {
  /**
   * Helper to map raw database trail to clean Trail shape
   */
  private static mapDbTrail(db: DbTrail): Trail {
    return {
      id: db.id,
      code: db.code,
      name: db.name,
      description: db.description || undefined,
      distanceMeters: db.distance_meters,
      elevationGain: db.elevation_gain || undefined,
      elevationLoss: db.elevation_loss || undefined,
      elevationMin: db.elevation_min || undefined,
      elevationMax: db.elevation_max || undefined,
      difficulty: db.difficulty as any,
      avgDurationMinutes: db.avg_duration_minutes,
      surfaceType: db.surface_type || undefined,
      isLoop: db.is_loop,
      isActive: db.is_active,
      seasonalClosure: db.seasonal_closure || undefined,
      gpxFileUrl: db.gpx_file_url || undefined,
      createdAt: db.created_at.toISOString(),
    };
  }

  /**
   * Lists all active trails
   */
  public static async listTrails(): Promise<Trail[]> {
    const rawTrails = await prisma.$queryRaw<DbTrail[]>`
      SELECT id, code, name, description, distance_meters, elevation_gain, elevation_loss, 
             elevation_min, elevation_max, difficulty, avg_duration_minutes, min_duration_minutes, 
             max_duration_minutes, watchdog_tolerance_pct, surface_type, is_loop, is_active, 
             seasonal_closure, gpx_file_url, created_at,
        ST_Y(start_point) as start_lat, ST_X(start_point) as start_lng,
        ST_Y(end_point) as end_lat, ST_X(end_point) as end_lng
      FROM trails 
      WHERE is_active = true
      ORDER BY code ASC
    `;

    return rawTrails.map(t => this.mapDbTrail(t));
  }

  /**
   * Gets detail of a trail including POIs and start/end coordinates
   */
  public static async getTrailById(id: string): Promise<TrailWithDetails> {
    const rawTrails = await prisma.$queryRaw<DbTrail[]>`
      SELECT id, code, name, description, distance_meters, elevation_gain, elevation_loss, 
             elevation_min, elevation_max, difficulty, avg_duration_minutes, min_duration_minutes, 
             max_duration_minutes, watchdog_tolerance_pct, surface_type, is_loop, is_active, 
             seasonal_closure, gpx_file_url, created_at,
        ST_Y(start_point) as start_lat, ST_X(start_point) as start_lng,
        ST_Y(end_point) as end_lat, ST_X(end_point) as end_lng
      FROM trails 
      WHERE id = ${id}::uuid LIMIT 1
    `;

    const dbTrail = rawTrails[0];
    if (!dbTrail) {
      throw new NotFoundError('Trail');
    }

    const rawPois = await prisma.$queryRaw<DbPoi[]>`
      SELECT id, trail_id, name, description, category, photo_url, is_danger,
        ST_Y(location) as lat, ST_X(location) as lng
      FROM trail_pois
      WHERE trail_id = ${id}::uuid
    `;

    const pois: TrailPoi[] = rawPois.map(p => ({
      id: p.id,
      trailId: p.trail_id,
      name: p.name,
      description: p.description || undefined,
      category: p.category as PoiCategory,
      latitude: p.lat,
      longitude: p.lng,
      photoUrl: p.photo_url || undefined,
      isDanger: p.is_danger,
    }));

    return {
      ...this.mapDbTrail(dbTrail),
      pois,
      startPoint: { latitude: dbTrail.start_lat, longitude: dbTrail.start_lng },
      endPoint: { latitude: dbTrail.end_lat, longitude: dbTrail.end_lng },
    };
  }

  /**
   * Returns Dynamic GeoJSON representing the trail path (LINESTRING) for Mapbox client
   */
  public static async getTrailGeoJson(id: string): Promise<GeoJSON.FeatureCollection> {
    const rawGeom = await prisma.$queryRaw<Array<{ name: string; geojson: string }>>`
      SELECT name, ST_AsGeoJSON(route_geom) as geojson 
      FROM trails 
      WHERE id = ${id}::uuid LIMIT 1
    `;

    const row = rawGeom[0];
    if (!row || !row.geojson) {
      throw new NotFoundError('Trail path');
    }

    const geometry = JSON.parse(row.geojson);

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: row.name },
          geometry,
        },
      ],
    };
  }

  /**
   * Queries trails starting within a radius of the user position (using PostGIS index)
   */
  public static async getNearbyTrails(lat: number, lng: number, radiusMeters: number): Promise<Array<Trail & { distanceFromUserMeters: number }>> {
    // Note: ST_DWithin and ST_Distance work with Geography for true geodetic calculation in meters
    const rawTrails = await prisma.$queryRaw<Array<DbTrail & { distance_from_user: number }>>`
      SELECT id, code, name, description, distance_meters, elevation_gain, elevation_loss, 
             elevation_min, elevation_max, difficulty, avg_duration_minutes, min_duration_minutes, 
             max_duration_minutes, watchdog_tolerance_pct, surface_type, is_loop, is_active, 
             seasonal_closure, gpx_file_url, created_at,
        ST_Y(start_point) as start_lat, ST_X(start_point) as start_lng,
        ST_Y(end_point) as end_lat, ST_X(end_point) as end_lng,
        ST_Distance(start_point::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) as distance_from_user
      FROM trails 
      WHERE is_active = true 
        AND ST_DWithin(start_point::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusMeters})
      ORDER BY distance_from_user ASC
    `;

    return rawTrails.map(t => ({
      ...this.mapDbTrail(t),
      distanceFromUserMeters: Math.round(t.distance_from_user),
    }));
  }

  /**
   * Creates a trail by uploading and parsing a GPX file
   */
  public static async createTrailFromGPX(
    gpxContent: string,
    code: string,
    difficulty: string,
    surfaceType?: string,
    watchdogTolerancePct: number = 40
  ): Promise<Trail> {
    // 1. Check uniqueness
    const existing = await prisma.trail.findUnique({
      where: { code },
    });
    if (existing) {
      throw new ValidationError(`Trail with code '${code}' already exists`);
    }

    // 2. Parse GPX
    const parsed = GPXParserService.parse(gpxContent);

    // 3. Create db record
    const dbTrail = await prisma.trail.create({
      data: {
        code,
        name: parsed.name,
        description: `${parsed.name} parsed from GPX file.`,
        distanceMeters: parsed.distanceMeters,
        elevationGain: parsed.elevationGain,
        elevationLoss: parsed.elevationLoss,
        elevationMin: parsed.elevationMin,
        elevationMax: parsed.elevationMax,
        difficulty,
        avgDurationMinutes: Math.round((parsed.distanceMeters / 1000) * 20 + (parsed.elevationGain / 100) * 15), // CAI duration approximation if not specified
        watchdogTolerancePct,
        surfaceType,
        isLoop: parsed.points[0]!.lat === parsed.points[parsed.points.length - 1]!.lat && 
                parsed.points[0]!.lon === parsed.points[parsed.points.length - 1]!.lon,
        isActive: true,
      },
    });

    // 4. Construct WKT LINESTRING
    // Coordinates in WKT format must be: longitude latitude
    const wktCoords = parsed.points.map(p => `${p.lon} ${p.lat}`).join(',');
    const wktLineString = `LINESTRING(${wktCoords})`;

    const startPt = parsed.points[0]!;
    const endPt = parsed.points[parsed.points.length - 1]!;

    // 5. Update PostGIS geometry columns via raw SQL
    await prisma.$executeRaw`
      UPDATE trails SET
        route_geom = ST_SetSRID(ST_GeomFromText(${wktLineString}), 4326),
        start_point = ST_SetSRID(ST_MakePoint(${startPt.lon}, ${startPt.lat}), 4326),
        end_point = ST_SetSRID(ST_MakePoint(${endPt.lon}, ${endPt.lat}), 4326)
      WHERE id = ${dbTrail.id}::uuid
    `;

    // 6. Create waypoints (POIs) if present in GPX
    for (const wpt of parsed.waypoints) {
      // Map sym/type to CAI category
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
          trailId: dbTrail.id,
          name: wpt.name,
          description: wpt.desc || `${wpt.name} waypoint.`,
          category,
          isDanger: category === 'pericolo',
        },
      });

      // Insert spatial location
      await prisma.$executeRaw`
        UPDATE trail_pois SET
          location = ST_SetSRID(ST_MakePoint(${wpt.lon}, ${wpt.lat}), 4326)
        WHERE id = ${dbPoi.id}::uuid
      `;
    }

    // Retrieve and return fully populated object
    return this.getTrailById(dbTrail.id);
  }
}
