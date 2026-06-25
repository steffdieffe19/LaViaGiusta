// CAI difficulty scale
export const TRAIL_DIFFICULTIES = ['T', 'E', 'EE', 'EEA'] as const;
export type TrailDifficulty = typeof TRAIL_DIFFICULTIES[number];

// Session statuses
export const SESSION_STATUSES = [
  'checked_in',
  'active',
  'watchdog_alert',
  'emergency',
  'completed',
  'cancelled',
  'resolved',
  'in_gestione',
] as const;
export type SessionStatus = typeof SESSION_STATUSES[number];

// Admin roles
export const ADMIN_ROLES = ['admin', 'operator', 'viewer'] as const;
export type AdminRole = typeof ADMIN_ROLES[number];

// Badge rarities
export const BADGE_RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;
export type BadgeRarity = typeof BADGE_RARITIES[number];

// Fitness levels
export const FITNESS_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type FitnessLevel = typeof FITNESS_LEVELS[number];

// SRID for GPS coordinates (WGS84)
export const SRID_WGS84 = 4326;

// Default geofence buffer in meters
export const DEFAULT_GEOFENCE_BUFFER_M = 200;
