import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  inject,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';

// ── Interfaces ──────────────────────────────────────────────────────────────

interface ActiveSession {
  id: string;
  trailId: string;
  trailName?: string;
  status: string;
  startedAt?: string;
  scheduledCheckoutTime?: string;
}

interface LocationUpdate {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  batteryLevel?: number;
  timestamp: string;
}

// ── Component ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-active-hike',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-slate-950 text-white font-sans flex flex-col">

      <!-- ── Loading ── -->
      @if (loading) {
        <div class="flex-1 flex flex-col items-center justify-center gap-4">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
          <p class="text-slate-400 text-sm font-medium animate-pulse">Inizializzazione Watchdog…</p>
        </div>
      }

      <!-- ── Error ── -->
      @else if (error) {
        <div class="flex-1 flex items-center justify-center p-6">
          <div class="bg-red-950/50 border border-red-500/30 rounded-3xl p-8 text-center space-y-4 max-w-md w-full">
            <span class="text-4xl block">⚠️</span>
            <h2 class="text-xl font-extrabold text-red-400">Errore Sessione</h2>
            <p class="text-sm text-red-300 leading-relaxed">{{ error }}</p>
            <a routerLink="/trails"
               class="inline-block mt-2 px-5 py-2.5 bg-slate-800 text-white font-bold rounded-xl text-sm transition-all hover:bg-slate-700">
               ← Torna ai Sentieri
            </a>
          </div>
        </div>
      }

      <!-- ── Active Hike UI ── -->
      @else if (session) {
        <!-- Top Bar -->
        <div class="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-3 h-3 rounded-full animate-pulse"
                 [class]="statusColor === 'green' ? 'bg-emerald-500' : statusColor === 'yellow' ? 'bg-amber-500' : 'bg-red-500'">
            </div>
            <div>
              <h1 class="text-sm font-extrabold tracking-tight">🛡️ Watchdog Attivo</h1>
              <p class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">{{ session.trailName || 'Sentiero' }}</p>
            </div>
          </div>
          <button (click)="completeHike()"
            class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all border border-slate-700 cursor-pointer">
            ✅ Termina
          </button>
        </div>

        <!-- Main Content (Mobile-First) -->
        <div class="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-8">

          <!-- Giant Timer -->
          <div class="text-center space-y-2">
            <p class="text-xs text-slate-500 font-bold uppercase tracking-widest">Tempo Trascorso</p>
            <div class="text-6xl md:text-8xl font-black tracking-tight tabular-nums text-white">
              {{ elapsedFormatted }}
            </div>
          </div>

          <!-- Status Indicator -->
          <div class="px-4 py-2 rounded-full border text-xs font-extrabold uppercase tracking-wider flex items-center gap-2"
               [class]="statusColor === 'green'
                 ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30'
                 : statusColor === 'yellow'
                   ? 'bg-amber-950/40 text-amber-400 border-amber-500/30 animate-pulse'
                   : 'bg-red-950/40 text-red-400 border-red-500/30 animate-pulse'">
            <span class="w-2 h-2 rounded-full"
                  [class]="statusColor === 'green' ? 'bg-emerald-500' : statusColor === 'yellow' ? 'bg-amber-500' : 'bg-red-500'"></span>
            {{ statusLabel }}
          </div>

          <!-- Location Info -->
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 w-full max-w-xs space-y-3">
            <div class="flex justify-between items-center">
              <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">📡 GPS</span>
              <span class="text-[10px] font-bold" [class]="gpsActive ? 'text-emerald-400' : 'text-red-400'">
                {{ gpsActive ? 'Connesso' : 'In attesa…' }}
              </span>
            </div>
            @if (lastLocation) {
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="bg-slate-950 rounded-xl p-2.5">
                  <span class="text-slate-500 text-[10px] font-bold block">LAT</span>
                  <span class="font-mono font-bold text-slate-200">{{ lastLocation.latitude | number:'1.5-5' }}</span>
                </div>
                <div class="bg-slate-950 rounded-xl p-2.5">
                  <span class="text-slate-500 text-[10px] font-bold block">LON</span>
                  <span class="font-mono font-bold text-slate-200">{{ lastLocation.longitude | number:'1.5-5' }}</span>
                </div>
              </div>
            }
          </div>

          <!-- SOS Button -->
          <button (click)="triggerSOS()"
            class="w-40 h-40 md:w-48 md:h-48 rounded-full bg-red-600 hover:bg-red-700 active:scale-95
                   shadow-xl shadow-red-600/30 border-4 border-red-500/50
                   flex flex-col items-center justify-center gap-1
                   transition-all duration-150 cursor-pointer">
            <span class="text-4xl md:text-5xl">🆘</span>
            <span class="text-sm md:text-base font-black uppercase tracking-wider">SOS</span>
          </button>
          <p class="text-[10px] text-slate-600 font-medium text-center max-w-[200px]">
            Premi il pulsante rosso per inviare un'emergenza immediata al Centro Operativo
          </p>
        </div>
      }

      <!-- ── Immobility Alert Modal (Custom — No window.confirm!) ── -->
      @if (showImmobilityModal) {
        <div class="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div class="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 md:p-8 max-w-sm w-full space-y-6 shadow-2xl">
            <!-- Header -->
            <div class="text-center space-y-2">
              <span class="text-5xl block animate-bounce">⚠️</span>
              <h3 class="text-xl font-black text-amber-400">Rilevata Immobilità</h3>
              <p class="text-sm text-slate-400 leading-relaxed">
                Nessun movimento rilevato da oltre 1 minuto.<br/>
                <span class="text-amber-400 font-bold">Stai bene?</span>
              </p>
            </div>

            <!-- Countdown -->
            <div class="text-center">
              <div class="text-4xl font-black text-amber-400 tabular-nums">
                {{ immobilityCountdown }}s
              </div>
              <p class="text-[10px] text-slate-500 font-semibold mt-1 uppercase tracking-wider">
                SOS automatico tra {{ immobilityCountdown }} secondi
              </p>
            </div>

            <!-- Buttons -->
            <div class="space-y-3">
              <button (click)="respondOk()"
                class="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-base
                       transition-all active:scale-95 shadow-lg shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-2">
                ✅ Tutto Bene
              </button>
              <button (click)="respondSOS()"
                class="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl text-base
                       transition-all active:scale-95 shadow-lg shadow-red-600/20 cursor-pointer flex items-center justify-center gap-2">
                🆘 Ho Bisogno di Aiuto
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ── SOS Sent Confirmation Modal ── -->
      @if (showSOSSentModal) {
        <div class="fixed inset-0 z-[200] bg-red-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div class="bg-slate-900 border border-red-500/30 rounded-3xl p-6 md:p-8 max-w-sm w-full space-y-6 shadow-2xl text-center">
            <span class="text-6xl block animate-pulse">🚨</span>
            <h3 class="text-2xl font-black text-red-400">SOS Inviato!</h3>
            <p class="text-sm text-slate-300 leading-relaxed">
              Il Centro Operativo di Valle Castellana è stato allertato.<br/>
              Rimani dove sei se possibile. I soccorsi sono in arrivo.
            </p>
            <button (click)="showSOSSentModal = false"
              class="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm transition-all cursor-pointer">
              OK, Ho Capito
            </button>
          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    :host { display: block; }
  `]
})
export class ActiveHikeComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  private readonly BASE_URL = environment.apiUrl;

  // ── State ──────────────────────────────────────────────────────────────────
  public loading = true;
  public error: string | null = null;
  public session: ActiveSession | null = null;

  // Timer
  public elapsedFormatted = '00:00:00';
  private startTime: Date | null = null;
  private elapsedInterval: any = null;

  // GPS / Geolocation
  public gpsActive = false;
  public lastLocation: { latitude: number; longitude: number } | null = null;
  private watchId: number | null = null;
  private locationInterval: any = null;

  // Immobility detection
  private lastMovedTime: number = Date.now();
  private lastMovedLocation: { lat: number; lon: number } | null = null;
  private immobilityCheckInterval: any = null;
  public showImmobilityModal = false;
  public immobilityCountdown = 30;
  private immobilityCountdownInterval: any = null;

  // SOS
  public showSOSSentModal = false;

  // Status
  public statusColor: 'green' | 'yellow' | 'red' = 'green';
  public statusLabel = 'In Cammino';

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const sessionId = this.route.snapshot.paramMap.get('sessionId');
    if (!sessionId) {
      this.error = 'ID sessione mancante.';
      this.loading = false;
      return;
    }
    this.initSession(sessionId);
  }

  ngOnDestroy(): void {
    this.clearAllTimers();
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
    }
  }

  // ── Session initialization ─────────────────────────────────────────────────

  private initSession(sessionId: string): void {
    const headers = this.getAuthHeaders();

    // Start the hike session on the backend
    this.http.post<{ success: boolean; data: any }>(
      `${this.BASE_URL}/sessions/${sessionId}/start`,
      {},
      { headers }
    ).pipe(
      catchError(err => {
        console.error('Error starting hike:', err);
        // Session might already be started — try fetching active session
        return this.http.get<{ success: boolean; data: any }>(
          `${this.BASE_URL}/sessions/active`,
          { headers }
        ).pipe(
          catchError(innerErr => {
            this.error = err?.error?.error || 'Impossibile avviare l\'escursione. Riprova.';
            this.loading = false;
            return of(null);
          })
        );
      })
    ).subscribe(res => {
      if (!res) return;

      const data = res.data;
      if (!data) {
        this.error = 'Nessuna sessione attiva trovata.';
        this.loading = false;
        return;
      }

      this.session = {
        id: data.id || sessionId,
        trailId: data.trailId,
        trailName: data.trailName || data.trail?.name || 'Sentiero',
        status: data.status,
        startedAt: data.startedAt || new Date().toISOString(),
        scheduledCheckoutTime: data.scheduledCheckoutTime,
      };

      this.startTime = new Date(this.session.startedAt || Date.now());
      this.loading = false;
      this.cdr.detectChanges();

      // Start all monitoring systems
      this.startElapsedTimer();
      this.startGeolocation();
      this.startImmobilityDetection();
    });
  }

  // ── Elapsed Timer ──────────────────────────────────────────────────────────

  private startElapsedTimer(): void {
    this.ngZone.runOutsideAngular(() => {
      this.elapsedInterval = setInterval(() => {
        if (!this.startTime) return;
        const elapsed = Date.now() - this.startTime.getTime();
        const h = Math.floor(elapsed / 3_600_000);
        const m = Math.floor((elapsed % 3_600_000) / 60_000);
        const s = Math.floor((elapsed % 60_000) / 1_000);
        const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        this.ngZone.run(() => {
          this.elapsedFormatted = formatted;
        });
      }, 1000);
    });
  }

  // ── Geolocation ────────────────────────────────────────────────────────────

  private startGeolocation(): void {
    if (!navigator.geolocation) {
      console.warn('Geolocation API not available');
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.ngZone.run(() => {
          this.gpsActive = true;
          this.lastLocation = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };

          // Update movement tracking for immobility detection
          const newLoc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          if (this.lastMovedLocation) {
            const dist = this.haversineM(
              this.lastMovedLocation.lat, this.lastMovedLocation.lon,
              newLoc.lat, newLoc.lon
            );
            if (dist > 15) {
              // Moved more than 15 meters — reset immobility timer
              this.lastMovedTime = Date.now();
              this.lastMovedLocation = newLoc;
            }
          } else {
            this.lastMovedLocation = newLoc;
            this.lastMovedTime = Date.now();
          }

          this.cdr.detectChanges();
        });
      },
      (err) => {
        console.warn('Geolocation error:', err);
        this.ngZone.run(() => {
          this.gpsActive = false;
          this.cdr.detectChanges();
        });
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    // Periodically send location to backend
    this.ngZone.runOutsideAngular(() => {
      this.locationInterval = setInterval(() => {
        this.sendLocationToBackend();
      }, 30_000); // Every 30 seconds
    });
  }

  private sendLocationToBackend(): void {
    if (!this.session || !this.lastLocation) return;

    const headers = this.getAuthHeaders();
    const body: LocationUpdate = {
      latitude: this.lastLocation.latitude,
      longitude: this.lastLocation.longitude,
      timestamp: new Date().toISOString(),
    };

    this.http.post(
      `${this.BASE_URL}/sessions/${this.session.id}/location`,
      body,
      { headers }
    ).pipe(catchError(err => {
      console.error('Location update error:', err);
      return of(null);
    })).subscribe();
  }

  // ── Immobility Detection ───────────────────────────────────────────────────

  private startImmobilityDetection(): void {
    this.ngZone.runOutsideAngular(() => {
      this.immobilityCheckInterval = setInterval(() => {
        const timeSinceMove = Date.now() - this.lastMovedTime;
        // 1 minute without movement of > 15m
        if (timeSinceMove > 60_000 && !this.showImmobilityModal) {
          this.ngZone.run(() => {
            this.showImmobilityAlert();
          });
        }
      }, 10_000); // Check every 10 seconds
    });
  }

  private showImmobilityAlert(): void {
    this.showImmobilityModal = true;
    this.statusColor = 'yellow';
    this.statusLabel = 'Immobilità Rilevata';
    this.immobilityCountdown = 30;
    this.cdr.detectChanges();

    // Start countdown — auto-SOS at 0
    this.immobilityCountdownInterval = setInterval(() => {
      this.immobilityCountdown--;
      if (this.immobilityCountdown <= 0) {
        clearInterval(this.immobilityCountdownInterval);
        this.immobilityCountdownInterval = null;
        this.showImmobilityModal = false;
        this.triggerSOS();
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  // ── User Actions ───────────────────────────────────────────────────────────

  public respondOk(): void {
    this.showImmobilityModal = false;
    this.statusColor = 'green';
    this.statusLabel = 'In Cammino';
    this.lastMovedTime = Date.now(); // Reset immobility timer
    if (this.immobilityCountdownInterval) {
      clearInterval(this.immobilityCountdownInterval);
      this.immobilityCountdownInterval = null;
    }

    // Notify backend
    if (this.session) {
      const headers = this.getAuthHeaders();
      this.http.post(
        `${this.BASE_URL}/sessions/${this.session.id}/respond-alert`,
        { response: 'ok' },
        { headers }
      ).pipe(catchError(err => {
        console.error('Respond-alert error:', err);
        return of(null);
      })).subscribe();
    }
  }

  public respondSOS(): void {
    this.showImmobilityModal = false;
    if (this.immobilityCountdownInterval) {
      clearInterval(this.immobilityCountdownInterval);
      this.immobilityCountdownInterval = null;
    }
    this.triggerSOS();
  }

  public triggerSOS(): void {
    if (!this.session) return;

    this.statusColor = 'red';
    this.statusLabel = 'EMERGENZA ATTIVA';

    const headers = this.getAuthHeaders();
    this.http.post(
      `${this.BASE_URL}/sessions/${this.session.id}/sos`,
      {},
      { headers }
    ).pipe(catchError(err => {
      console.error('SOS trigger error:', err);
      return of(null);
    })).subscribe(() => {
      this.showSOSSentModal = true;
      this.cdr.detectChanges();
    });
  }

  public completeHike(): void {
    if (!this.session) return;

    const headers = this.getAuthHeaders();
    this.http.post<{ success: boolean; data: any }>(
      `${this.BASE_URL}/sessions/${this.session.id}/complete`,
      {},
      { headers }
    ).pipe(catchError(err => {
      console.error('Complete hike error:', err);
      return of(null);
    })).subscribe(res => {
      this.clearAllTimers();
      this.router.navigate(['/user/profile']);
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  private haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6_371_000;
    const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
    const dφ = (lat2 - lat1) * Math.PI / 180;
    const dλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private clearAllTimers(): void {
    if (this.elapsedInterval) clearInterval(this.elapsedInterval);
    if (this.locationInterval) clearInterval(this.locationInterval);
    if (this.immobilityCheckInterval) clearInterval(this.immobilityCheckInterval);
    if (this.immobilityCountdownInterval) clearInterval(this.immobilityCountdownInterval);
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
  }
}
