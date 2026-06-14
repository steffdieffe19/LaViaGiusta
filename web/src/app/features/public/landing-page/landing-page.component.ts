import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      <!-- Global Navigation Header -->
      <header class="bg-white border-b border-slate-200 sticky top-0 z-50 px-4 md:px-8 py-4">
        <div class="max-w-7xl mx-auto flex items-center justify-between">
          <!-- Logo & Brand Name -->
          <div class="flex items-center gap-3">
            <span class="text-3xl">🏔️</span>
            <div>
              <h1 class="text-lg font-black tracking-tight text-slate-900 leading-none">LaViaGiusta</h1>
              <span class="text-[10px] text-primary-light font-bold uppercase tracking-wider">Valle Castellana</span>
            </div>
          </div>

          <!-- Desktop Navigation -->
          <nav class="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a routerLink="/trails" class="hover:text-primary transition-colors">Sentieri</a>
            <a routerLink="/community" class="hover:text-primary transition-colors">Community</a>
            @if (authService.isLoggedIn()) {
              <a 
                [routerLink]="authService.isOperator() ? '/admin/live-map' : '/user/dashboard'" 
                class="hover:text-primary transition-colors"
              >
                Il mio Profilo
              </a>
            }
          </nav>

          <!-- Action Buttons -->
          <div class="flex items-center gap-4">
            @if (!authService.isLoggedIn()) {
              <a 
                routerLink="/auth" 
                [queryParams]="{ mode: 'login', role: 'operator' }"
                class="text-xs font-bold text-slate-600 hover:text-primary hover:bg-slate-100 px-3.5 py-2.5 rounded-xl transition-all border border-transparent hover:border-slate-200"
              >
                🔒 Area Operatori
              </a>
              <a 
                routerLink="/auth" 
                [queryParams]="{ mode: 'login', role: 'tourist' }"
                class="text-xs font-bold text-slate-600 hover:text-primary hover:bg-slate-100 px-3.5 py-2.5 rounded-xl transition-all border border-transparent hover:border-slate-200"
              >
                Accedi
              </a>
            } @else {
              <!-- User Profile Name & Logout Button -->
              <span class="text-xs font-bold text-slate-500 hidden sm:inline">
                Ciao, {{ authService.currentUser()?.fullName }}
              </span>
              <button 
                (click)="logout()" 
                class="text-xs font-bold text-red-650 hover:bg-red-50 hover:text-red-700 px-3.5 py-2.5 rounded-xl transition-all border border-transparent hover:border-red-200 cursor-pointer"
              >
                🚪 Logout
              </button>
            }
            <a 
              routerLink="/trails" 
              class="hidden sm:inline-flex px-4 py-2.5 bg-primary hover:bg-primary-light text-white text-xs font-bold rounded-xl shadow-md shadow-primary/10 transition-all"
            >
              Esplora Sentieri
            </a>
          </div>
        </div>
      </header>

      <!-- Hero Banner Section -->
      <section class="relative bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 text-slate-800 py-20 px-4 md:px-8 overflow-hidden border-b border-slate-200/60">
        <!-- Abstract Topo Graphic Grid Overlay -->
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(27,67,50,0.04),transparent_50%)] pointer-events-none"></div>

        <div class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          <!-- Hero Text Content (7 Columns) -->
          <div class="lg:col-span-7 space-y-6 text-center lg:text-left">
            <span class="inline-flex px-3.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-xs font-bold uppercase tracking-wider">
              🛡️ Protezione Attiva & Mappe Offline
            </span>
            
            <h2 class="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight md:leading-none text-slate-900">
              Esplora Valle Castellana <br class="hidden md:block" />
              <span class="text-primary font-black">in totale sicurezza.</span>
            </h2>

            <p class="text-slate-600 text-sm md:text-base max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Il portale sentieristico ufficiale dotato di tecnologia Watchdog. Scegli il tuo percorso, scansiona il QR code alla partenza e cammina sapendo che non sarai mai solo.
            </p>

            <div class="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              @if (!authService.isLoggedIn()) {
                <a 
                  routerLink="/auth" 
                  [queryParams]="{ mode: 'register' }"
                  class="px-6 py-3.5 bg-primary hover:bg-primary-light text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 min-h-[44px]"
                >
                  🚀 Inizia ora (Registrati come Turista)
                </a>
                <a 
                  routerLink="/auth" 
                  [queryParams]="{ mode: 'login', role: 'operator' }"
                  class="px-6 py-3.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-sm min-h-[44px]"
                >
                  👤 Accesso Istituzionale (PC)
                </a>
              } @else if (authService.isTourist()) {
                <a 
                  routerLink="/user/dashboard"
                  class="px-8 py-3.5 bg-primary hover:bg-primary-light text-white font-black rounded-2xl text-sm transition-all shadow-lg shadow-primary/25 flex items-center justify-center gap-2 min-h-[48px]"
                >
                  🎒 Vai alla tua Dashboard
                </a>
              } @else if (authService.isOperator()) {
                <a 
                  routerLink="/admin/live-map"
                  class="px-8 py-3.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl text-sm transition-all shadow-lg shadow-red-600/25 flex items-center justify-center gap-2 min-h-[48px]"
                >
                  🚨 Apri Centrale Operativa
                </a>
              }
            </div>
          </div>

          <!-- Hero App Preview Panel (5 Columns) -->
          <div class="lg:col-span-5 flex justify-center">
            <div class="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl w-full max-w-sm space-y-6">
              <div class="flex items-center justify-between border-b border-slate-100 pb-4">
                <h4 class="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  📲 Scarica l'App Mobile
                </h4>
                <span class="text-2xs font-extrabold uppercase bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded border border-emerald-200">
                  Consigliata
                </span>
              </div>

              <!-- Mock Hiker App Badge / Flow -->
              <div class="bg-slate-700 rounded-2xl p-4 flex gap-4 items-center">
                <!-- Mock QR Code icon -->
                <div class="w-16 h-16 bg-white rounded-xl flex items-center justify-center p-1.5 shadow">
                  <div class="w-full h-full border-2 border-slate-900 flex flex-wrap justify-between p-0.5 relative">
                    <!-- QR code simulated blocks -->
                    <div class="w-3 h-3 bg-slate-900"></div>
                    <div class="w-3 h-3 bg-slate-900"></div>
                    <div class="w-3 h-3 bg-slate-900"></div>
                    <div class="w-2 h-2 bg-slate-900 absolute top-5 left-5"></div>
                  </div>
                </div>
                <div>
                  <h5 class="font-bold text-xs text-white">Scansiona ai Sentieri</h5>
                  <p class="text-[10px] text-gray-200 mt-1 leading-tight">
                    Inquadra il codice QR all'inizio del sentiero per attivare istantaneamente il Watchdog offline.
                  </p>
                </div>
              </div>

              <div class="space-y-2.5">
                <div class="flex justify-between items-center text-xs">
                  <span class="text-slate-500 font-medium">Tracciamento Offline</span>
                  <span class="text-emerald-600 font-extrabold">100% Attivo</span>
                </div>
                <div class="flex justify-between items-center text-xs">
                  <span class="text-slate-500 font-medium">Sincronizzazione Soccorsi</span>
                  <span class="text-emerald-600 font-extrabold">Twilio Integrato</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Safety Features Section (Come Funziona) -->
      <section class="py-20 px-4 md:px-8 max-w-7xl mx-auto w-full space-y-12">
        <div class="text-center space-y-3">
          <span class="text-xs text-primary-light font-extrabold uppercase tracking-wider">Tecnologia al Servizio della Vita</span>
          <h3 class="text-2xl md:text-3xl font-black text-slate-900">Come funziona LaViaGiusta</h3>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <!-- Step 1 Card -->
          <div class="bg-white rounded-3xl border border-slate-150 shadow-md shadow-slate-100/50 p-6 space-y-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
            <div class="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xl font-bold">
              🗺️
            </div>
            <h4 class="font-extrabold text-lg text-slate-900">1. Trova il tuo sentiero</h4>
            <p class="text-slate-500 text-sm leading-relaxed">
              Esplora il catalogo sentieri ufficiale di Valle Castellana, studia altimetrie e dislivelli e pianifica la tua camminata.
            </p>
          </div>

          <!-- Step 2 Card -->
          <div class="bg-white rounded-3xl border border-slate-150 shadow-md shadow-slate-100/50 p-6 space-y-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
            <div class="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center text-xl font-bold">
              📲
            </div>
            <h4 class="font-extrabold text-lg text-slate-900">2. Scansiona il QR all'inizio</h4>
            <p class="text-slate-500 text-sm leading-relaxed">
              Inquadra il codice QR sul tabellone fisico del sentiero. L'app sincronizza offline la traccia e fa partire il timer di sicurezza.
            </p>
          </div>

          <!-- Step 3 Card -->
          <div class="bg-white rounded-3xl border border-slate-150 shadow-md shadow-slate-100/50 p-6 space-y-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
            <div class="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-xl font-bold">
              🛡️
            </div>
            <h4 class="font-extrabold text-lg text-slate-900">3. Lasciati proteggere</h4>
            <p class="text-slate-500 text-sm leading-relaxed">
              Il Watchdog monitora il percorso. In caso di mancato rientro o allarme SOS, invia automaticamente le coordinate esatte ai soccorsi.
            </p>
          </div>
        </div>
      </section>

      <!-- Bottom Dual CTA Banner -->
      <section class="bg-white border-t border-slate-200 py-16 px-4 md:px-8">
        <div class="max-w-4xl mx-auto text-center space-y-8">
          <h3 class="text-2xl md:text-3xl font-extrabold text-slate-900">Pronto per camminare in sicurezza?</h3>
          
          @if (!authService.isLoggedIn()) {
            <p class="text-slate-500 max-w-xl mx-auto text-sm leading-relaxed">
              Registrati gratuitamente come Turista per sbloccare progressi, foto dei sentieri e badge digitali, oppure effettua l'accesso istituzionale come operatore del Centro Operativo.
            </p>
            
            <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a 
                routerLink="/auth" 
                [queryParams]="{ mode: 'register' }"
                class="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-primary-light text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-primary/10 flex items-center justify-center gap-2 min-h-[44px]"
              >
                🥾 Registrati come Turista
              </a>
              <a 
                routerLink="/auth" 
                [queryParams]="{ mode: 'login', role: 'operator' }"
                class="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-xs min-h-[44px]"
              >
                🔒 Accesso Istituzionale (PC)
              </a>
            </div>
          } @else if (authService.isTourist()) {
            <p class="text-slate-500 max-w-xl mx-auto text-sm leading-relaxed">
              Sei attualmente autenticato come Turista. Apri la tua area personale per gestire le escursioni e i badge.
            </p>
            <div class="flex justify-center">
              <a 
                routerLink="/user/dashboard"
                class="px-8 py-4 bg-primary hover:bg-primary-light text-white font-black rounded-2xl text-sm transition-all shadow-lg shadow-primary/25 flex items-center justify-center gap-2 min-h-[48px]"
              >
                🎒 Vai alla tua Dashboard
              </a>
            </div>
          } @else if (authService.isOperator()) {
            <p class="text-slate-500 max-w-xl mx-auto text-sm leading-relaxed">
              Sei autenticato come Operatore Centrale. Monitora la sicurezza sul territorio in tempo reale.
            </p>
            <div class="flex justify-center">
              <a 
                routerLink="/admin/live-map"
                class="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl text-sm transition-all shadow-lg shadow-red-600/25 flex items-center justify-center gap-2 min-h-[48px]"
              >
                🚨 Apri Centrale Operativa
              </a>
            </div>
          }
        </div>
      </section>

      <!-- Footer -->
      <footer class="mt-auto bg-slate-900 text-slate-400 py-12 px-4 md:px-8 border-t border-slate-800">
        <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div class="flex items-center gap-3">
            <span class="text-2xl">🏔️</span>
            <div>
              <h5 class="text-white font-extrabold text-sm leading-none">LaViaGiusta</h5>
              <span class="text-[9px] font-bold uppercase tracking-wider text-slate-500">Valle Castellana SafeHike</span>
            </div>
          </div>

          <div class="flex gap-8 text-xs font-semibold">
            <a routerLink="/trails" class="hover:text-white transition-colors">Catalogo Sentieri</a>
            <a routerLink="/community" class="hover:text-white transition-colors">Community</a>
            @if (authService.isLoggedIn()) {
              <a 
                [routerLink]="authService.isOperator() ? '/admin/live-map' : '/user/dashboard'" 
                class="hover:text-white transition-colors"
              >
                Il mio Profilo
              </a>
            }
          </div>

          <p class="text-2xs text-slate-500 text-center md:text-right">
            &copy; 2026 Comune di Valle Castellana. Progetto per la sicurezza escursionistica territoriale.
          </p>
        </div>
      </footer>
    </div>
  `
})
export class LandingPageComponent {
  public readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  public logout(): void {
    this.authService.clearSession();
    this.router.navigate(['/']);
  }
}
