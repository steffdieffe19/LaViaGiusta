export type SessionStatus = 'checked_in' | 'active' | 'watchdog_alert' | 'emergency' | 'completed' | 'cancelled' | 'resolved';
export interface HikingSession {
    id: string;
    userId: string;
    trailId: string;
    status: SessionStatus;
    checkInAt: string;
    startedAt?: string;
    expectedEndAt?: string;
    watchdogTriggeredAt?: string;
    userRespondedAt?: string;
    emergencyTriggeredAt?: string;
    completedAt?: string;
    groupId?: string;
    isGroupLeader: boolean;
    lastLocation?: Coordinate;
    lastLocationAt?: string;
    lastBatteryLevel?: number;
    isOffline: boolean;
    actualDurationMinutes?: number;
    actualDistanceMeters?: number;
    avgSpeedKmh?: number;
}
export interface Coordinate {
    latitude: number;
    longitude: number;
    altitude?: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
    timestamp?: string;
}
export interface CheckInRequest {
    trailId: string;
    groupId?: string;
}
export interface CheckInResponse {
    sessionId: string;
    expectedEndAt: string;
    trailName: string;
    estimatedDurationMinutes: number;
}
export interface LocationUpdate {
    latitude: number;
    longitude: number;
    altitude?: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
    batteryLevel?: number;
    timestamp: string;
}
export interface LocationBatch {
    locations: LocationUpdate[];
}
export type WatchdogAlertResponse = 'ok' | 'help' | 'extend';
export interface AlertResponseRequest {
    response: WatchdogAlertResponse;
    message?: string;
}
export interface SessionSummary {
    session: HikingSession;
    trailName: string;
    durationMinutes: number;
    distanceKm: number;
    elevationGain: number;
    avgSpeedKmh: number;
    badgesEarned: string[];
    stampEarned: boolean;
}
export interface DashboardSession {
    sessionId: string;
    userName: string;
    trailCode: string;
    trailName: string;
    status: SessionStatus;
    lastLocation?: Coordinate;
    lastLocationAt?: string;
    batteryLevel?: number;
    checkInAt: string;
    expectedEndAt?: string;
    isOffline: boolean;
}
export type TrafficLight = 'green' | 'yellow' | 'red';
export interface DashboardStats {
    activeSessionsCount: number;
    todayCheckInsCount: number;
    activeEmergenciesCount: number;
    weeklyHikersCount: number;
}
//# sourceMappingURL=session.types.d.ts.map