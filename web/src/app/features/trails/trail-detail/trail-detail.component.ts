import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  OnInit,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { forkJoin, catchError, of } from 'rxjs';
import * as maplibregl from 'maplibre-gl';
import { Chart, registerables } from 'chart.js';
import { AuthService } from '../../../services/auth.service';
import { SessionsService } from '../../../services/sessions.service';
import { WeatherService, WeatherData } from '../../../services/weather.service';

Chart.register(...registerables);

// ── Minimal GeoJSON types (avoids @types/geojson dependency) ───────────────
type GeoJsonGeometry =
  | { type: 'LineString'; coordinates: number[][] }
  | { type: string; coordinates: unknown };
interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{ type: 'Feature'; geometry: GeoJsonGeometry; properties: Record<string, unknown> | null }>;
}

// ── API response shapes ─────────────────────────────────────────────────────

interface TrailDetail {
  id: string;
  code: string;
  name: string;
  description?: string;
  distanceMeters: number;
  elevationGain?: number;
  elevationLoss?: number;
  elevationMin?: number;
  elevationMax?: number;
  difficulty: 'T' | 'E' | 'EE' | 'EEA';
  avgDurationMinutes?: number;
  surfaceType?: string;
  isLoop?: boolean;
  startPoint?: { latitude: number; longitude: number };
  endPoint?: { latitude: number; longitude: number };
  pois?: Array<{
    id: string;
    name: string;
    description?: string;
    category: string;
    latitude: number;
    longitude: number;
    isDanger: boolean;
  }>;
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

// ── Difficulty label map ────────────────────────────────────────────────────

const DIFFICULTY_MAP: Record<string, string> = {
  T: 'Turistico',
  E: 'Escursionistico',
  EE: 'Per Esperti',
  EEA: 'Alpinistico',
};

// ── Component ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-trail-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 text-slate-800 font-sans pb-12">

      <!-- ── Loading ── -->
      @if (loading) {
        <div class="flex flex-col items-center justify-center min-h-screen gap-4">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p class="text-slate-500 text-sm font-medium animate-pulse">Caricamento sentiero in corso…</p>
        </div>
      }

      <!-- ── Error ── -->
      @else if (error) {
        <div class="max-w-2xl mx-auto mt-24 px-6">
          <div class="bg-red-50 border border-red-200 rounded-2xl p-8 text-center space-y-4 shadow-sm">
            <span class="text-4xl block">⚠️</span>
            <h2 class="text-xl font-extrabold text-red-800">Sentiero non trovato</h2>
            <p class="text-sm text-red-600 leading-relaxed">{{ error }}</p>
            <a routerLink="/trails"
               class="inline-block mt-2 px-5 py-2.5 bg-primary text-white font-bold rounded-xl text-sm transition-all hover:bg-primary-light">
               ← Torna al Catalogo
            </a>
          </div>
        </div>
      }

      <!-- ── Main content — shown only after data arrives ── -->
      @else if (trail) {

        <!-- Header / Breadcrumb -->
        <div class="bg-white border-b border-slate-200 py-6 px-4 md:px-8">
          <div class="max-w-7xl mx-auto flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div>
              <nav class="flex text-xs text-slate-500 mb-2 gap-1.5 items-center font-medium">
                <a routerLink="/trails" class="hover:text-primary transition-colors">Catalogo Sentieri</a>
                <span>/</span>
                <span class="text-slate-800 font-semibold">{{ trail.code }} — {{ trail.name }}</span>
              </nav>

              <div class="space-y-1">
                <h1 class="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex flex-wrap items-center gap-3">
                  {{ trail.name }}
                  <span class="text-sm font-bold px-2.5 py-1 rounded-full border"
                    [class]="difficultyBadgeClass">
                    {{ trail.difficulty }} — {{ difficultyLabel }}
                  </span>
                </h1>

                <!-- Rating summary in header -->
                <div class="flex items-center gap-2 mt-1 text-sm font-bold text-slate-700">
                  @if (trail.reviewsCount && trail.reviewsCount > 0) {
                    <div class="flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200/80 px-2.5 py-1 rounded-lg text-xs shadow-sm">
                      <span class="text-amber-500 text-sm">★</span>
                      <span>{{ trail.averageRating | number:'1.1-1' }}</span>
                      <span class="text-slate-400 font-medium font-sans">({{ trail.reviewsCount }} recensioni)</span>
                    </div>
                  } @else {
                    <div class="bg-slate-50 text-slate-400 border border-slate-200/60 px-2.5 py-1 rounded-lg text-xs">
                      <span>⭐ Nessuna recensione</span>
                    </div>
                  }
                </div>
              </div>

              @if (trail.surfaceType) {
                <p class="text-sm text-slate-500 mt-2 flex items-center gap-1.5">
                  🥾 {{ trail.surfaceType }}
                </p>
              }
            </div>

            <div class="flex gap-3 flex-wrap shrink-0">
              <button (click)="downloadGPX()"
                class="px-4 py-2.5 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 font-bold rounded-xl text-sm transition-all shadow-sm flex items-center gap-2 min-h-[44px] cursor-pointer">
                📥 Scarica GPX
              </button>
              <button (click)="openInMobileApp()"
                class="px-4 py-2.5 bg-primary hover:bg-primary-light text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-primary/10 flex items-center gap-2 min-h-[44px] cursor-pointer">
                📱 Attiva Watchdog
              </button>
            </div>
          </div>
        </div>

        <!-- Body grid -->
        <div class="max-w-7xl mx-auto px-4 md:px-8 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

          <!-- ── LEFT: Map + Chart + Description + Reviews ── -->
          <div class="lg:col-span-2 space-y-8">

            <!-- Map Card -->
            <div class="bg-white rounded-3xl border border-slate-150 shadow-md shadow-slate-100/50 overflow-hidden relative">
              <div #mapContainer class="w-full h-[460px]"></div>

              <!-- Style toggle -->
              <div class="absolute top-4 left-4 z-10">
                <button (click)="toggleMapStyle()"
                  class="px-3 py-1.5 bg-white text-slate-700 font-bold rounded-xl shadow-lg border border-slate-200 text-xs hover:bg-slate-50 transition-all flex items-center gap-1.5 cursor-pointer">
                  {{ isSatelliteMode ? '🗺️ Passa a Mappa' : '🛰️ Vista Satellite' }}
                </button>
              </div>

              <!-- Coordinate hint -->
              <div class="absolute bottom-4 left-4 z-10 bg-slate-900/75 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-[10px] font-medium">
                Tasto destro / due dita → inclina e ruota la mappa 3D
              </div>

              <!-- Coord count badge -->
              <div class="absolute top-4 right-14 z-10 bg-emerald-700/80 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide">
                {{ routeCoordinates.length | number }} punti GPS
              </div>
            </div>

            <!-- Elevation Chart -->
            <div class="bg-white rounded-3xl border border-slate-150 shadow-md shadow-slate-100/50 p-6">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
                  ⛰️ Profilo Altimetrico
                </h3>
                <div class="flex gap-3 text-xs text-slate-500 font-semibold">
                  <span>▼ Min: <span class="text-slate-800 font-bold">{{ trail.elevationMin ?? '—' }} m</span></span>
                  <span>▲ Max: <span class="text-slate-800 font-bold">{{ trail.elevationMax ?? '—' }} m</span></span>
                  <span>↑ Guadagno: <span class="text-emerald-700 font-bold">+{{ trail.elevationGain ?? '—' }} m</span></span>
                </div>
              </div>
              <div class="relative w-full h-[220px]">
                <canvas #chartCanvas></canvas>
              </div>
            </div>

            <!-- Description -->
            <div class="bg-white rounded-3xl border border-slate-150 shadow-md shadow-slate-100/50 p-6 md:p-8 space-y-6">
              <div>
                <h3 class="text-lg font-bold text-slate-900 mb-3">Descrizione del Percorso</h3>
                <p class="text-slate-650 leading-relaxed text-sm">
                  {{ trail.description || 'Nessuna descrizione disponibile.' }}
                </p>
              </div>
              <hr class="border-slate-100"/>
              <div>
                <h4 class="font-bold text-slate-900 text-sm uppercase tracking-wider mb-3">Consigli per la Sicurezza</h4>
                <ul class="list-disc pl-5 text-sm text-slate-650 space-y-1.5">
                  <li>Verifica sempre le previsioni meteo locali prima di partire.</li>
                  <li>Il sentiero può attraversare zone senza segnale — attiva il Watchdog offline prima dei boschi.</li>
                  <li>Equipaggiamento minimo: scarponcini, guscio antivento, almeno 1.5 L d'acqua.</li>
                  <li>In caso di emergenza, l'app LaViaGiusta allerta automaticamente il Comune di Valle Castellana.</li>
                </ul>
              </div>
            </div>

            <!-- Reviews and Rating Form -->
            <div class="bg-white rounded-3xl border border-slate-150 shadow-md shadow-slate-100/50 p-6 md:p-8 space-y-6">
              <h3 class="text-lg font-bold text-slate-900 mb-2 flex items-center justify-between">
                <span>💬 Recensioni Escursionisti</span>
                <span class="text-xs text-slate-400 font-normal font-sans">({{ trail.reviews?.length || 0 }} recensioni)</span>
              </h3>

              <!-- Write Review Form (If authenticated) -->
              @if (authService.isLoggedIn()) {
                <div class="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
                  <h4 class="text-sm font-bold text-slate-800">Lascia una recensione</h4>
                  
                  <div class="space-y-3">
                    <!-- Star Picker -->
                    <div>
                      <span class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Punteggio *</span>
                      <div class="flex items-center gap-1.5 text-2xl">
                        @for (star of [1, 2, 3, 4, 5]; track star) {
                          <span (click)="setRating(star)"
                                (mouseenter)="hoverStar(star)"
                                (mouseleave)="hoverStar(0)"
                                class="cursor-pointer transition-colors"
                                [ngClass]="star <= (hoveredRating || selectedRating) ? 'text-amber-500' : 'text-slate-200'">
                            ★
                          </span>
                        }
                      </div>
                    </div>

                    <!-- Comment textarea -->
                    <div>
                      <label for="reviewComment" class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">La tua esperienza *</label>
                      <textarea id="reviewComment" [(ngModel)]="reviewComment" rows="3" placeholder="Com'è lo stato del sentiero? È ben segnalato? Ci sono ostacoli o fonti d'acqua?"
                                class="w-full rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 p-3 text-xs transition-all placeholder:text-slate-400 resize-none font-sans"></textarea>
                    </div>

                    @if (reviewError) {
                      <p class="text-xs text-red-650 font-medium">⚠️ {{ reviewError }}</p>
                    }

                    <div class="flex items-center justify-end">
                      <button (click)="submitReview()" [disabled]="submittingReview || !selectedRating || !reviewComment.trim()"
                              class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-450 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-100 flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px]">
                        @if (submittingReview) {
                          <div class="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                          Invia...
                        } @else {
                          🚀 Invia Feedback
                        }
                      </button>
                    </div>
                  </div>
                </div>
              } @else {
                <div class="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center text-xs text-slate-500 font-sans">
                  🔑 <a routerLink="/auth" class="underline font-bold text-slate-700 hover:text-emerald-700">Accedi</a> per condividere la tua opinione su questo sentiero.
                </div>
              }

              <!-- Reviews List -->
              <div class="space-y-4">
                @for (rev of trail.reviews; track rev.id) {
                  <div class="bg-slate-50 border border-slate-100/50 rounded-2xl p-5 space-y-2">
                    <div class="flex items-start justify-between gap-4">
                      <div>
                        <span class="font-extrabold text-sm text-slate-800 block leading-tight">{{ rev.user.fullName }}</span>
                        <span class="text-[10px] text-slate-400 font-sans mt-1 block">{{ formatDate(rev.createdAt) }}</span>
                      </div>
                      <div class="flex items-center gap-0.5 text-sm text-amber-500 bg-white border border-slate-150 px-2 py-0.5 rounded-lg shadow-sm">
                        @for (i of [1,2,3,4,5]; track i) {
                          <span [class.opacity-30]="i > rev.rating">★</span>
                        }
                      </div>
                    </div>
                    <p class="text-xs text-slate-650 leading-relaxed font-sans font-normal">
                      {{ rev.comment }}
                    </p>
                  </div>
                } @empty {
                  <div class="text-center py-8 text-slate-400 text-xs italic font-sans border border-dashed border-slate-200 rounded-2xl">
                    Nessuna recensione presente per questo sentiero. Sii il primo a scriverne una!
                  </div>
                }
              </div>
            </div>

          </div>

          <!-- ── RIGHT: Sidebar ── -->
          <div class="space-y-6">

            <!-- Stats card -->
            <div class="bg-white rounded-3xl border border-slate-150 shadow-md shadow-slate-100/50 p-6 space-y-5">
              <h3 class="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">Dettagli Tecnici</h3>

              <div class="grid grid-cols-2 gap-y-5 gap-x-4">
                <!-- Distanza -->
                <div>
                  <span class="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">📏 Distanza</span>
                  <span class="text-xl font-extrabold text-slate-900">{{ (trail.distanceMeters / 1000).toFixed(1) }} km</span>
                </div>
                <!-- Dislivello -->
                <div>
                  <span class="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">📈 Dislivello</span>
                  <span class="text-xl font-extrabold text-slate-900 text-emerald-700">+{{ trail.elevationGain ?? '—' }} m</span>
                </div>
                <!-- Tempo -->
                <div>
                  <span class="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">⏱️ Durata Stimata</span>
                  <span class="text-xl font-extrabold text-slate-900">{{ estimatedHoursLabel }}</span>
                </div>
                <!-- Difficoltà -->
                <div>
                  <span class="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">🎯 Difficoltà CAI</span>
                  <span class="text-xl font-extrabold flex items-center gap-1.5" [class]="difficultyTextClass">
                    {{ trail.difficulty }}
                  </span>
                  <span class="text-xs text-slate-400 font-medium">{{ difficultyLabel }}</span>
                </div>
                <!-- Quota max -->
                <div>
                  <span class="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">🏔️ Quota Max</span>
                  <span class="text-xl font-extrabold text-slate-900">{{ trail.elevationMax ?? '—' }} m</span>
                </div>
                <!-- Quota min -->
                <div>
                  <span class="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">🏕️ Quota Min</span>
                  <span class="text-xl font-extrabold text-slate-900">{{ trail.elevationMin ?? '—' }} m</span>
                </div>
              </div>

              <div class="border-t border-slate-100 pt-4 flex justify-between items-center">
                <span class="text-slate-500 text-sm font-medium">Tipo di percorso</span>
                <span class="font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-xl text-xs">
                  {{ trail.isLoop ? '🔄 Anello' : '↔️ Andata e ritorno' }}
                </span>
              </div>
            </div>

            <!-- Watchdog CTA -->
            <div class="bg-gradient-to-br from-primary-dark to-primary rounded-3xl p-6 text-white shadow-lg space-y-4">
              <div class="flex items-center gap-3">
                <span class="text-2xl">🛡️</span>
                <div>
                  <h4 class="font-bold text-sm leading-tight">Watchdog di Sicurezza</h4>
                  <p class="text-[10px] text-emerald-300 font-bold uppercase tracking-wider mt-0.5">Valle Castellana SafeHike</p>
                </div>
              </div>
              <p class="text-xs text-emerald-100 leading-relaxed font-sans">
                Stai per percorrere questo sentiero? Attiva il sistema Watchdog. Il Comune monitorerà il tuo rientro e allerterà i soccorsi in caso di emergenza.
              </p>
              <button (click)="openInMobileApp()"
                class="w-full py-3 bg-accent hover:bg-accent/90 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer">
                📲 Avvia Tracciamento Mobile
              </button>
            </div>

            <!-- Weather Card -->
            <div (click)="!weatherLoading && weatherData && (isWeatherModalOpen = true)"
                 class="bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-3xl p-6 shadow-sm cursor-pointer hover:scale-[1.02] hover:shadow-lg transition-all duration-300 ring-1 ring-transparent hover:ring-blue-500/50">
              <h3 class="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
                <span>Condizioni Meteo</span>
                <span class="text-[10px] text-slate-400 font-normal font-sans uppercase tracking-wider">Tempo Reale</span>
              </h3>

              @if (weatherLoading) {
                <!-- Skeleton Loader -->
                <div class="animate-pulse space-y-4">
                  <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-slate-200 rounded-2xl"></div>
                    <div class="space-y-2 flex-1">
                      <div class="h-6 bg-slate-200 rounded-lg w-1/3"></div>
                      <div class="h-4 bg-slate-200 rounded-lg w-1/2"></div>
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-4 pt-2">
                    <div class="h-10 bg-slate-200 rounded-xl"></div>
                    <div class="h-10 bg-slate-200 rounded-xl"></div>
                  </div>
                  <div class="border-t border-slate-200/50 pt-4 flex gap-4">
                    <div class="h-14 bg-slate-200 rounded-xl flex-1"></div>
                    <div class="h-14 bg-slate-200 rounded-xl flex-1"></div>
                    <div class="h-14 bg-slate-200 rounded-xl flex-1"></div>
                    <div class="h-14 bg-slate-200 rounded-xl flex-1"></div>
                  </div>
                </div>
              } @else if (weatherError) {
                <div class="text-center py-6">
                  <span class="text-3xl block mb-2">⚠️</span>
                  <p class="text-sm text-slate-500 font-medium">{{ weatherError }}</p>
                </div>
              } @else if (weatherData) {
                <!-- Current conditions -->
                <div class="flex items-center gap-4 mb-4">
                  <!-- Weather icon -->
                  <div class="w-14 h-14 flex items-center justify-center bg-gradient-to-br from-sky-50 to-blue-50 rounded-2xl shadow-sm shrink-0">
                    @switch (getWeatherIconKey(weatherData.current.weatherCode)) {
                      @case ('clear') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="w-8 h-8 text-amber-500">
                          <circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>
                          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                          <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
                          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                        </svg>
                      }
                      @case ('partly-cloudy') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-8 h-8 text-slate-400">
                          <path d="M9 12a3 3 0 0 1 3-3 5 5 0 0 1 4.9 4H18a3 3 0 0 1 0 6H9a3 3 0 0 1 0-6z"/>
                        </svg>
                      }
                      @case ('cloudy') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-8 h-8 text-slate-400">
                          <path d="M17.5 19H9a7 7 0 0 1-1.95-13.73 6 6 0 0 1 11.9 1.23A5 5 0 0 1 17.5 19z"/>
                        </svg>
                      }
                      @case ('fog') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-8 h-8 text-slate-400">
                          <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="15" x2="21" y2="15"/>
                        </svg>
                      }
                      @case ('rain') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-8 h-8 text-blue-500">
                          <path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9"/>
                          <line x1="8" y1="19" x2="8" y2="21"/><line x1="12" y1="17" x2="12" y2="19"/><line x1="16" y1="19" x2="16" y2="21"/>
                        </svg>
                      }
                      @case ('snow') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-8 h-8 text-sky-400">
                          <line x1="12" y1="2" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                          <line x1="2" y1="12" x2="22" y2="12"/><line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/>
                        </svg>
                      }
                      @case ('storm') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-8 h-8 text-yellow-500">
                          <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/>
                          <polyline points="13 11 9 17 15 17 11 23"/>
                        </svg>
                      }
                      @default {
                        <span class="text-3xl">🌤️</span>
                      }
                    }
                  </div>
                  <div>
                    <div class="text-3xl font-black text-slate-900 leading-none">{{ weatherData.current.temperature }}°</div>
                    <div class="text-sm font-semibold text-slate-500 mt-1">{{ getWeatherLabel(weatherData.current.weatherCode) }}</div>
                    <div class="text-xs text-slate-400 mt-0.5 font-sans">Percepita: {{ weatherData.current.apparentTemperature }}°</div>
                  </div>
                </div>

                <!-- Stats grid -->
                <div class="grid grid-cols-2 gap-3 mb-4">
                  <div class="bg-slate-50 rounded-2xl p-3">
                    <span class="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-0.5">💨 Vento</span>
                    <span class="text-sm font-extrabold text-slate-800">{{ weatherData.current.windSpeed }} km/h</span>
                  </div>
                  <div class="bg-slate-50 rounded-2xl p-3">
                    <span class="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-0.5">💧 Pioggia</span>
                    <span class="text-sm font-extrabold text-slate-800">{{ weatherData.current.precipitation }} mm</span>
                  </div>
                </div>

                <!-- Hourly forecast -->
                @if (weatherData.hourly && weatherData.hourly.length > 0) {
                  <div class="border-t border-slate-100 pt-4">
                    <p class="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-3">Prossime ore</p>
                    <div class="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
                      @for (hour of weatherData.hourly; track hour.time) {
                        <div class="flex flex-col items-center gap-1 shrink-0 bg-slate-50 rounded-xl px-3 py-2 min-w-[58px]">
                          <span class="text-[10px] font-bold text-slate-500">{{ formatForecastHour(hour.time) }}</span>
                          <span class="text-sm font-extrabold text-slate-800">{{ hour.temperature }}°</span>
                          <span class="text-[10px] text-blue-500 font-bold">{{ hour.precipitationProbability }}%</span>
                        </div>
                      }
                    </div>
                  </div>
                }

                <!-- Hint to open modal -->
                <div class="mt-4 text-center text-[10px] text-slate-400 font-medium">
                  Tocca per le previsioni a 7 giorni →
                </div>
              }
            </div>

            <!-- POIs card -->
            @if (trail.pois && trail.pois.length > 0) {
              <div class="bg-white rounded-3xl border border-slate-150 shadow-md shadow-slate-100/50 p-6">
                <h3 class="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">
                  📍 Punti di Interesse ({{ trail.pois.length }})
                </h3>
                <ul class="space-y-3">
                  @for (poi of trail.pois; track poi.id) {
                    <li class="flex items-start gap-3 group">
                      <span class="text-lg shrink-0 mt-0.5">{{ poiIcon(poi.category) }}</span>
                      <div>
                        <p class="font-semibold text-sm text-slate-800 group-hover:text-primary transition-colors leading-tight">{{ poi.name }}</p>
                        <p class="text-xs text-slate-400 capitalize mt-0.5">{{ poi.category }}</p>
                        @if (poi.description && poi.description !== poi.name + ' waypoint.') {
                          <p class="text-xs text-slate-500 mt-1 leading-relaxed">{{ poi.description }}</p>
                        }
                      </div>
                      @if (poi.isDanger) {
                        <span class="ml-auto text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded shrink-0">⚠️</span>
                      }
                    </li>
                  }
                </ul>
              </div>
            }

          </div>
        </div>
      }

      <!-- ── Modal Previsioni 7 Giorni — Mobile-First (Fase 16.4) ── -->
      @if (isWeatherModalOpen && weatherData && trail) {
        <div class="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <!-- Card container: Mobile-first layout with flex-col and overflow control -->
          <div class="w-[92%] md:w-full max-w-2xl max-h-[90dvh] bg-white rounded-3xl flex flex-col shadow-2xl overflow-hidden">

            <!-- Fixed Header -->
            <div class="shrink-0 flex items-start justify-between p-4 md:p-6 border-b border-slate-100">
              <div>
                <h3 class="text-2xl font-black text-slate-800 tracking-tight">Previsioni Localizzate</h3>
                <p class="text-sm font-medium text-slate-500 mt-1">{{ trail.name }} ({{ trail.code }})</p>
              </div>
              <button (click)="isWeatherModalOpen = false"
                class="shrink-0 ml-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer flex items-center justify-center font-bold">
                ✕
              </button>
            </div>

            <!-- Scrollable content area -->
            <div class="flex-1 overflow-y-auto p-4 md:p-6 space-y-2">
              @for (day of weatherData.daily; track day.time) {
                <div class="flex items-center justify-between p-3 md:p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl gap-2 md:gap-4 transition-colors">

                  <!-- Rigid date block -->
                  <div class="shrink-0 w-12 md:w-16">
                    <span class="block font-bold text-slate-800 text-sm leading-tight">{{ formatDailyDate(day.time).split(' ')[0] }}</span>
                    <span class="block text-[10px] md:text-xs text-slate-500 leading-tight">{{ formatDailyDate(day.time).split(' ').slice(1).join(' ') }}</span>
                  </div>

                  <!-- Icon and description block: stacks on mobile, row on desktop -->
                  <div class="flex flex-col md:flex-row md:items-center items-start gap-1 md:gap-3 flex-1 min-w-0">
                    <div class="w-7 h-7 flex items-center justify-center shrink-0">
                      @switch (getWeatherIconKey(day.weatherCode)) {
                        @case ('clear') {
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="w-6 h-6 text-amber-500">
                            <circle cx="12" cy="12" r="4"/>
                            <line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                            <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                          </svg>
                        }
                        @case ('partly-cloudy') {
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6 text-slate-400">
                            <path d="M9 12a3 3 0 0 1 3-3 5 5 0 0 1 4.9 4H18a3 3 0 0 1 0 6H9a3 3 0 0 1 0-6z"/>
                          </svg>
                        }
                        @case ('cloudy') {
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6 text-slate-400">
                            <path d="M17.5 19H9a7 7 0 0 1-1.95-13.73 6 6 0 0 1 11.9 1.23A5 5 0 0 1 17.5 19z"/>
                          </svg>
                        }
                        @case ('fog') {
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6 text-slate-400">
                            <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="15" x2="21" y2="15"/>
                          </svg>
                        }
                        @case ('rain') {
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6 text-blue-500">
                            <path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9"/>
                            <line x1="8" y1="19" x2="8" y2="21"/><line x1="12" y1="17" x2="12" y2="19"/><line x1="16" y1="19" x2="16" y2="21"/>
                          </svg>
                        }
                        @case ('snow') {
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6 text-sky-400">
                            <line x1="12" y1="2" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                            <line x1="2" y1="12" x2="22" y2="12"/><line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/>
                          </svg>
                        }
                        @case ('storm') {
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6 text-yellow-500">
                            <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/>
                            <polyline points="13 11 9 17 15 17 11 23"/>
                          </svg>
                        }
                        @default {
                          <span class="text-base">🌤️</span>
                        }
                      }
                    </div>
                    <span class="text-xs md:text-sm text-slate-600 font-medium leading-tight break-words whitespace-normal">
                      {{ getWeatherLabel(day.weatherCode) }}
                    </span>
                  </div>

                  <!-- Temperatures & rain: stacked on mobile, row on desktop -->
                  <div class="flex flex-col items-end shrink-0 gap-1 md:flex-row md:items-center md:gap-3">
                    <div class="flex items-baseline gap-1">
                      <span class="text-slate-400 text-xs md:text-sm">{{ day.temperatureMin | number:'1.0-0' }}°</span>
                      <span class="text-slate-200 text-xs mx-0.5">–</span>
                      <span class="text-slate-800 font-bold text-sm md:text-lg">{{ day.temperatureMax | number:'1.0-0' }}°</span>
                    </div>
                    <span class="px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm bg-blue-50 text-blue-600 rounded-full font-bold flex items-center gap-1">
                      💧 {{ day.precipitationProbabilityMax }}%
                    </span>
                  </div>

                </div>
              }
            </div>

            <!-- Fixed Footer -->
            <div class="shrink-0 p-4 md:p-6 border-t border-slate-100">
              <button (click)="isWeatherModalOpen = false"
                class="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer min-h-[48px]">
                Chiudi
              </button>
            </div>

          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
  `]
})
export class TrailDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  public readonly authService = inject(AuthService);
  private readonly sessionsService = inject(SessionsService);
  private readonly weatherService = inject(WeatherService);

  private map!: maplibregl.Map;
  private chart!: Chart;

  // ── public state ──────────────────────────────────────────────────────────
  public loading = true;
  public error: string | null = null;
  public trail: TrailDetail | null = null;
  public isSatelliteMode = false;

  // Weather state
  public weatherLoading = true;
  public weatherError: string | null = null;
  public weatherData: WeatherData | null = null;
  public isWeatherModalOpen = false;

  // Derived display fields
  public difficultyLabel = '';
  public difficultyBadgeClass = '';
  public difficultyTextClass = '';
  public estimatedHoursLabel = '';

  // Real data from GeoJSON
  public routeCoordinates: [number, number][] = [];
  private elevationProfile: { distance: number; elevation: number }[] = [];

  // Review Form fields
  public selectedRating = 0;
  public hoveredRating = 0;
  public reviewComment = '';
  public submittingReview = false;
  public reviewError: string | null = null;

  private readonly BASE_URL = 'http://localhost:3000/api/v1';

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'ID sentiero mancante nell\'URL.';
      this.loading = false;
      return;
    }
    this.fetchTrailData(id);
    this.fetchWeather(id);
  }

  ngAfterViewInit(): void {
    // ViewChildren not yet available here when @if(trail) is false — handled via setTimeout after data
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.map?.remove();
  }

  // ── Data fetching ──────────────────────────────────────────────────────────

  private fetchTrailData(id: string): void {
    forkJoin({
      detail: this.http
        .get<{ success: boolean; data: TrailDetail }>(`${this.BASE_URL}/trails/${id}`)
        .pipe(catchError(err => { console.error('Detail fetch error:', err); return of(null); })),
      geojson: this.http
        .get<GeoJsonFeatureCollection>(`${this.BASE_URL}/trails/${id}/geojson`)
        .pipe(catchError(err => { console.error('GeoJSON fetch error:', err); return of(null); })),
    }).subscribe(({ detail, geojson }) => {

      if (!detail?.success || !detail.data) {
        this.error = `Sentiero non trovato (ID: ${id}). Assicurati che il backend sia attivo e che il seeding sia stato eseguito.`;
        this.loading = false;
        return;
      }

      this.trail = detail.data;
      this.computeDerivedFields();
      this.extractCoordinates(geojson);

      this.loading = false;

      // ⚠️  CRITICAL TIMING FIX:
      // The @if(trail) block in the template is false until this point, so
      // #mapContainer and #chartCanvas ViewChildren don't exist in the DOM yet.
      // We yield one microtask tick so Angular can re-evaluate the template,
      // create the DOM nodes, and update the ViewChild references — then we init.
      this.cdr.detectChanges();           // force @if(trail) to render NOW
      setTimeout(() => {
        this.initMap();
        this.initElevationChart();
      }, 0);
    });
  }

  private fetchWeather(id: string): void {
    this.weatherLoading = true;
    this.weatherError = null;
    this.weatherService.getTrailWeather(id).subscribe({
      next: (res) => {
        if (res?.success && res.data) {
          this.weatherData = res.data;
        } else {
          this.weatherError = 'Meteo non disponibile.';
        }
        this.weatherLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching weather data:', err);
        this.weatherError = 'Errore caricamento meteo.';
        this.weatherLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  public getWeatherLabel(code: number): string {
    switch (code) {
      case 0: return 'Sereno';
      case 1: return 'Prevalentemente sereno';
      case 2: return 'Parzialmente nuvoloso';
      case 3: return 'Coperto';
      case 45:
      case 48: return 'Nebbia';
      case 51:
      case 53:
      case 55: return 'Pioggerella';
      case 56:
      case 57: return 'Pioggerella gelida';
      case 61:
      case 63:
      case 65: return 'Pioggia';
      case 66:
      case 67: return 'Pioggia gelida';
      case 71:
      case 73:
      case 75: return 'Neve';
      case 77: return 'Neve granulosa';
      case 80:
      case 81:
      case 82: return 'Rovesci di pioggia';
      case 85:
      case 86: return 'Rovesci di neve';
      case 95: return 'Temporale';
      case 96:
      case 99: return 'Temporale con grandine';
      default: return 'Variabile';
    }
  }

  public formatForecastHour(timeStr: string): string {
    if (!timeStr) return '';
    if (timeStr.includes('T')) {
      return timeStr.split('T')[1] || '';
    }
    return timeStr;
  }

  public getWeatherIconKey(code: number): string {
    switch (code) {
      case 0:
      case 1:
        return 'clear';
      case 2:
        return 'partly-cloudy';
      case 3:
        return 'cloudy';
      case 45:
      case 48:
        return 'fog';
      case 51:
      case 53:
      case 55:
      case 56:
      case 57:
      case 61:
      case 63:
      case 65:
      case 66:
      case 67:
      case 80:
      case 81:
      case 82:
        return 'rain';
      case 71:
      case 73:
      case 75:
      case 77:
      case 85:
      case 86:
        return 'snow';
      case 95:
      case 96:
      case 99:
        return 'storm';
      default:
        return 'rain';
    }
  }

  public formatDailyDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const weekday = d.toLocaleDateString('it-IT', { weekday: 'short' });
    const day = d.toLocaleDateString('it-IT', { day: '2-digit' });
    const month = d.toLocaleDateString('it-IT', { month: 'short' });
    const formattedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    const formattedMonth = month.charAt(0).toUpperCase() + month.slice(1).replace('.', '');
    return `${formattedWeekday} ${day} ${formattedMonth}`;
  }

  // ── Derived fields ─────────────────────────────────────────────────────────

  private computeDerivedFields(): void {
    if (!this.trail) return;
    const d = this.trail.difficulty;

    this.difficultyLabel = DIFFICULTY_MAP[d] ?? 'Sconosciuto';

    const badgeClasses: Record<string, string> = {
      T: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      E: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      EE: 'bg-amber-50 text-amber-700 border-amber-200',
      EEA: 'bg-red-50 text-red-700 border-red-200',
    };
    const textClasses: Record<string, string> = {
      T: 'text-emerald-700',
      E: 'text-emerald-700',
      EE: 'text-amber-600',
      EEA: 'text-red-600',
    };
    this.difficultyBadgeClass = badgeClasses[d] ?? 'bg-slate-100 text-slate-600 border-slate-200';
    this.difficultyTextClass = textClasses[d] ?? 'text-slate-800';

    const totalMin = this.trail.avgDurationMinutes
      ?? Math.round((this.trail.distanceMeters / 1000) * 20 + ((this.trail.elevationGain ?? 0) / 100) * 15);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    this.estimatedHoursLabel = m > 0 ? `${h}h ${m}min` : `${h}h`;
  }

  // ── Coordinate extraction ──────────────────────────────────────────────────

  private extractCoordinates(geojson: GeoJsonFeatureCollection | null): void {
    if (geojson?.features?.length) {
      const feature = geojson.features[0];
      if (feature.geometry.type === 'LineString') {
        const rawCoords = feature.geometry.coordinates as number[][];

        // Extract [lon, lat] pairs
        this.routeCoordinates = rawCoords.map(c => [c[0], c[1]] as [number, number]);

        // Build elevation profile from Z values if the GeoJSON is 3D
        const hasZ = rawCoords[0]?.length >= 3;
        if (hasZ) {
          this.elevationProfile = this.buildProfileFromZ(rawCoords as [number, number, number][]);
        } else {
          this.elevationProfile = this.synthesizeProfile();
        }
        return;
      }
    }

    // Fallback: use start/end points stored in the trail detail object
    if (this.trail?.startPoint && this.trail.endPoint) {
      this.routeCoordinates = [
        [this.trail.startPoint.longitude, this.trail.startPoint.latitude],
        [this.trail.endPoint.longitude, this.trail.endPoint.latitude],
      ];
    }
    this.elevationProfile = this.synthesizeProfile();
  }

  /**
   * Builds a distance-vs-elevation profile using Haversine distances
   * from the 3D coordinates in the GeoJSON LineString.
   * Downsamples to max 200 points to keep the chart readable.
   */
  private buildProfileFromZ(coords: [number, number, number][]): { distance: number; elevation: number }[] {
    const SAMPLE_STEP = Math.max(1, Math.floor(coords.length / 200));
    const profile: { distance: number; elevation: number }[] = [];
    let cumDist = 0;

    for (let i = 0; i < coords.length; i++) {
      if (i > 0) {
        const prev = coords[i - 1]!;
        const curr = coords[i]!;
        cumDist += this.haversineM(prev[1], prev[0], curr[1], curr[0]);
      }
      if (i % SAMPLE_STEP === 0 || i === coords.length - 1) {
        profile.push({
          distance: Math.round(cumDist / 100) / 10, // km with 1 decimal
          elevation: Math.round(coords[i]![2]),
        });
      }
    }
    return profile;
  }

  /** Synthesizes a plausible elevation profile when Z-values are not in the GeoJSON */
  private synthesizeProfile(): { distance: number; elevation: number }[] {
    if (!this.trail) return [];
    const distKm = this.trail.distanceMeters / 1000;
    const minEl = this.trail.elevationMin ?? 400;
    const maxEl = (this.trail.elevationMin ?? 400) + (this.trail.elevationGain ?? 300);
    const isLoop = this.trail.isLoop;
    const STEPS = 20;
    const result: { distance: number; elevation: number }[] = [];

    for (let i = 0; i <= STEPS; i++) {
      const p = i / STEPS;
      const dist = Math.round(p * distKm * 10) / 10;
      let el: number;
      if (isLoop) {
        el = minEl + (maxEl - minEl) * Math.sin(p * Math.PI);
      } else {
        el = p <= 0.5
          ? minEl + (maxEl - minEl) * (p * 2)
          : maxEl - (maxEl - minEl) * ((p - 0.5) * 2);
      }
      result.push({ distance: dist, elevation: Math.round(el) });
    }
    return result;
  }

  private haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6_371_000;
    const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
    const dφ = (lat2 - lat1) * Math.PI / 180;
    const dλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ── Map ────────────────────────────────────────────────────────────────────

  private initMap(): void {
    if (!this.mapContainer?.nativeElement) {
      console.warn('mapContainer not in DOM yet — skipping map init');
      return;
    }

    const center: [number, number] = this.routeCoordinates.length
      ? this.routeCoordinates[Math.floor(this.routeCoordinates.length / 2)]
      : [13.51, 42.71];

    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center,
      zoom: 13,
      attributionControl: false,
    });

    this.map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    this.map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-right');

    this.map.on('load', () => {
      this.addTrailLayer();
      this.fitToBounds();
      this.addMarkers();
    });

    // Re-add layer after satellite/vector style swap
    this.map.on('style.load', () => this.addTrailLayer());
  }

  private addTrailLayer(): void {
    if (this.routeCoordinates.length < 2) return;

    // Remove stale source/layers if they exist after a style swap
    ['trail-line', 'trail-glow'].forEach(id => {
      if (this.map.getLayer(id)) this.map.removeLayer(id);
    });
    if (this.map.getSource('trail')) this.map.removeSource('trail');

    this.map.addSource('trail', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: this.routeCoordinates },
      },
    });

    // Glow layer below main line
    this.map.addLayer({
      id: 'trail-glow',
      type: 'line',
      source: 'trail',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#ff6b35', 'line-width': 14, 'line-opacity': 0.18 },
    });

    // Main trail line
    this.map.addLayer({
      id: 'trail-line',
      type: 'line',
      source: 'trail',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#ff6b35', 'line-width': 4, 'line-opacity': 0.95 },
    });
  }

  private fitToBounds(): void {
    if (this.routeCoordinates.length < 2) return;
    const bounds = new maplibregl.LngLatBounds();
    this.routeCoordinates.forEach(c => bounds.extend(c));
    this.map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 1400 });
  }

  private addMarkers(): void {
    if (this.routeCoordinates.length === 0) return;

    // Start marker
    new maplibregl.Marker({ color: '#16a34a' })
      .setLngLat(this.routeCoordinates[0])
      .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(`
        <div class="font-sans">
          <p class="font-bold text-xs text-emerald-700">🟢 Punto di Partenza</p>
          <p class="text-xs text-slate-500 mt-0.5">${this.trail?.name ?? ''}</p>
        </div>`))
      .addTo(this.map);

    // End marker (only if different from start — i.e. not a loop)
    const last = this.routeCoordinates[this.routeCoordinates.length - 1];
    const isLoop = this.trail?.isLoop;
    if (!isLoop) {
      new maplibregl.Marker({ color: '#dc2626' })
        .setLngLat(last)
        .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(`
          <div class="font-sans">
            <p class="font-bold text-xs text-red-700">🔴 Punto di Arrivo</p>
            <p class="text-xs text-slate-500 mt-0.5">${this.trail?.name ?? ''}</p>
          </div>`))
        .addTo(this.map);
    }

    // POI markers from database waypoints
    for (const poi of this.trail?.pois ?? []) {
      new maplibregl.Marker({
        color: poi.isDanger ? '#ef4444' : '#f59e0b',
        scale: 0.75,
      })
        .setLngLat([poi.longitude, poi.latitude])
        .setPopup(new maplibregl.Popup({ offset: 10 }).setHTML(`
          <div class="font-sans">
            <p class="font-bold text-xs">${this.poiIcon(poi.category)} ${poi.name}</p>
            <p class="text-xs text-slate-500 capitalize">${poi.category}</p>
          </div>`))
        .addTo(this.map);
    }
  }

  public toggleMapStyle(): void {
    this.isSatelliteMode = !this.isSatelliteMode;
    if (this.isSatelliteMode) {
      this.map.setStyle({
        version: 8,
        sources: {
          'esri-sat': {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: '© Esri World Imagery',
          },
        },
        layers: [{ id: 'satellite', type: 'raster', source: 'esri-sat', minzoom: 0, maxzoom: 20 }],
      });
    } else {
      this.map.setStyle('https://basemaps.cartocdn.com/gl/positron-gl-style/style.json');
    }
  }

  // ── Chart ──────────────────────────────────────────────────────────────────

  private initElevationChart(): void {
    if (!this.chartCanvas?.nativeElement) {
      console.warn('chartCanvas not in DOM yet — skipping chart init');
      return;
    }
    if (!this.elevationProfile.length) return;

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const labels = this.elevationProfile.map(p => `${p.distance} km`);
    const data = this.elevationProfile.map(p => p.elevation);

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, 200);
    grad.addColorStop(0, 'rgba(45, 106, 79, 0.45)');
    grad.addColorStop(1, 'rgba(45, 106, 79, 0.02)');

    this.chart = new Chart(this.chartCanvas.nativeElement, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Altitudine (m)',
          data,
          borderColor: '#2d6a4f',
          borderWidth: 2,
          fill: true,
          backgroundColor: grad,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: '#ff6b35',
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#ffffff',
            bodyColor: '#e2e8f0',
            borderColor: '#334155',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              title: items => `📍 ${items[0]?.label ?? ''}`,
              label: ctx => `  Quota: ${ctx.parsed.y} m`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              maxTicksLimit: 10,
              color: '#94a3b8',
              font: { size: 9 },
              maxRotation: 0,
            },
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: {
              color: '#94a3b8',
              font: { size: 9 },
              callback: v => `${v}m`,
            },
          },
        },
      },
    });
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  public downloadGPX(): void {
    if (!this.trail) return;
    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LaViaGiusta" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${this.trail.name}</name><desc>Esportato da LaViaGiusta — Valle Castellana</desc></metadata>
  <trk><name>${this.trail.name}</name><trkseg>`;

    this.routeCoordinates.forEach(([lon, lat]) => {
      gpx += `\n      <trkpt lat="${lat}" lon="${lon}"></trkpt>`;
    });
    gpx += `\n    </trkseg></trk>\n</gpx>`;

    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `${this.trail.code}-${this.trail.name}.gpx` });
    a.click();
    URL.revokeObjectURL(url);
  }

  public openInMobileApp(): void {
    if (!this.trail) return;

    // Ensure user is logged in
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/auth']);
      return;
    }

    const token = localStorage.getItem('access_token') || '';
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    // Step 1: Check-in to create a new hike session
    this.http.post<{ success: boolean; data: { id: string } }>(
      `${this.BASE_URL}/sessions/check-in`,
      { trailId: this.trail.id },
      { headers }
    )
      .pipe(
        catchError(err => {
          console.error('Check-in error:', err);
          const errMsg = err?.error?.error || 'Errore durante l\'avvio dell\'escursione. Riprova.';
          // Show a non-blocking inline feedback (no window.alert)
          this.reviewError = errMsg;
          return of(null);
        })
      )
      .subscribe(res => {
        if (res?.success && res.data?.id) {
          const sessionId = res.data.id;
          // Step 2: Navigate to the web-based watchdog simulator
          this.router.navigate(['/user/active-hike', sessionId]);
        }
      });
  }


  // ── Star Picker / Reviews ──────────────────────────────────────────────────

  public setRating(rating: number): void {
    this.selectedRating = rating;
  }

  public hoverStar(rating: number): void {
    this.hoveredRating = rating;
  }

  public submitReview(): void {
    if (!this.trail) return;
    if (!this.selectedRating || !this.reviewComment.trim()) {
      this.reviewError = 'Punteggio e commento sono obbligatori.';
      return;
    }

    this.submittingReview = true;
    this.reviewError = null;

    const token = localStorage.getItem('access_token') || '';
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    const body = {
      rating: this.selectedRating,
      comment: this.reviewComment
    };

    this.http.post<{ success: boolean; data: any }>(
      `${this.BASE_URL}/trails/${this.trail.id}/reviews`,
      body,
      { headers }
    )
      .pipe(
        catchError(err => {
          console.error('Error submitting review:', err);
          const errMsg = err?.error?.error || 'Errore durante l\'invio della recensione. Riprova.';
          this.reviewError = errMsg;
          this.submittingReview = false;
          return of(null);
        })
      )
      .subscribe(res => {
        if (res?.success) {
          // Reset local review form state
          this.selectedRating = 0;
          this.reviewComment = '';
          this.reviewError = null;

          // Re-fetch all data to refresh average ratings, totals and reviews list on screen
          this.fetchTrailData(this.trail!.id);
        }
        this.submittingReview = false;
      });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  public poiIcon(category: string): string {
    const m: Record<string, string> = {
      fontana: '💧', rifugio: '🏠', panorama: '🔭', pericolo: '⚠️',
      storico: '🏛️', sosta: '🪑', flora: '🌿', fauna: '🦌',
    };
    return m[category?.toLowerCase()] ?? '📍';
  }

  public formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
