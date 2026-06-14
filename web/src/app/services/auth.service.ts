import { Injectable, signal } from '@angular/core';

export interface UserProfile {
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
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Reactively track logged-in user profile
  public readonly currentUser = signal<UserProfile | null>(null);

  constructor() {
    this.loadSession();
  }

  /**
   * Loads the current session from localStorage
   */
  public loadSession(): void {
    const token = localStorage.getItem('access_token');
    const profileStr = localStorage.getItem('user_profile');
    if (token && profileStr) {
      try {
        const profile = JSON.parse(profileStr);
        this.currentUser.set(profile);
      } catch (err) {
        this.clearSession();
      }
    } else {
      this.currentUser.set(null);
    }
  }

  /**
   * Returns true if user is logged in
   */
  public isLoggedIn(): boolean {
    return this.currentUser() !== null;
  }

  /**
   * Returns the role of the logged in user, or 'sconosciuto' if not logged in
   */
  public getRole(): string {
    return this.currentUser()?.role || 'sconosciuto';
  }

  /**
   * Returns true if user is a Tourist
   */
  public isTourist(): boolean {
    return this.currentUser()?.role === 'tourist';
  }

  /**
   * Returns true if user is an Operator
   */
  public isOperator(): boolean {
    return this.currentUser()?.role === 'operator';
  }

  /**
   * Clears tokens and profiles from localStorage
   */
  public clearSession(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_profile');
    this.currentUser.set(null);
  }
}
