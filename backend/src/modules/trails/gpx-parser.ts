import { XMLParser } from 'fast-xml-parser';
import { ValidationError } from '../../shared/middleware/error-handler.js';

interface GPXPoint {
  lat: number;
  lon: number;
  ele?: number;
  time?: string;
}

interface GPXWaypoint {
  name: string;
  desc?: string;
  category?: string;
  lat: number;
  lon: number;
}

export interface ParsedGPX {
  name: string;
  points: GPXPoint[];
  waypoints: GPXWaypoint[];
  distanceMeters: number;
  elevationGain: number;
  elevationLoss: number;
  elevationMin: number;
  elevationMax: number;
}

export class GPXParserService {
  /**
   * Parses GPX XML content and returns track points, waypoints and elevation stats
   */
  public static parse(xmlContent: string): ParsedGPX {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });

    let gpxData;
    try {
      gpxData = parser.parse(xmlContent);
    } catch (err) {
      throw new ValidationError('Malformed GPX XML file');
    }

    if (!gpxData || !gpxData.gpx) {
      throw new ValidationError('Invalid GPX format: missing <gpx> root element');
    }

    const gpx = gpxData.gpx;
    let name = 'Sentiero';
    const points: GPXPoint[] = [];
    const waypoints: GPXWaypoint[] = [];

    // Extract name from metadata (primary), or first track element as fallback
    if (gpx.metadata && gpx.metadata.name) {
      name = String(gpx.metadata.name);
    } else if (gpx.trk) {
      const firstTrk = Array.isArray(gpx.trk) ? gpx.trk[0] : gpx.trk;
      if (firstTrk?.name) name = String(firstTrk.name);
    }

    // Extract Track Points — handle single <trk> or multiple <trk> elements
    if (gpx.trk) {
      const tracks = Array.isArray(gpx.trk) ? gpx.trk : [gpx.trk];

      // Use the track name from the first track if not already set from metadata
      if (name === 'Sentiero' && tracks[0]?.name) {
        name = String(tracks[0].name);
      }

      for (const trk of tracks) {
        if (!trk || !trk.trkseg) continue;
        // trkseg can be an object or an array of segments
        const segments = Array.isArray(trk.trkseg) ? trk.trkseg : [trk.trkseg];

        for (const segment of segments) {
          if (!segment || !segment.trkpt) continue;
          const trkpts = Array.isArray(segment.trkpt) ? segment.trkpt : [segment.trkpt];
          for (const pt of trkpts) {
            const lat = parseFloat(pt['@_lat']);
            const lon = parseFloat(pt['@_lon']);
            const ele = pt.ele !== undefined ? parseFloat(pt.ele) : undefined;
            const time = pt.time;

            if (!isNaN(lat) && !isNaN(lon)) {
              points.push({ lat, lon, ele, time });
            }
          }
        }
      }
    }

    // Extract Waypoints (POIs)
    if (gpx.wpt) {
      const wpts = Array.isArray(gpx.wpt) ? gpx.wpt : [gpx.wpt];
      for (const wpt of wpts) {
        const lat = parseFloat(wpt['@_lat']);
        const lon = parseFloat(wpt['@_lon']);
        const wptName = wpt.name || 'Punto di Interesse';
        const desc = wpt.desc;
        const category = wpt.type || wpt.sym || 'landmark';

        if (!isNaN(lat) && !isNaN(lon)) {
          waypoints.push({
            name: wptName,
            desc,
            category,
            lat,
            lon,
          });
        }
      }
    }

    if (points.length < 2) {
      throw new ValidationError('GPX track must contain at least 2 points');
    }

    // Calculate distance, elevation profile, and bounds
    const stats = this.calculateStats(points);

    return {
      name,
      points,
      waypoints,
      ...stats,
    };
  }

  /**
   * Calculates distance using Haversine formula and elevation gain/loss
   */
  private static calculateStats(points: GPXPoint[]) {
    let distanceMeters = 0;
    let elevationGain = 0;
    let elevationLoss = 0;
    let elevationMin = Infinity;
    let elevationMax = -Infinity;

    for (let i = 0; i < points.length; i++) {
      const pt = points[i]!;

      // Elevation bounds
      if (pt.ele !== undefined) {
        if (pt.ele < elevationMin) elevationMin = pt.ele;
        if (pt.ele > elevationMax) elevationMax = pt.ele;
      }

      if (i > 0) {
        const prev = points[i - 1]!;
        // Distance
        distanceMeters += this.haversineDistance(
          prev.lat,
          prev.lon,
          pt.lat,
          pt.lon
        );

        // Elevation changes
        if (prev.ele !== undefined && pt.ele !== undefined) {
          const diff = pt.ele - prev.ele;
          if (diff > 0) {
            elevationGain += diff;
          } else {
            elevationLoss += Math.abs(diff);
          }
        }
      }
    }

    return {
      distanceMeters: Math.round(distanceMeters),
      elevationGain: Math.round(elevationGain),
      elevationLoss: Math.round(elevationLoss),
      elevationMin: elevationMin === Infinity ? 0 : Math.round(elevationMin),
      elevationMax: elevationMax === -Infinity ? 0 : Math.round(elevationMax),
    };
  }

  /**
   * Distance in meters between two coordinates (Haversine formula)
   */
  private static haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) *
        Math.cos(phi2) *
        Math.sin(deltaLambda / 2) *
        Math.sin(deltaLambda / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
