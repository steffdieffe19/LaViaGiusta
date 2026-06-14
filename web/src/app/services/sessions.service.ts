import { inject, Injectable, OnDestroy, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of, tap } from 'rxjs';

export interface HikerSession {
  id: string;
  user_name: string;
  user_phone?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  medical_profile?: {
    blood_type?: string;
    allergies?: string[];
    conditions?: string[];
    medications?: string[];
  } | null;
  trail_name: string;
  status: string;
  color: 'green' | 'yellow' | 'red';
  last_known_location: {
    lat: number;
    lon: number;
  } | null;
  scheduled_checkout_time: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class SessionsService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/api/v1/admin';

  // Signals for reactive state management
  public readonly activeSessions = signal<HikerSession[]>([]);
  public readonly loading = signal<boolean>(false);
  public readonly error = signal<string | null>(null);

  private eventSource: EventSource | null = null;
  private reconnectTimeout: any = null;

  /**
   * Fetches active sessions from the backend
   */
  public fetchActiveSessions(): Observable<HikerSession[]> {
    this.loading.set(true);
    const token = localStorage.getItem('access_token') || '';
    const headers = { Authorization: `Bearer ${token}` };
    return this.http.get<{ success: boolean; data: HikerSession[] }>(`${this.apiUrl}/hikes/active`, { headers }).pipe(
      map(res => res.data),
      tap(sessions => {
        this.activeSessions.set(sessions);
        this.loading.set(false);
      }),
      catchError(err => {
        console.error('Error fetching active sessions:', err);
        this.error.set('Errore nel caricamento delle sessioni attive. Accesso negato.');
        this.loading.set(false);
        return of([]);
      })
    );
  }

  /**
   * Connects to the real-time SSE stream for active hikes
   */
  public connectStream(): void {
    if (this.eventSource) {
      this.eventSource.close();
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    const token = localStorage.getItem('access_token') || '';
    this.eventSource = new EventSource(`${this.apiUrl}/hikes/stream?token=${encodeURIComponent(token)}`);

    this.eventSource.onmessage = (event) => {
      try {
        const payload: HikerSession = JSON.parse(event.data);
        console.log('📡 Real-time update received:', payload);
        this.updateSession(payload);
      } catch (err) {
        console.error('Error parsing SSE event payload:', err);
      }
    };

    this.eventSource.onerror = (err) => {
      console.error('SSE EventSource error, attempting reconnect in 5s...', err);
      this.eventSource?.close();
      this.eventSource = null;

      this.reconnectTimeout = setTimeout(() => {
        this.connectStream();
      }, 5000);
    };
  }

  /**
   * Disconnects from the real-time SSE stream
   */
  public disconnectStream(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('🔌 Disconnected from SSE stream.');
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /**
   * Updates the internal activeSessions signal with the received payload
   */
  private updateSession(updatedSession: HikerSession): void {
    const current = this.activeSessions();
    const index = current.findIndex(s => s.id === updatedSession.id);

    if (['completed', 'cancelled', 'resolved'].includes(updatedSession.status)) {
      // Remove hiker if session is finished or cancelled
      this.activeSessions.set(current.filter(s => s.id !== updatedSession.id));
    } else {
      if (index > -1) {
        // Update existing hiker
        const newSessions = [...current];
        newSessions[index] = updatedSession;
        this.activeSessions.set(newSessions);
      } else {
        // Insert new hiker
        this.activeSessions.set([...current, updatedSession]);
      }
    }
  }

  /**
   * Resolves an emergency/alert session via the operator endpoint
   */
  public resolveSession(sessionId: string, notes?: string): Observable<{ success: boolean; data: any }> {
    const token = localStorage.getItem('access_token') || '';
    const headers = { Authorization: `Bearer ${token}` };
    return this.http.post<{ success: boolean; data: any }>(
      `${this.apiUrl}/hikes/${sessionId}/resolve`,
      { notes },
      { headers }
    ).pipe(
      tap(() => {
        // Optimistically remove the session from active sessions
        this.activeSessions.set(this.activeSessions().filter(s => s.id !== sessionId));
      })
    );
  }

  ngOnDestroy(): void {
    this.disconnectStream();
  }
}
