import BackgroundJob from 'react-native-background-actions';
import Geolocation from 'react-native-geolocation-service';
import * as SecureStore from 'expo-secure-store';
import { SessionsApi, LocationUpdate } from './api/sessions';
import { colors } from '../theme';

const QUEUE_KEY = 'watchdog_offline_gps_queue';
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes standard watchdog interval

// Helper to pause execution inside the loop
const sleep = (time: number) => new Promise((resolve) => setTimeout(resolve, time));

/**
 * Persisted Offline Queue Manager using Expo Secure Store
 */
class OfflineQueue {
  public static async getQueue(): Promise<LocationUpdate[]> {
    try {
      const data = await SecureStore.getItemAsync(QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public static async saveQueue(queue: LocationUpdate[]): Promise<void> {
    try {
      await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.warn('⚠️ Errore nel salvataggio della coda offline:', e);
    }
  }

  public static async enqueue(location: LocationUpdate): Promise<void> {
    const queue = await this.getQueue();
    queue.push(location);
    await this.saveQueue(queue);
  }

  public static async clear(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(QUEUE_KEY);
    } catch {}
  }
}

/**
 * Headless Background Location Worker Task
 */
const backgroundTask = async (taskArgs: any) => {
  const { sessionId, interval } = taskArgs;
  
  console.log(`🏔️ Watchdog GPS Tracking Service started for session: ${sessionId}`);
  
  // High-precision geolocation request helper
  const getGPSLocation = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => reject(err),
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
          forceRequestLocation: true,
        }
      );
    });
  };

  while (BackgroundJob.isRunning()) {
    try {
      // 1. Acquire current coordinates
      const position = await getGPSLocation();
      const currentUpdate: LocationUpdate = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        altitude: position.coords.altitude !== null ? position.coords.altitude : undefined,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed !== null ? position.coords.speed : undefined,
        heading: position.coords.heading !== null ? position.coords.heading : undefined,
        timestamp: new Date(position.timestamp).toISOString(),
      };

      console.log(`📍 Posizione acquisita: ${currentUpdate.latitude}, ${currentUpdate.longitude}`);

      // 2. Synchronize offline queue backlog if any coordinates were cached
      const offlineQueue = await OfflineQueue.getQueue();
      if (offlineQueue.length > 0) {
        console.log(`📡 Rete rilevata. Sincronizzazione di ${offlineQueue.length} coordinate memorizzate offline...`);
        
        // Upload each cached update in chronological order
        for (const cachedUpdate of offlineQueue) {
          try {
            await SessionsApi.uploadLocation(sessionId, cachedUpdate);
          } catch (syncErr) {
            // If upload fails again during queue flush, abort syncing and preserve remaining queue
            console.warn('⚠️ Sincronizzazione della coda interrotta per problemi di rete.');
            throw syncErr; // Triggers the catch block to cache current location as well
          }
        }
        
        // Successfully synchronized backlog
        await OfflineQueue.clear();
        console.log('📡 Coda offline sincronizzata correttamente.');
      }

      // 3. Upload current position
      await SessionsApi.uploadLocation(sessionId, currentUpdate);
      console.log('📡 Posizione corrente inviata con successo.');

    } catch (err) {
      // 4. Handle offline/network failure
      console.warn('⚠️ Invio posizione fallito (Dispositivo Offline). Memorizzazione locale...');
      
      // Get current location directly from geolocation to cache if network alone failed
      try {
        const fallbackPos = await getGPSLocation();
        const fallbackUpdate: LocationUpdate = {
          latitude: fallbackPos.coords.latitude,
          longitude: fallbackPos.coords.longitude,
          altitude: fallbackPos.coords.altitude !== null ? fallbackPos.coords.altitude : undefined,
          accuracy: fallbackPos.coords.accuracy,
          speed: fallbackPos.coords.speed !== null ? fallbackPos.coords.speed : undefined,
          heading: fallbackPos.coords.heading !== null ? fallbackPos.coords.heading : undefined,
          timestamp: new Date(fallbackPos.timestamp).toISOString(),
        };
        await OfflineQueue.enqueue(fallbackUpdate);
      } catch (gpsErr) {
        console.error('❌ Impossibile acquisire posizione GPS anche per caching locale:', gpsErr);
      }
    }

    // 5. Wait for the specified interval (N minutes) before next acquisition
    await sleep(interval);
  }
};

export class BackgroundLocationService {
  private static isRunning = false;

  /**
   * Starts the foreground notification service on Android / background task on iOS
   */
  public static async start(sessionId: string, intervalMs: number = DEFAULT_INTERVAL_MS): Promise<void> {
    if (this.isRunning) {
      console.log('ℹ️ Servizio GPS in background già in esecuzione.');
      return;
    }

    const options = {
      taskName: 'LaViaGiustaWatchdog',
      taskTitle: 'LaViaGiusta',
      taskDesc: 'LaViaGiusta sta proteggendo il tuo cammino - Watchdog attivo',
      taskIcon: {
        name: 'ic_launcher',
        type: 'mipmap',
      },
      color: colors.accent, // Neon orange contrast from Design System
      linkingURI: 'laviagiusta://active',
      parameters: {
        sessionId,
        interval: intervalMs,
      },
    };

    try {
      await BackgroundJob.start(backgroundTask, options);
      this.isRunning = true;
      console.log('✅ Servizio GPS in background avviato con successo.');
    } catch (err) {
      console.error('❌ Errore durante l\'avvio del servizio GPS:', err);
    }
  }

  /**
   * Stops the background service and notification
   */
  public static async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    try {
      await BackgroundJob.stop();
      this.isRunning = false;
      console.log('🛑 Servizio GPS in background arrestato.');
    } catch (err) {
      console.error('❌ Errore durante l\'arresto del servizio GPS:', err);
    }
  }

  /**
   * Retrieves pending offline location updates list
   */
  public static async getOfflineLogs(): Promise<LocationUpdate[]> {
    return OfflineQueue.getQueue();
  }

  /**
   * Clears any local cached coordinates
   */
  public static async clearOfflineLogs(): Promise<void> {
    await OfflineQueue.clear();
  }
}
