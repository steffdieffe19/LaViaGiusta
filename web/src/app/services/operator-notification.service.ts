import { Injectable, inject, effect, signal, OnDestroy } from '@angular/core';
import { AuthService } from './auth.service';
import { SessionsService, HikerSession } from './sessions.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class OperatorNotificationService implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly sessionsService = inject(SessionsService);

  public readonly activeToasts = signal<HikerSession[]>([]);

  private eventSource: EventSource | null = null;
  private reconnectTimeout: any = null;

  constructor() {
    // Reactive effect: open SSE connection ONLY IF role is 'operator'
    effect(() => {
      const user = this.authService.currentUser();
      const isOperator = user?.role === 'operator';
      if (isOperator) {
        console.log('🛡️ OperatorNotificationService: Operator logged in. Connecting stream...');
        this.connectStream();
      } else {
        console.log('🛡️ OperatorNotificationService: No operator session. Disconnecting stream...');
        this.disconnectStream();
        this.activeToasts.set([]);
      }
    });
  }

  private connectStream(): void {
    if (this.eventSource) {
      this.eventSource.close();
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    const token = localStorage.getItem('access_token') || '';
    if (!token) return;

    this.eventSource = new EventSource(`${environment.apiUrl}/admin/hikes/stream?token=${encodeURIComponent(token)}`);

    this.eventSource.onmessage = (event) => {
      try {
        const payload: HikerSession = JSON.parse(event.data);
        console.log('📡 Global Operator Notification update received:', payload);

        // Delegate updates to SessionsService to sync state across the app (like map)
        this.sessionsService.updateSession(payload);

        // Global Toast Trigger on red color / emergency status
        if (payload.status === 'emergency_triggered' || payload.color === 'red') {
          this.triggerEmergencyToast(payload);
        }
      } catch (err) {
        console.error('Error parsing global SSE event payload:', err);
      }
    };

    this.eventSource.onerror = (err) => {
      console.error('Global SSE EventSource error, attempting reconnect in 5s...', err);
      this.eventSource?.close();
      this.eventSource = null;

      this.reconnectTimeout = setTimeout(() => {
        this.connectStream();
      }, 5000);
    };
  }

  private disconnectStream(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('🔌 Global SSE stream disconnected.');
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private triggerEmergencyToast(session: HikerSession): void {
    // Avoid duplicate toast for the same active session
    const currentToasts = this.activeToasts();
    if (currentToasts.some(t => t.id === session.id)) {
      return;
    }

    this.activeToasts.set([...currentToasts, session]);
    this.playAlarmChime();

    // Auto-dismiss toast after 12 seconds
    setTimeout(() => {
      this.dismissToast(session.id);
    }, 12000);
  }

  public dismissToast(sessionId: string): void {
    this.activeToasts.set(this.activeToasts().filter(t => t.id !== sessionId));
  }

  /**
   * Play a synthesized emergency alert chime using Web Audio API
   */
  public playAlarmChime(): void {
    try {
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      const now = audioCtx.currentTime;

      const playTone = (time: number, freq: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.35, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

        osc.start(time);
        osc.stop(time + duration);
      };

      // Play chime alarm sequence (D5 -> A5)
      playTone(now, 587.33, 0.4);
      playTone(now + 0.22, 880.00, 0.6);
    } catch (err) {
      console.warn('Could not play synthesized audio alarm:', err);
    }
  }

  ngOnDestroy(): void {
    this.disconnectStream();
  }
}
