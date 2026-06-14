export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  locale: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  privacyConsent: boolean;
  createdAt: string;
}

export interface MedicalProfile {
  blood_type?: string;
  allergies: string[];
  conditions: string[];
  medications: string[];
}

export interface UserStats {
  totalHikes: number;
  totalDistanceKm: number;
  totalElevationGainM: number;
  totalDurationHours: number;
  trailsCompleted: number;
  badgesEarned: number;
  stampsCollected: number;
}

export interface EmergencyContact {
  name: string;
  phone: string;
}
