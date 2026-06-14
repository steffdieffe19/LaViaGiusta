import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, effect, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as maplibregl from 'maplibre-gl';
import { SessionsService, HikerSession } from '../../services/sessions.service';

@Component({
  selector: 'app-live-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex h-full w-full bg-darkbg text-gray-100 font-sans overflow-hidden">
      <!-- Left Sidebar: Active Hikers List -->
      <div class="w-80 bg-darkbg-card border-r border-darkbg-border flex flex-col z-10">
        <div class="p-4 border-b border-darkbg-border flex items-center justify-between">
          <h3 class="text-sm font-bold text-white uppercase tracking-wider">Escursionisti in Cammino</h3>
          <span class="px-2 py-0.5 text-xs bg-gray-800 text-gray-300 rounded font-semibold">
            {{ activeSessions().length }}
          </span>
        </div>

        <div class="flex-1 overflow-y-auto p-3 space-y-3">
          @if (activeSessions().length === 0) {
            <div class="text-center text-gray-500 py-8 text-sm">
              Nessun escursionista attivo.
            </div>
          } @else {
            @for (session of activeSessions(); track session.id) {
              <div 
                (click)="focusOnHiker(session)"
                class="p-3 bg-darkbg rounded-xl border border-darkbg-border hover:border-primary-light hover:bg-gray-800 hover:bg-opacity-40 cursor-pointer transition-all flex flex-col gap-2 relative overflow-hidden group"
              >
                <!-- Status Stripe Indicator -->
                <div class="absolute left-0 top-0 bottom-0 w-1" [ngClass]="{
                  'bg-emerald-500': session.color === 'green',
                  'bg-amber-500 animate-pulse': session.color === 'yellow',
                  'bg-red-500 animate-ping': session.color === 'red'
                }"></div>

                <div class="flex justify-between items-start pl-2">
                  <div>
                    <h4 class="font-bold text-sm text-white group-hover:text-primary-light transition-colors">
                      {{ session.user_name }}
                    </h4>
                    <p class="text-xs text-gray-400 font-medium mt-0.5">🥾 {{ session.trail_name }}</p>
                  </div>
                  
                  <!-- Status Badge -->
                  <span class="text-2xs font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wide border" [ngClass]="{
                    'bg-emerald-950 bg-opacity-20 text-emerald-400 border-emerald-500 border-opacity-35': session.color === 'green',
                    'bg-amber-950 bg-opacity-20 text-amber-400 border-amber-500 border-opacity-35 animate-pulse': session.color === 'yellow',
                    'bg-red-950 bg-opacity-20 text-red-400 border-red-500 border-opacity-35': session.color === 'red'
                  }">
                    {{ session.status }}
                  </span>
                </div>

                <div class="pl-2 flex justify-between items-center text-2xs text-gray-500 mt-1">
                  <span>Checkout: {{ formatTime(session.scheduled_checkout_time) }}</span>
                </div>
              </div>
            }
          }
        </div>
      </div>

      <!-- Right Pane: Map Area and Overlay Panels -->
      <div class="flex-1 h-full relative">
        <div #mapContainer class="w-full h-full"></div>

        <!-- Floating Active Alerts Panel (Right side overlay) -->
        @if (alertSessions().length > 0) {
          <div class="absolute top-4 right-4 bottom-4 w-96 bg-gray-900 bg-opacity-95 backdrop-blur-md rounded-3xl border border-red-500/30 p-5 shadow-2xl flex flex-col z-20 overflow-hidden max-h-[90vh]">
            <div class="flex items-center justify-between pb-3 border-b border-red-500/20">
              <div class="flex items-center gap-2">
                <span class="w-3.5 h-3.5 bg-red-500 rounded-full animate-ping"></span>
                <h3 class="text-sm font-black uppercase text-red-400 tracking-wider">ALLERTE ATTIVE</h3>
              </div>
              <span class="px-2.5 py-0.5 text-xs bg-red-950/50 border border-red-500/40 text-red-300 rounded-lg font-bold">
                {{ alertSessions().length }}
              </span>
            </div>

            <div class="flex-1 overflow-y-auto mt-4 space-y-4 pr-1">
              @for (alert of alertSessions(); track alert.id) {
                <div 
                  class="bg-gray-800/80 border rounded-2xl p-4 space-y-3 transition-all hover:bg-gray-800"
                  [ngClass]="{
                    'border-red-500/40 shadow-lg shadow-red-500/5': alert.color === 'red',
                    'border-amber-500/40 shadow-lg shadow-amber-500/5': alert.color === 'yellow'
                  }"
                >
                  <!-- Header -->
                  <div class="flex justify-between items-start">
                    <div>
                      <h4 class="font-extrabold text-white text-base leading-tight">{{ alert.user_name }}</h4>
                      <p class="text-2xs text-gray-400 font-bold mt-1 uppercase tracking-wider">🥾 {{ alert.trail_name }}</p>
                    </div>
                    <span 
                      class="text-3xs font-black uppercase px-2 py-0.5 rounded-md border tracking-wider"
                      [ngClass]="{
                        'bg-red-950/40 text-red-400 border-red-500/30': alert.color === 'red',
                        'bg-amber-950/40 text-amber-400 border-amber-500/30': alert.color === 'yellow'
                      }"
                    >
                      {{ alert.status === 'emergency_triggered' || alert.color === 'red' ? 'SOS' : 'WATCHDOG' }}
                    </span>
                  </div>

                  <!-- Details -->
                  <div class="text-xs space-y-1.5 text-gray-300 bg-gray-950/30 p-3 rounded-xl border border-gray-850">
                    <div>
                      <span class="text-gray-500 font-medium">Contatto:</span> 
                      <a [href]="'tel:' + alert.user_phone" class="text-emerald-400 hover:underline ml-1 font-bold">{{ alert.user_phone || 'Non disponibile' }}</a>
                    </div>
                    @if (alert.last_known_location) {
                      <div>
                        <span class="text-gray-500 font-medium">Posizione:</span> 
                        <span class="font-mono ml-1 text-gray-400">{{ alert.last_known_location.lat | number:'1.5-5' }}, {{ alert.last_known_location.lon | number:'1.5-5' }}</span>
                        <button 
                          (click)="focusOnHiker(alert)" 
                          class="ml-2 text-2xs text-emerald-400 hover:underline font-bold uppercase tracking-wider"
                        >
                          Centra
                        </button>
                      </div>
                    } @else {
                      <div>
                        <span class="text-gray-500 font-medium">Posizione:</span> 
                        <span class="text-gray-500 ml-1 italic">Nessun segnale GPS</span>
                      </div>
                    }
                    <div>
                      <span class="text-gray-500 font-medium">Contatto Emergenza:</span> 
                      <span class="ml-1 text-white font-bold">{{ alert.emergency_contact_name || 'Non specificato' }}</span>
                      @if (alert.emergency_contact_phone) {
                        <br />
                        <span class="text-gray-500 font-medium">Tel Emergenza:</span>
                        <a [href]="'tel:' + alert.emergency_contact_phone" class="text-emerald-400 hover:underline ml-1 font-mono font-bold">{{ alert.emergency_contact_phone }}</a>
                      }
                    </div>
                  </div>

                  <!-- Medical Profile -->
                  @if (alert.medical_profile) {
                    <div class="text-xs bg-red-950/15 border border-red-500/15 rounded-xl p-3 space-y-1 text-red-200">
                      <div class="flex items-center gap-1.5 text-2xs font-extrabold uppercase tracking-wider text-red-400">
                        <span>📋 Dati Medici (GDPR)</span>
                      </div>
                      <div class="grid grid-cols-2 gap-1.5 mt-1 text-[11px]">
                        <div>
                          <span class="text-red-400/70 font-semibold">Gr. Sanguigno:</span> 
                          <span class="font-bold ml-1 text-white">{{ alert.medical_profile.blood_type || 'N/D' }}</span>
                        </div>
                        <div>
                          <span class="text-red-400/70 font-semibold">Allergie:</span> 
                          <span class="ml-1 font-medium text-white text-ellipsis overflow-hidden whitespace-nowrap" [title]="alert.medical_profile.allergies?.join(', ') || 'Nessuna'">
                            {{ alert.medical_profile.allergies?.join(', ') || 'Nessuna' }}
                          </span>
                        </div>
                        <div class="col-span-2">
                          <span class="text-red-400/70 font-semibold">Patologie:</span> 
                          <span class="ml-1 font-medium text-white">{{ alert.medical_profile.conditions?.join(', ') || 'Nessuna' }}</span>
                        </div>
                        <div class="col-span-2">
                          <span class="text-red-400/70 font-semibold">Farmaci:</span> 
                          <span class="ml-1 font-medium text-white">{{ alert.medical_profile.medications?.join(', ') || 'Nessuno' }}</span>
                        </div>
                      </div>
                    </div>
                  }

                  <!-- Resolve / Take-charge Button -->
                  <div class="pt-1 flex gap-2">
                    <button 
                      (click)="resolveAlert(alert)" 
                      class="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-2xs uppercase tracking-wider transition-all duration-150 active:scale-95 shadow-md shadow-red-600/10 cursor-pointer flex items-center justify-center gap-1.5 min-h-[40px]"
                    >
                      🚨 PRENDI IN CARICO / RISOLVI
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    @reference "tailwindcss";

    /* Custom styling for live map markers and popups */
    :host ::ng-deep {
      .maplibregl-popup-content {
        @apply bg-[#1e1e1e] border border-[#2c2c2c] rounded-lg text-[#f8f9fa] p-2.5 shadow-[0_4px_15px_rgba(0,0,0,0.4)];
        font-family: inherit;
      }
      
      .maplibregl-popup-anchor-top .maplibregl-popup-tip {
        border-bottom-color: #2c2c2c !important;
      }
      .maplibregl-popup-anchor-bottom .maplibregl-popup-tip {
        border-top-color: #2c2c2c !important;
      }
      .maplibregl-popup-anchor-left .maplibregl-popup-tip {
        border-right-color: #2c2c2c !important;
      }
      .maplibregl-popup-anchor-right .maplibregl-popup-tip {
        border-left-color: #2c2c2c !important;
      }

      .custom-marker {
        @apply w-[18px] h-[18px] rounded-full border-2 border-white shadow-[0_2px_6px_rgba(0,0,0,0.6)] cursor-pointer relative transition-transform duration-200;
        
        &:hover {
          @apply scale-125;
        }
        
        &.green {
          @apply bg-emerald-500;
        }
        
        &.yellow {
          @apply bg-amber-500 animate-pulse;
        }
        
        &.red {
          @apply bg-red-500 w-[22px] h-[22px];
          
          &::after {
            content: '';
            @apply absolute -top-2 -left-2 -right-2 -bottom-2 rounded-full border-[3px] border-red-500 animate-ping;
          }
        }
      }
    }
  `]
})
export class LiveMapComponent implements AfterViewInit, OnDestroy {
  private readonly sessionsService = inject(SessionsService);

  @ViewChild('mapContainer') mapContainer!: ElementRef;
  private map!: maplibregl.Map;
  
  // Cache map to track existing markers in memory
  private markers = new Map<string, maplibregl.Marker>();
  
  // Expose the store signal directly to template
  public activeSessions = this.sessionsService.activeSessions;

  // Filtered active alerts: red (emergency) or yellow (watchdog_alert)
  public alertSessions = computed(() => {
    return this.activeSessions().filter(s => s.color === 'red' || s.color === 'yellow');
  });

  private previousEmergencyIds = new Set<string>();

  constructor() {
    // Reactive Effect to synchronize MapLibre markers whenever activeSessions updates
    effect(() => {
      const sessions = this.activeSessions();
      if (!this.map) return; // Ensure map is initialized first

      const activeIds = new Set<string>();

      // Update or create markers
      sessions.forEach(session => {
        if (session.last_known_location && session.last_known_location.lat !== undefined && session.last_known_location.lon !== undefined) {
          activeIds.add(session.id);
          this.syncMarker(session);
        }
      });

      // Remove any markers that are no longer in the active sessions list
      this.markers.forEach((marker, id) => {
        if (!activeIds.has(id)) {
          marker.remove();
          this.markers.delete(id);
          console.log(`🗑️ Removed marker for session: ${id}`);
        }
      });

      // Track new emergencies and play alert chime
      const currentEmergencyIds = new Set(
        sessions.filter(s => s.color === 'red').map(s => s.id)
      );
      
      let hasNewEmergency = false;
      currentEmergencyIds.forEach(id => {
        if (!this.previousEmergencyIds.has(id)) {
          hasNewEmergency = true;
        }
      });

      if (hasNewEmergency) {
        this.playAlarmChime();
      }

      this.previousEmergencyIds = currentEmergencyIds;
    });
  }

  ngAfterViewInit(): void {
    // Instantiate MapLibre Map centered on Valle Castellana [longitude, latitude]
    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [13.49, 42.73],
      zoom: 12,
      attributionControl: false,
    });

    this.map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    
    // Trigger sessions data sync on map setup
    this.sessionsService.fetchActiveSessions().subscribe({
      next: () => {
        this.sessionsService.connectStream();
      }
    });
  }

  /**
   * Syncs a single marker: updates coordinates if exists, creates if new
   */
  private syncMarker(session: HikerSession): void {
    const coords: [number, number] = [session.last_known_location!.lon, session.last_known_location!.lat];
    const existingMarker = this.markers.get(session.id);

    if (existingMarker) {
      existingMarker.setLngLat(coords);
      return;
    }

    // 1. Create custom HTML marker element
    const el = document.createElement('div');
    el.className = `custom-marker ${session.color}`;
    
    // 2. Setup popup content
    const popupHtml = `
      <div style="font-family: inherit; font-size: 13px;">
        <h4 style="font-weight: 700; margin: 0 0 4px 0; color: #ffffff;">${session.user_name}</h4>
        <p style="margin: 2px 0; color: #a0a0a0;">🥾 <b>Sentiero:</b> ${session.trail_name}</p>
        <p style="margin: 2px 0; color: #a0a0a0;">⏰ <b>Rientro:</b> ${this.formatTime(session.scheduled_checkout_time)}</p>
        <span style="display: inline-block; margin-top: 6px; font-size: 10px; font-weight: 900; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); color: #f8f9fa;">
          Stato: ${session.status}
        </span>
      </div>
    `;

    const popup = new maplibregl.Popup({ offset: 12, closeButton: false })
      .setHTML(popupHtml);

    // 3. Create and add marker to MapLibre Canvas
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat(coords)
      .setPopup(popup)
      .addTo(this.map);

    this.markers.set(session.id, marker);
    console.log(`📍 Created marker for session: ${session.user_name} (${session.id})`);
  }

  /**
   * Centers the map view on a selected hiker
   */
  public focusOnHiker(session: HikerSession): void {
    if (!this.map || !session.last_known_location) return;
    
    this.map.flyTo({
      center: [session.last_known_location.lon, session.last_known_location.lat],
      zoom: 14,
      speed: 1.2,
      essential: true
    });

    // Automatically trigger the popup open
    const marker = this.markers.get(session.id);
    if (marker) {
      setTimeout(() => {
        marker.togglePopup();
      }, 500);
    }
  }

  /**
   * Play a synthesized emergency alert chime using Web Audio API
   */
  private playAlarmChime(): void {
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

  /**
   * Trigger the Prendi in Carico / Risolvi action
   */
  public resolveAlert(session: HikerSession): void {
    const notes = prompt(
      `Prendi in carico e risolvi l'emergenza per ${session.user_name}:\nInserisci note di risoluzione:`,
      'Allerta verificata e risolta telefonicamente / intervento soccorsi locale.'
    );
    if (notes === null) return; // user cancelled

    this.sessionsService.resolveSession(session.id, notes).subscribe({
      next: (res) => {
        console.log(`Emergency resolved for session ${session.id}`, res);
      },
      error: (err) => {
        alert(`Errore durante la risoluzione dell'emergenza: ${err?.error?.error || err.message}`);
      }
    });
  }

  /**
   * Helper formatting for timestamps
   */
  public formatTime(timeStr?: string | null): string {
    if (!timeStr) return '--:--';
    try {
      const date = new Date(timeStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  }

  ngOnDestroy(): void {
    // Prevent Memory Leaks: clean up map and markers
    this.markers.forEach(marker => marker.remove());
    this.markers.clear();
    
    // Disconnect the real-time SSE stream
    this.sessionsService.disconnectStream();
    
    if (this.map) {
      this.map.remove();
      console.log('🛑 LiveMapComponent destroyed and MapLibre canvas disposed.');
    }
  }
}
