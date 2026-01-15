/**
 * Mobile Sync Types
 *
 * Defines the payload structure for mobile health data sync.
 * Used by both iOS HealthKit and Android Health Connect bridges.
 */

/**
 * Heart rate sample from mobile health platform
 */
export interface MobileHeartRateSample {
  timestamp: string; // ISO 8601
  bpm: number;
}

/**
 * GPS route point from mobile health platform
 */
export interface MobileRoutePoint {
  timestamp: string; // ISO 8601
  latitude: number;
  longitude: number;
  altitude?: number;
}

/**
 * Standardized activity from mobile health platforms
 */
export interface MobileActivity {
  /** Unique identifier from the source platform */
  externalId?: string;

  /** Activity type name (e.g., "Running", "WeightTraining", "Cycling") */
  activityName: string;

  /** Activity start time (ISO 8601) */
  startTime: string;

  /** Activity end time (ISO 8601) */
  endTime: string;

  /** Duration in seconds */
  duration: number;

  /** Calories burned (optional) */
  calories?: number;

  /** Distance in meters (optional) */
  distance?: number;

  /** Heart rate samples (optional) */
  heartRateSamples?: MobileHeartRateSample[];

  /** GPS route points (optional) */
  route?: MobileRoutePoint[];

  /** Source platform indicator */
  source: 'healthkit' | 'health_connect';
}

/**
 * Mobile sync request payload
 */
export interface MobileSyncRequest {
  /** Array of activities to sync */
  activities: MobileActivity[];

  /** Device information */
  device?: {
    platform: 'ios' | 'android';
    osVersion?: string;
    appVersion?: string;
  };

  /** Sync metadata */
  sync?: {
    /** Last successful sync timestamp (ISO 8601) */
    lastSyncDate?: string;
    /** Unique sync batch ID */
    batchId?: string;
  };
}

/**
 * Mobile sync response payload
 */
export interface MobileSyncResponse {
  /** Whether the sync was successful */
  success: boolean;

  /** Number of activities processed */
  processedCount: number;

  /** Number of activities skipped (duplicates, etc.) */
  skippedCount: number;

  /** Pipeline execution IDs for tracing */
  executionIds: string[];

  /** Error message if sync failed */
  error?: string;

  /** Timestamp of this sync */
  syncedAt: string;
}

/**
 * Map mobile activity type to FitGlue activity type
 */
export function mapMobileActivityType(activityName: string): string {
  const lowerName = activityName.toLowerCase();

  const typeMap: Record<string, string> = {
    // Cardio
    'running': 'Run',
    'run': 'Run',
    'walking': 'Walk',
    'walk': 'Walk',
    'cycling': 'Ride',
    'biking': 'Ride',
    'bike': 'Ride',
    'ride': 'Ride',
    'swimming': 'Swim',
    'swim': 'Swim',

    // Strength
    'weighttraining': 'WeightTraining',
    'weight_training': 'WeightTraining',
    'weight training': 'WeightTraining',
    'strength': 'WeightTraining',
    'strength_training': 'WeightTraining',
    'strength training': 'WeightTraining',
    'gym': 'WeightTraining',

    // Cardio Equipment
    'elliptical': 'Elliptical',
    'rowing': 'Rowing',
    'stairclimber': 'StairStepper',
    'stair_climbing': 'StairStepper',

    // Other
    'yoga': 'Yoga',
    'pilates': 'Yoga',
    'hiit': 'HIIT',
    'crossfit': 'Crossfit',
    'hiking': 'Hike',
    'hike': 'Hike',

    // Default
    'workout': 'Workout',
    'exercise': 'Workout',
  };

  // Try exact match first
  if (typeMap[lowerName]) {
    return typeMap[lowerName];
  }

  // Try partial match
  for (const [key, value] of Object.entries(typeMap)) {
    if (lowerName.includes(key)) {
      return value;
    }
  }

  // Default to the original name with proper casing
  return activityName.charAt(0).toUpperCase() + activityName.slice(1);
}

/**
 * Get the source identifier for the mobile platform
 */
export function getMobileSourceId(source: 'healthkit' | 'health_connect'): string {
  return source === 'healthkit' ? 'SOURCE_APPLE_HEALTH' : 'SOURCE_HEALTH_CONNECT';
}
