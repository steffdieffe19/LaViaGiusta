// CAI difficulty scale
export const TRAIL_DIFFICULTIES = ['T', 'E', 'EE', 'EEA'] as const;

export const DIFFICULTY_LABELS: Record<string, string> = {
  T: 'Turistico',
  E: 'Escursionistico',
  EE: 'Escursionisti Esperti',
  EEA: 'Escursionisti Esperti con Attrezzatura',
};

export const DIFFICULTY_COLORS: Record<string, string> = {
  T: '#22C55E',   // Green
  E: '#3B82F6',   // Blue
  EE: '#F59E0B',  // Amber
  EEA: '#EF4444', // Red
};

export const SESSION_STATUS_LABELS: Record<string, string> = {
  checked_in: 'Check-in effettuato',
  active: 'In corso',
  watchdog_alert: 'Allarme attivo',
  emergency: 'Emergenza',
  completed: 'Completata',
  cancelled: 'Annullata',
  resolved: 'Risolta',
};

export const SESSION_STATUS_COLORS: Record<string, string> = {
  checked_in: '#3B82F6',
  active: '#22C55E',
  watchdog_alert: '#F59E0B',
  emergency: '#EF4444',
  completed: '#6B7280',
  cancelled: '#9CA3AF',
  resolved: '#8B5CF6',
};

export const TRAFFIC_LIGHT_COLORS = {
  green: '#22C55E',
  yellow: '#F59E0B',
  red: '#EF4444',
} as const;

// POI categories
export const POI_CATEGORIES = ['fontana', 'rifugio', 'panorama', 'pericolo', 'storico'] as const;

export const POI_ICONS: Record<string, string> = {
  fontana: '💧',
  rifugio: '🏠',
  panorama: '📸',
  pericolo: '⚠️',
  storico: '🏛️',
};

// Badge rarities
export const BADGE_RARITY_LABELS: Record<string, string> = {
  common: 'Comune',
  rare: 'Raro',
  epic: 'Epico',
  legendary: 'Leggendario',
};

export const BADGE_RARITY_COLORS: Record<string, string> = {
  common: '#9CA3AF',
  rare: '#3B82F6',
  epic: '#8B5CF6',
  legendary: '#F59E0B',
};
