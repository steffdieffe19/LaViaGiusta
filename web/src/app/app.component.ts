import { Component, signal, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';
import { OperatorNotificationService } from './services/operator-notification.service';
import { SessionsService, HikerSession } from './services/sessions.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'laviagiusta-web';
  isSidebarOpen = signal(false);
  isNotificationPanelOpen = signal(false);
  public readonly baseUrl = environment.baseUrl;

  public readonly authService = inject(AuthService);
  public readonly operatorNotificationService = inject(OperatorNotificationService);
  public readonly sessionsService = inject(SessionsService);
  private readonly router = inject(Router);

  // Computed alert sessions for the off-canvas bell queue (red or yellow alerts)
  public readonly alertSessions = computed(() => {
    return this.sessionsService.activeSessions().filter(s => s.color === 'red' || s.color === 'yellow');
  });

  // Count of active unresolved alerts
  public readonly activeAlertsCount = computed(() => {
    return this.alertSessions().length;
  });

  logout(): void {
    this.authService.clearSession();
    this.router.navigate(['/']);
  }

  toggleSidebar(): void {
    this.isSidebarOpen.update(open => !open);
  }

  closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }

  openSidebar(): void {
    this.isSidebarOpen.set(true);
  }

  toggleNotificationPanel(): void {
    this.isNotificationPanelOpen.update(open => !open);
  }

  closeNotificationPanel(): void {
    this.isNotificationPanelOpen.set(false);
  }

  openLiveMapAndDismiss(toastId: string): void {
    this.operatorNotificationService.dismissToast(toastId);
    this.closeNotificationPanel();
    this.router.navigate(['/admin/live-map']);
  }

  takeCharge(sessionId: string): void {
    this.sessionsService.takeChargeSession(sessionId).subscribe({
      next: (res) => {
        console.log(`Alert taken in charge from Top Bar for session ${sessionId}`, res);
      },
      error: (err) => {
        alert(`Errore nel prendere in carico l'allarme: ${err?.error?.error || err.message}`);
      }
    });
  }

  resolveAlert(session: HikerSession): void {
    const notes = prompt(
      `Prendi in carico e risolvi l'emergenza per ${session.user_name}:\nInserisci note di risoluzione:`,
      'Allerta verificata e risolta telefonicamente / intervento soccorsi locale.'
    );
    if (notes === null) return; // user cancelled

    this.sessionsService.resolveSession(session.id, notes).subscribe({
      next: (res) => {
        console.log(`Emergency resolved from Top Bar for session ${session.id}`, res);
      },
      error: (err) => {
        alert(`Errore durante la risoluzione dell'emergenza: ${err?.error?.error || err.message}`);
      }
    });
  }

  formatTime(timeStr?: string | null): string {
    if (!timeStr) return '--:--';
    try {
      const date = new Date(timeStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  }

  getUserInitials(name?: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }
}
