import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../../services/auth.service';

interface AuthResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      email: string;
      fullName: string;
      role: 'tourist' | 'operator';
      phone?: string;
      medicalProfile?: {
        blood_type?: string;
        allergies?: string[];
        conditions?: string[];
        medications?: string[];
      };
    };
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    };
  };
}

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 text-slate-800 font-sans flex items-center justify-center p-4">
      <div class="bg-white rounded-3xl border border-slate-200 p-8 shadow-xl max-w-md w-full space-y-6">
        
        <!-- Header -->
        <div class="text-center space-y-2">
          <span class="text-4xl block">🏔️</span>
          <h2 class="text-2xl font-black text-slate-900 tracking-tight">
            {{ mode() === 'login' ? 'Accedi a LaViaGiusta' : 'Registrati come Turista' }}
          </h2>
          <p class="text-xs text-slate-500">
            {{ role() === 'operator' ? 'Accesso riservato alla Protezione Civile' : 'Esplora e cammina in Valle Castellana in sicurezza' }}
          </p>
        </div>

        <!-- Error Alert -->
        @if (error()) {
          <div class="bg-red-50 border border-red-200 text-red-700 text-xs p-4 rounded-xl font-medium leading-relaxed">
            ⚠️ {{ error() }}
          </div>
        }

        <!-- Auth Form -->
        <form (ngSubmit)="onSubmit()" class="space-y-4">
          
          <!-- Full Name (Only for Register) -->
          @if (mode() === 'register') {
            <div class="space-y-1">
              <label class="block text-2xs font-extrabold uppercase tracking-wider text-slate-400">Nome Completo</label>
              <input 
                type="text" 
                name="fullName" 
                [(ngModel)]="fullName"
                required
                placeholder="Mario Rossi"
                class="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-hidden"
              />
            </div>
          }

          <!-- Email -->
          <div class="space-y-1">
            <label class="block text-2xs font-extrabold uppercase tracking-wider text-slate-400">Email</label>
            <input 
              type="email" 
              name="email" 
              [(ngModel)]="email"
              required
              placeholder="escursionista@email.it"
              class="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-hidden"
            />
          </div>

          <!-- Phone (Only for Register) -->
          @if (mode() === 'register') {
            <div class="space-y-1">
              <label class="block text-2xs font-extrabold uppercase tracking-wider text-slate-400">Cellulare (per reperibilità)</label>
              <input 
                type="tel" 
                name="phone" 
                [(ngModel)]="phone"
                placeholder="+39 333 1234567"
                class="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-hidden"
              />
            </div>

            <!-- Optional Medical Profile Toggle -->
            <div class="pt-2 border-t border-slate-100">
              <button 
                type="button"
                (click)="showMedical.set(!showMedical())"
                class="w-full text-left flex items-center justify-between text-xs font-bold text-primary hover:underline"
              >
                <span>➕ Dati Medici Emergenza (Opzionale)</span>
                <span>{{ showMedical() ? '▲ Nascondi' : '▼ Espandi' }}</span>
              </button>

              @if (showMedical()) {
                <div class="mt-3 space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/50">
                  <p class="text-3xs text-slate-400 leading-tight">
                    Art. 9 GDPR: Queste informazioni vengono crittografate a riposo e usate esclusivamente dai soccorritori (Twilio SMS/TTS) in caso di mancato checkout.
                  </p>

                  <div class="grid grid-cols-2 gap-2">
                    <div class="space-y-1">
                      <label class="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Gruppo Sanguigno</label>
                      <input 
                        type="text" 
                        name="bloodType" 
                        [(ngModel)]="bloodType"
                        placeholder="0+, A-, ecc."
                        class="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs focus:border-primary focus:outline-hidden"
                      />
                    </div>
                    <div class="space-y-1">
                      <label class="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Allergie (virgole)</label>
                      <input 
                        type="text" 
                        name="allergies" 
                        [(ngModel)]="allergies"
                        placeholder="Polline, Noci"
                        class="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs focus:border-primary focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div class="space-y-1">
                    <label class="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Patologie preesistenti (virgole)</label>
                    <input 
                      type="text" 
                      name="conditions" 
                      [(ngModel)]="conditions"
                      placeholder="Asma, Diabete"
                      class="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs focus:border-primary focus:outline-hidden"
                    />
                  </div>

                  <div class="space-y-1">
                    <label class="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Farmaci salvavita (virgole)</label>
                    <input 
                      type="text" 
                      name="medications" 
                      [(ngModel)]="medications"
                      placeholder="Insulina, Inalatore"
                      class="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs focus:border-primary focus:outline-hidden"
                    />
                  </div>
                </div>
              }
            </div>
          }

          <!-- Password -->
          <div class="space-y-1">
            <div class="flex justify-between items-center">
              <label class="block text-2xs font-extrabold uppercase tracking-wider text-slate-400">Password</label>
            </div>
            <input 
              type="password" 
              name="password" 
              [(ngModel)]="password"
              required
              placeholder="••••••••"
              class="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-hidden"
            />
          </div>

          <!-- Submit Button -->
          <button 
            type="submit" 
            [disabled]="loading()"
            class="w-full py-3.5 bg-primary hover:bg-primary-light text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-primary/10 flex items-center justify-center gap-2 uppercase tracking-wider min-h-[44px] cursor-pointer"
          >
            @if (loading()) {
              <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              <span>Elaborazione in corso...</span>
            } @else {
              <span>{{ mode() === 'login' ? 'Accedi' : 'Completa Registrazione' }}</span>
            }
          </button>
        </form>

        <!-- Mode Toggle & Secondary CTAs -->
        <div class="space-y-3 pt-4 border-t border-slate-100 text-center text-xs">
          
          @if (mode() === 'login') {
            <p class="text-slate-500">
              Non hai un account? 
              <button 
                (click)="switchMode('register')" 
                class="text-primary font-bold hover:underline"
              >
                Registrati come Turista
              </button>
            </p>
            
            @if (role() === 'tourist') {
              <button 
                (click)="switchRole('operator')" 
                class="text-slate-500 font-bold hover:text-primary transition-colors block w-full text-center mt-2 border border-slate-200 py-2.5 rounded-xl hover:bg-slate-50 min-h-[44px]"
              >
                🔒 Accedi come Operatore PC
              </button>
            } @else {
              <button 
                (click)="switchRole('tourist')" 
                class="text-slate-500 font-bold hover:text-primary transition-colors block w-full text-center mt-2 border border-slate-200 py-2.5 rounded-xl hover:bg-slate-50 min-h-[44px]"
              >
                🥾 Torna all'Accesso Turisti
              </button>
            }
          } @else {
            <p class="text-slate-500">
              Hai già un account? 
              <button 
                (click)="switchMode('login')" 
                class="text-primary font-bold hover:underline"
              >
                Accedi
              </button>
            </p>
          }

          <a routerLink="/" class="text-slate-400 hover:text-slate-600 block pt-2 text-[10px] font-bold uppercase tracking-wider">
            🏠 Torna alla Home
          </a>
        </div>

      </div>
    </div>
  `,
})
export class AuthComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  // signals
  public readonly mode = signal<'login' | 'register'>('login');
  public readonly role = signal<'tourist' | 'operator'>('tourist');
  public readonly loading = signal<boolean>(false);
  public readonly error = signal<string | null>(null);
  public readonly showMedical = signal<boolean>(false);

  // form state (simple bindings)
  public email = '';
  public password = '';
  public fullName = '';
  public phone = '';
  public bloodType = '';
  public allergies = '';
  public conditions = '';
  public medications = '';

  private readonly BASE_URL = 'http://localhost:3000/api/v1/auth';

  ngOnInit(): void {
    // Parse query parameters
    this.route.queryParams.subscribe(params => {
      if (params['mode'] === 'register') {
        this.mode.set('register');
        this.role.set('tourist');
      } else {
        this.mode.set('login');
        if (params['role'] === 'operator') {
          this.role.set('operator');
        } else {
          this.role.set('tourist');
        }
      }
    });
  }

  public switchMode(newMode: 'login' | 'register'): void {
    this.error.set(null);
    this.mode.set(newMode);
    if (newMode === 'register') {
      this.role.set('tourist'); // Operators can't self-register in this dashboard MVP
    }
  }

  public switchRole(newRole: 'tourist' | 'operator'): void {
    this.error.set(null);
    this.role.set(newRole);
    this.mode.set('login'); // Safe fallback
  }

  public onSubmit(): void {
    this.error.set(null);
    this.loading.set(true);

    if (this.mode() === 'login') {
      this.handleLogin();
    } else {
      this.handleRegister();
    }
  }

  private handleLogin(): void {
    const payload = {
      email: this.email,
      password: this.password,
    };

    this.http.post<AuthResponse>(`${this.BASE_URL}/login`, payload)
      .pipe(
        catchError(err => {
          console.error('Login error:', err);
          const errMsg = err?.error?.error || 'Credenziali non valide o errore di rete.';
          this.error.set(errMsg);
          this.loading.set(false);
          return of(null);
        })
      )
      .subscribe(res => {
        if (res?.success && res.data) {
          this.saveSessionAndRedirect(res.data);
        } else {
          this.loading.set(false);
        }
      });
  }

  private handleRegister(): void {
    // Split and clean lists
    const cleanList = (str: string): string[] => {
      return str.split(',').map(s => s.trim()).filter(Boolean);
    };

    const medicalProfile = {
      blood_type: this.bloodType.trim() || undefined,
      allergies: this.allergies ? cleanList(this.allergies) : [],
      conditions: this.conditions ? cleanList(this.conditions) : [],
      medications: this.medications ? cleanList(this.medications) : [],
    };

    const payload = {
      email: this.email,
      password: this.password,
      fullName: this.fullName,
      phone: this.phone.trim() || undefined,
      medicalProfile: (this.bloodType || this.allergies || this.conditions || this.medications) ? medicalProfile : undefined,
    };

    this.http.post<AuthResponse>(`${this.BASE_URL}/register`, payload)
      .pipe(
        catchError(err => {
          console.error('Registration error:', err);
          const errMsg = err?.error?.error || 'Errore durante la registrazione. Riprova.';
          this.error.set(errMsg);
          this.loading.set(false);
          return of(null);
        })
      )
      .subscribe(res => {
        if (res?.success && res.data) {
          this.saveSessionAndRedirect(res.data);
        } else {
          this.loading.set(false);
        }
      });
  }

  private saveSessionAndRedirect(data: AuthResponse['data']): void {
    // Save tokens and profile in LocalStorage
    localStorage.setItem('access_token', data.tokens.accessToken);
    localStorage.setItem('refresh_token', data.tokens.refreshToken);
    localStorage.setItem('user_profile', JSON.stringify(data.user));

    this.authService.loadSession();

    this.loading.set(false);

    // Dynamic routing depending on role
    const role = data.user.role;
    if (role === 'operator') {
      console.log('🔓 Logged in as operator. Navigating to municipal live map.');
      this.router.navigate(['/admin/live-map']);
    } else {
      console.log('🔓 Logged in as tourist. Navigating to hiker profile.');
      this.router.navigate(['/user/profile']);
    }
  }
}
