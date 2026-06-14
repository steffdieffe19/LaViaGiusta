export interface Trail {
    id: string;
    code: string;
    name: string;
    description?: string;
    distanceMeters: number;
    elevationGain?: number;
    elevationLoss?: number;
    elevationMin?: number;
    elevationMax?: number;
    difficulty: TrailDifficulty;
    avgDurationMinutes: number;
    surfaceType?: string;
    isLoop: boolean;
    isActive: boolean;
    seasonalClosure?: string;
    gpxFileUrl?: string;
    createdAt: string;
    geojson?: GeoJSON.FeatureCollection;
}
export type TrailDifficulty = 'T' | 'E' | 'EE' | 'EEA';
export interface TrailPoi {
    id: string;
    trailId: string;
    name: string;
    description?: string;
    category: PoiCategory;
    latitude: number;
    longitude: number;
    photoUrl?: string;
    isDanger: boolean;
}
export type PoiCategory = 'fontana' | 'rifugio' | 'panorama' | 'pericolo' | 'storico';
export interface TrailWithDetails extends Trail {
    pois: TrailPoi[];
    startPoint: {
        latitude: number;
        longitude: number;
    };
    endPoint: {
        latitude: number;
        longitude: number;
    };
    averageRating?: number;
    reviewsCount?: number;
    reviews?: Array<{
        id: string;
        rating: number;
        comment: string;
        createdAt: string;
        user: {
            fullName: string;
        };
    }>;
}
export interface NearbyTrailsRequest {
    latitude: number;
    longitude: number;
    radiusMeters: number;
}
//# sourceMappingURL=trail.types.d.ts.map