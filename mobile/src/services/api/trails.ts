import { apiClient } from './client';

export interface Trail {
  id: string;
  code: string;
  name: string;
  description: string;
  distanceMeters: number;
  elevationGain: number;
  difficulty: string;
  avgDurationMinutes: number;
  startPoint?: { latitude: number; longitude: number };
  endPoint?: { latitude: number; longitude: number };
}

// Fallback Mock Data for design-time/offline testing
const MOCK_TRAILS: Trail[] = [
  {
    id: '58b6681e-5de5-4582-8f13-542382bd412b',
    code: 'T01',
    name: 'Sentiero delle Cascate - Valle Castellana',
    description: 'Un percorso panoramico attraverso le cascate del territorio di Valle Castellana. Adatto a escursionisti di livello intermedio.',
    distanceMeters: 8500,
    elevationGain: 450,
    difficulty: 'E',
    avgDurationMinutes: 180,
    startPoint: { latitude: 42.7400, longitude: 13.4980 },
    endPoint: { latitude: 42.7400, longitude: 13.4980 },
  },
  {
    id: 'a90e3cd2-911e-450c-bdf6-4fdfd33261a8',
    code: 'T02',
    name: 'Sentiero del Monte Comunitore',
    description: 'Percorso impegnativo verso la vetta del Monte Comunitore con vista panoramica sui Monti della Laga.',
    distanceMeters: 12000,
    elevationGain: 850,
    difficulty: 'EE',
    avgDurationMinutes: 300,
    startPoint: { latitude: 42.7300, longitude: 13.4850 },
    endPoint: { latitude: 42.7460, longitude: 13.4970 },
  }
];

const MOCK_GEOJSON_T01 = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Sentiero delle Cascate' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [13.4980, 42.7400],
          [13.5010, 42.7420],
          [13.5050, 42.7450],
          [13.5080, 42.7470],
          [13.5100, 42.7500],
          [13.5080, 42.7520],
          [13.5050, 42.7490],
          [13.5020, 42.7460],
          [13.4980, 42.7400]
        ]
      }
    }
  ]
};

const MOCK_GEOJSON_T02 = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Sentiero Monte Comunitore' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [13.4850, 42.7300],
          [13.4880, 42.7340],
          [13.4920, 42.7380],
          [13.4950, 42.7420],
          [13.4970, 42.7460]
        ]
      }
    }
  ]
};

export class TrailsApi {
  /**
   * Fetch list of all trails
   */
  public static async fetchAll(): Promise<Trail[]> {
    try {
      const response = await apiClient.get('/trails');
      if (response.data && response.data.success) {
        return response.data.data;
      }
      return MOCK_TRAILS;
    } catch (error) {
      console.warn('⚠️ Failed to fetch trails from backend. Using mock fallback data.', error);
      return MOCK_TRAILS;
    }
  }

  /**
   * Fetch single trail detail
   */
  public static async fetchById(id: string): Promise<Trail> {
    try {
      const response = await apiClient.get(`/trails/${id}`);
      if (response.data && response.data.success) {
        return response.data.data;
      }
      return MOCK_TRAILS.find(t => t.id === id) || MOCK_TRAILS[0];
    } catch (error) {
      console.warn(`⚠️ Failed to fetch trail ${id} from backend. Using mock fallback data.`, error);
      return MOCK_TRAILS.find(t => t.id === id) || MOCK_TRAILS[0];
    }
  }

  /**
   * Fetch GeoJSON coordinates for a single trail
   */
  public static async fetchGeoJSON(trailId: string): Promise<any> {
    try {
      const response = await apiClient.get(`/trails/${trailId}/geojson`);
      if (response.data && response.data.type === 'FeatureCollection') {
        return response.data;
      }
      if (response.data && response.data.success && response.data.data) {
        return response.data.data;
      }
      return trailId === 'a90e3cd2-911e-450c-bdf6-4fdfd33261a8' ? MOCK_GEOJSON_T02 : MOCK_GEOJSON_T01;
    } catch (error) {
      console.warn(`⚠️ Failed to fetch GeoJSON for trail ${trailId}. Using mock fallback.`, error);
      return trailId === 'a90e3cd2-911e-450c-bdf6-4fdfd33261a8' ? MOCK_GEOJSON_T02 : MOCK_GEOJSON_T01;
    }
  }
}
