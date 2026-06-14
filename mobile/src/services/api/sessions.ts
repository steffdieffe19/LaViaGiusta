import { apiClient } from './client';

export interface CheckInResponse {
  sessionId: string;
  expectedEndAt: string;
  trailName: string;
  estimatedDurationMinutes: number;
}

export interface HikingSession {
  id: string;
  userId: string;
  trailId: string;
  status: 'checked_in' | 'active' | 'watchdog_alert' | 'emergency' | 'completed' | 'cancelled' | 'resolved';
  checkInAt: string;
  startedAt?: string;
  expectedEndAt?: string;
  watchdogTriggeredAt?: string;
  userRespondedAt?: string;
  emergencyTriggeredAt?: string;
  completedAt?: string;
  isOffline: boolean;
  offlineSince?: string;
  actualDurationMinutes?: number;
  actualDistanceMeters?: number;
  avgSpeedKmh?: number;
}

export interface SessionSummary {
  session: HikingSession;
  trailName: string;
  durationMinutes: number;
  distanceKm: number;
  elevationGain: number;
  avgSpeedKmh: number;
  badgesEarned: Array<{
    id: string;
    code: string;
    name: string;
    description?: string;
    iconUrl: string;
    points: number;
    rarity: string;
  }>;
  stampEarned: boolean;
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

export class SessionsApi {
  /**
   * Initiates check-in at the trailhead and returns the session ID and expected end time
   */
  public static async checkIn(
    trailId: string, 
    watchdogTolerancePct: number, 
    groupSize: number, 
    groupNotes?: string
  ): Promise<CheckInResponse> {
    const response = await apiClient.post('/sessions/check-in', {
      trailId,
      watchdogTolerancePct,
      groupSize,
      groupNotes,
    });
    
    if (response.data && response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data?.error || 'Check-in failed');
  }

  /**
   * Starts an active session when the hiker actually sets off
   */
  public static async start(sessionId: string): Promise<HikingSession> {
    const response = await apiClient.post(`/sessions/${sessionId}/start`);
    if (response.data && response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data?.error || 'Failed to start session');
  }

  /**
   * Submits user response to a watchdog warning alert (e.g. extending session or checking in)
   */
  public static async respondAlert(
    sessionId: string, 
    responseType: 'ok' | 'help' | 'extend'
  ): Promise<HikingSession> {
    const response = await apiClient.post(`/sessions/${sessionId}/respond-alert`, {
      response: responseType,
    });
    if (response.data && response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data?.error || 'Failed to submit response');
  }

  /**
   * Triggers an immediate manual SOS emergency rescue call/SMS
   */
  public static async sos(sessionId: string): Promise<HikingSession> {
    const response = await apiClient.post(`/sessions/${sessionId}/sos`);
    if (response.data && response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data?.error || 'Failed to trigger SOS');
  }

  /**
   * Completes the hike and returns session summary metrics and badges/stamps
   */
  public static async complete(sessionId: string): Promise<SessionSummary> {
    const response = await apiClient.post(`/sessions/${sessionId}/complete`);
    if (response.data && response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data?.error || 'Failed to complete session');
  }

  /**
   * Retrieves the current user's active session, if any
   */
  public static async getActive(): Promise<HikingSession | null> {
    const response = await apiClient.get('/sessions/active');
    if (response.data && response.data.success) {
      return response.data.data;
    }
    return null;
  }

  /**
   * Uploads the hiker's current GPS location coordinate
   */
  public static async uploadLocation(
    sessionId: string, 
    update: LocationUpdate
  ): Promise<{ isOutOfBounds: boolean; distanceToPathMeters: number }> {
    const response = await apiClient.post(`/sessions/${sessionId}/location`, update);
    if (response.data && response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data?.error || 'Failed to upload location');
  }
}
