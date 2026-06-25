import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface TrailItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  distanceMeters: number;
  elevationGain?: number;
  difficulty: 'T' | 'E' | 'EE' | 'EEA';
  avgDurationMinutes?: number;
  surfaceType?: string;
  isLoop?: boolean;
}

// Difficulty display config
const DIFFICULTY: Record<string, { label: string; badge: string }> = {
  T:   { label: 'Turistico',        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  E:   { label: 'Escursionistico',  badge: 'bg-sky-50 text-sky-700 border-sky-200'             },
  EE:  { label: 'Per Esperti',      badge: 'bg-amber-50 text-amber-700 border-amber-200'       },
  EEA: { label: 'Alpinistico',      badge: 'bg-red-50 text-red-700 border-red-200'             },
};

function diffBadge(d: string): string {
  return DIFFICULTY[d]?.badge ?? 'bg-slate-100 text-slate-600 border-slate-200';
}
function diffLabel(d: string): string {
  return DIFFICULTY[d]?.label ?? d;
}
function durationLabel(minutes?: number): string {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

@Component({
  selector: 'app-trail-catalog',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-slate-50 text-slate-800 font-sans">

      <!-- ── Top bar ── -->
      <div class="bg-white border-b border-slate-200 py-6 px-4 md:px-10">
        <div class="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <nav class="flex text-xs text-slate-400 gap-1.5 items-center font-medium mb-1">
              <a routerLink="/" class="hover:text-primary transition-colors">Home</a>
              <span>/</span>
              <span class="text-slate-600 font-semibold">Catalogo Sentieri</span>
            </nav>
            <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              🗺️ Esplora i Sentieri
            </h1>
            <p class="text-sm text-slate-500 mt-0.5">
              La rete sentieristica ufficiale e i percorsi storici di Valle Castellana — Parco Nazionale Gran Sasso
            </p>
          </div>
          <a routerLink="/"
             class="shrink-0 px-5 py-2.5 bg-white border border-slate-200 hover:border-slate-400 text-slate-700 font-bold rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 min-h-[44px]">
            🏠 Torna alla Home
          </a>
        </div>
      </div>

      <!-- ── Content ── -->
      <div class="max-w-7xl mx-auto px-4 md:px-10 py-10">

        <!-- Loading -->
        @if (loading) {
          <div class="flex flex-col items-center justify-center py-32 gap-4">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            <p class="text-slate-400 text-sm animate-pulse">Caricamento sentieri…</p>
          </div>
        }

        <!-- Error -->
        @else if (error) {
          <div class="max-w-2xl mx-auto bg-red-50 text-red-700 p-6 rounded-3xl border border-red-200 shadow-md shadow-red-100/50 space-y-3">
            <h4 class="font-extrabold text-sm flex items-center gap-2">⚠️ Errore di Connessione</h4>
            <p class="text-xs leading-relaxed">{{ error }}</p>
            <button (click)="reload()"
              class="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-all min-h-[44px]">
              🔄 Riprova
            </button>
          </div>
        }

        <!-- Empty -->
        @else if (trails.length === 0) {
          <div class="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-2xl mx-auto shadow-md shadow-slate-100/50 space-y-4">
            <span class="text-4xl">🥾</span>
            <h4 class="font-extrabold text-lg text-slate-900">Nessun sentiero disponibile</h4>
            <p class="text-sm text-slate-500 leading-relaxed">
              Il database è vuoto. Copia i file GPX in
              <code class="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-xs">backend/src/assets/gpx/</code>
              ed esegui lo script di seeding.
            </p>
            <div class="bg-slate-50 border border-slate-100 rounded-xl p-4 font-mono text-xs text-left text-slate-500 space-y-1">
              <p>$ cd backend</p>
              <p>$ npm run db:seed:trails</p>
            </div>
          </div>
        }

        <!-- Trail grid -->
        @else {
          <!-- Stats bar -->
          <div class="flex items-center justify-between mb-6">
            <p class="text-sm text-slate-500 font-medium">
              <span class="font-extrabold text-slate-900">{{ trails.length }}</span> sentieri disponibili
            </p>
            <div class="flex gap-2 text-xs font-semibold text-slate-500">
              <span class="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-100">
                {{ countByDiff('T') + countByDiff('E') }} Facili
              </span>
              @if (countByDiff('EE') > 0) {
                <span class="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-100">
                  {{ countByDiff('EE') }} Esperti
                </span>
              }
              @if (countByDiff('EEA') > 0) {
                <span class="bg-red-50 text-red-700 px-2.5 py-1 rounded-full border border-red-100">
                  {{ countByDiff('EEA') }} Alpinistici
                </span>
              }
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            @for (trail of trails; track trail.id) {

              <!--
                ┌──────────────────────────────────────────────────────┐
                │  CARD — INTERA SUPERFICIE CLICCABILE                 │
                │  routerLink sul div container + cursor-pointer       │
                └──────────────────────────────────────────────────────┘
              -->
              <div
                [routerLink]="['/trail-detail', trail.id]"
                class="group bg-white rounded-3xl border border-slate-150 shadow-md shadow-slate-100/50
                       hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 hover:-translate-y-1
                       cursor-pointer transition-all duration-300 ease-out
                       flex flex-col overflow-hidden"
              >
                <!-- Color header stripe based on difficulty -->
                <div class="h-1.5 w-full rounded-t-3xl"
                  [class]="trail.difficulty === 'T' || trail.difficulty === 'E'
                    ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                    : trail.difficulty === 'EE'
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                    : 'bg-gradient-to-r from-red-500 to-rose-600'">
                </div>

                <div class="p-6 flex flex-col flex-1 gap-5">
                  <!-- Header row -->
                  <div class="flex items-start justify-between gap-2">
                    <span class="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-lg uppercase tracking-widest">
                      CAI {{ trail.code }}
                    </span>
                    <span class="text-[10px] font-extrabold px-2.5 py-1 rounded-lg border tracking-wide"
                      [ngClass]="diffBadge(trail.difficulty)">
                      {{ trail.difficulty }} — {{ diffLabel(trail.difficulty) }}
                    </span>
                  </div>

                  <!-- Name & description -->
                  <div class="flex-1 space-y-2">
                    <h3 class="font-extrabold text-lg text-slate-900 group-hover:text-primary transition-colors leading-snug line-clamp-2">
                      {{ trail.name }}
                    </h3>
                    <p class="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {{ trail.description || 'Percorso segnalato CAI nel territorio di Valle Castellana.' }}
                    </p>
                  </div>

                  <!-- Metrics strip -->
                  <div class="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100">
                    <div class="text-center">
                      <span class="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">📏 km</span>
                      <span class="font-extrabold text-slate-900 text-base">{{ (trail.distanceMeters / 1000).toFixed(1) }}</span>
                    </div>
                    <div class="text-center border-x border-slate-100">
                      <span class="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">📈 D+</span>
                      <span class="font-extrabold text-emerald-700 text-base">+{{ trail.elevationGain ?? '—' }}m</span>
                    </div>
                    <div class="text-center">
                      <span class="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">⏱️ Durata</span>
                      <span class="font-extrabold text-slate-900 text-base">{{ durationLabel(trail.avgDurationMinutes) }}</span>
                    </div>
                  </div>

                  <!-- CTA row -->
                  <div class="flex items-center justify-between gap-3 mt-auto">
                    <div class="flex gap-1.5 flex-wrap">
                      @if (trail.isLoop) {
                        <span class="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full font-semibold">🔄 Anello</span>
                      }
                      @if (trail.surfaceType) {
                        <span class="text-[10px] bg-slate-50 text-slate-500 border border-slate-100 px-2 py-0.5 rounded-full font-semibold truncate max-w-[120px]">{{ trail.surfaceType }}</span>
                      }
                    </div>

                    <!-- Arrow indicator — purely decorative, card is fully clickable -->
                    <span class="text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200 text-base font-bold shrink-0">
                      →
                    </span>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class TrailCatalogComponent implements OnInit {
  private readonly http = inject(HttpClient);

  public trails: TrailItem[] = [];
  public loading = false;
  public error: string | null = null;

  // Expose pure functions to template
  public diffBadge  = diffBadge;
  public diffLabel  = diffLabel;
  public durationLabel = durationLabel;

  ngOnInit(): void { this.loadTrails(); }

  public reload(): void {
    this.error = null;
    this.loadTrails();
  }

  public countByDiff(d: string): number {
    return this.trails.filter(t => t.difficulty === d).length;
  }

  private loadTrails(): void {
    this.loading = true;
    this.http
      .get<{ success: boolean; data: TrailItem[] }>(`${environment.apiUrl}/trails`)
      .pipe(catchError(err => {
        console.error('Trails fetch error:', err);
        return of(null);
      }))
      .subscribe(res => {
        if (res?.success) {
          this.trails = res.data;
        } else {
          this.error = 'Impossibile connettersi al backend. Assicurati che sia avviato.';
        }
        this.loading = false;
      });
  }
}
