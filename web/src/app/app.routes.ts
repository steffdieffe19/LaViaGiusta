import { inject } from '@angular/core';
import { Routes, CanActivateFn, Router } from '@angular/router';

// Standalone Components
import { LandingPageComponent } from './features/public/landing-page/landing-page.component';
import { TrailDetailComponent } from './features/trails/trail-detail/trail-detail.component';
import { TrailCatalogComponent } from './features/public/trail-catalog/trail-catalog.component';
import { CommunityFeedComponent } from './features/public/community-feed/community-feed.component';
import { ProfileComponent } from './features/user/profile/profile.component';
import { ActiveHikeComponent } from './features/user/active-hike/active-hike.component';
import { LiveMapComponent } from './components/live-map/live-map.component';
import { AuthComponent } from './features/public/auth/auth.component';
import { AuthService } from './services/auth.service';

// Functional guards for authentication and authorization checks
export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  // Synchronously reload the session status in case of direct URL navigation
  authService.loadSession();

  if (authService.isLoggedIn()) {
    return true;
  }

  console.warn('🛡️ Accesso negato (AuthGuard): Token di autenticazione mancante o non attivo per la rotta:', state.url);
  router.navigate(['/auth']);
  return false;
};

export const roleGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  // Synchronously reload the session status
  authService.loadSession();

  if (authService.isLoggedIn() && authService.getRole() === 'operator') {
    return true;
  }

  const currentRole = authService.getRole();
  console.warn(`🛡️ Accesso negato (RoleGuard): Ruolo non autorizzato. Richiesto: operator, Attuale: ${currentRole} per la rotta:`, state.url);
  router.navigate(['/auth']);
  return false;
};

export const routes: Routes = [
  // ── 1. Public & Community Area ──
  { path: '', component: LandingPageComponent },
  { path: 'auth', component: AuthComponent },
  { path: 'trails', component: TrailCatalogComponent },
  { path: 'trail-detail/:id', component: TrailDetailComponent },
  { path: 'community', component: CommunityFeedComponent },

  // ── 2. Private Hiker Area ──
  {
    path: 'user',
    canActivate: [authGuard],
    children: [
      { path: 'profile', component: ProfileComponent },
      { path: 'active-hike/:sessionId', component: ActiveHikeComponent },
      { path: 'dashboard', redirectTo: 'profile', pathMatch: 'full' },
      { path: '', redirectTo: 'profile', pathMatch: 'full' }
    ]
  },

  // ── 3. Administrative / Operator Area ──
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    children: [
      { path: 'live-map', component: LiveMapComponent },
      { path: '', redirectTo: 'live-map', pathMatch: 'full' }
    ]
  },

  // Fallbacks
  { path: '**', redirectTo: '' }
];
