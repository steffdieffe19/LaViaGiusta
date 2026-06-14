import { create } from 'zustand';
import { Trail } from '../services/api/trails';
import { BackgroundLocationService } from '../services/backgroundLocation';

type HikeStatus = 'checked_in' | 'active' | 'watchdog_alert' | 'emergency' | 'completed' | 'cancelled' | 'resolved' | null;

interface HikeState {
  activeHikeSessionId: string | null;
  currentTrail: Trail | null;
  status: HikeStatus;
  isOffline: boolean;
  expectedEndAt: string | null;
  
  setActiveSession: (sessionId: string, trail: Trail, status?: HikeStatus, expectedEndAt?: string | null) => void;
  setStatus: (status: HikeStatus) => void;
  setExpectedEndAt: (expectedEndAt: string | null) => void;
  setOffline: (isOffline: boolean) => void;
  clearActiveSession: () => void;
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
}

export const useHikeStore = create<HikeState>((set, get) => ({
  activeHikeSessionId: null,
  currentTrail: null,
  status: null,
  isOffline: false,
  expectedEndAt: null,

  setActiveSession: (sessionId, trail, status = 'checked_in', expectedEndAt = null) => {
    set({
      activeHikeSessionId: sessionId,
      currentTrail: trail,
      status,
      expectedEndAt,
    });

    // Automatically trigger background tracking if starting in active status
    if (status === 'active' || status === 'watchdog_alert') {
      BackgroundLocationService.start(sessionId);
    } else {
      BackgroundLocationService.stop();
    }
  },

  setStatus: (status) => {
    set({ status });

    const sessionId = get().activeHikeSessionId;
    if (sessionId && (status === 'active' || status === 'watchdog_alert')) {
      BackgroundLocationService.start(sessionId);
    } else {
      BackgroundLocationService.stop();
    }
  },

  setExpectedEndAt: (expectedEndAt) => {
    set({ expectedEndAt });
  },

  setOffline: (isOffline) => {
    set({ isOffline });
  },

  clearActiveSession: () => {
    set({
      activeHikeSessionId: null,
      currentTrail: null,
      status: null,
      isOffline: false,
      expectedEndAt: null,
    });

    // Tear down any active background watchdog tracking services
    BackgroundLocationService.stop();
  },

  startTracking: async () => {
    const { activeHikeSessionId, status } = get();
    if (activeHikeSessionId && (status === 'active' || status === 'watchdog_alert')) {
      await BackgroundLocationService.start(activeHikeSessionId);
    }
  },

  stopTracking: async () => {
    await BackgroundLocationService.stop();
  },
}));
