/**
 * TypeScript Plugin Registry
 *
 * This module provides a centralized registry for all FitGlue plugins.
 * Enricher manifests are defined here to match the Go implementations.
 */

import {
  PluginManifest,
  PluginRegistryResponse,
  PluginType,
  ConfigFieldType
} from '../types/pb/plugin';
import { EnricherProviderType } from '../types/pb/user';

// Registry stores
const sources: Map<string, PluginManifest> = new Map();
const enrichers: Map<EnricherProviderType, PluginManifest> = new Map();
const destinations: Map<string, PluginManifest> = new Map();

/**
 * Register a source plugin manifest
 */
export function registerSource(manifest: PluginManifest): void {
  sources.set(manifest.id, manifest);
}

/**
 * Register an enricher plugin manifest
 */
export function registerEnricher(providerType: EnricherProviderType, manifest: PluginManifest): void {
  manifest.enricherProviderType = providerType;
  enrichers.set(providerType, manifest);
}

/**
 * Register a destination plugin manifest
 */
export function registerDestination(manifest: PluginManifest): void {
  destinations.set(manifest.id, manifest);
}

/**
 * Get the full plugin registry
 */
export function getRegistry(): PluginRegistryResponse {
  return {
    sources: Array.from(sources.values()),
    enrichers: Array.from(enrichers.values()),
    destinations: Array.from(destinations.values()),
  };
}

/**
 * Get a specific enricher manifest by provider type
 */
export function getEnricherManifest(providerType: EnricherProviderType): PluginManifest | undefined {
  return enrichers.get(providerType);
}

/**
 * Clear registry (for testing)
 */
export function clearRegistry(): void {
  sources.clear();
  enrichers.clear();
  destinations.clear();
}

// ============================================================================
// Register all known source manifests
// ============================================================================

registerSource({
  id: 'hevy',
  type: PluginType.PLUGIN_TYPE_SOURCE,
  name: 'Hevy',
  description: 'Import strength training workouts from Hevy',
  icon: '🏋️',
  enabled: true,
  requiredIntegrations: ['hevy'],
  configSchema: [],
});

registerSource({
  id: 'fitbit',
  type: PluginType.PLUGIN_TYPE_SOURCE,
  name: 'Fitbit',
  description: 'Import activities from Fitbit',
  icon: '⌚',
  enabled: true,
  requiredIntegrations: ['fitbit'],
  configSchema: [],
});

registerSource({
  id: 'mock',
  type: PluginType.PLUGIN_TYPE_SOURCE,
  name: 'Mock',
  description: 'Testing source for development',
  icon: '🧪',
  enabled: false,
  requiredIntegrations: [],
  configSchema: [],
});

// ============================================================================
// Register all known destination manifests
// ============================================================================

registerDestination({
  id: 'strava',
  type: PluginType.PLUGIN_TYPE_DESTINATION,
  name: 'Strava',
  description: 'Upload activities to Strava',
  icon: '🚴',
  enabled: true,
  requiredIntegrations: ['strava'],
  configSchema: [],
  destinationType: 1, // DestinationType.DESTINATION_STRAVA
});

// ============================================================================
// Register all known enricher manifests
// These match the Go plugin registrations in enricher_providers/
// ============================================================================

registerEnricher(EnricherProviderType.ENRICHER_PROVIDER_WORKOUT_SUMMARY, {
  id: 'workout-summary',
  type: PluginType.PLUGIN_TYPE_ENRICHER,
  name: 'Workout Summary',
  description: 'Generates a text summary of strength training exercises',
  icon: '📋',
  enabled: true,
  requiredIntegrations: [],
  configSchema: [
    {
      key: 'format',
      label: 'Summary Format',
      description: 'How sets should be displayed',
      fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_SELECT,
      required: false,
      defaultValue: 'detailed',
      options: [
        { value: 'compact', label: 'Compact (4×10×100kg)' },
        { value: 'detailed', label: 'Detailed (4 x 10 × 100.0kg)' },
        { value: 'verbose', label: 'Verbose (4 sets of 10 reps at 100.0 kilograms)' },
      ],
    },
    {
      key: 'show_stats',
      label: 'Show Stats',
      description: 'Include headline stats (total volume, reps, etc.)',
      fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_BOOLEAN,
      required: false,
      defaultValue: 'true',
      options: [],
    },
  ],
});

registerEnricher(EnricherProviderType.ENRICHER_PROVIDER_MUSCLE_HEATMAP, {
  id: 'muscle-heatmap',
  type: PluginType.PLUGIN_TYPE_ENRICHER,
  name: 'Muscle Heatmap',
  description: 'Generates an emoji-based heatmap showing muscle group volume',
  icon: '🔥',
  enabled: true,
  requiredIntegrations: [],
  configSchema: [
    {
      key: 'style',
      label: 'Display Style',
      description: 'How the heatmap should be rendered',
      fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_SELECT,
      required: false,
      defaultValue: 'emoji',
      options: [
        { value: 'emoji', label: 'Emoji Bars (🟪🟪🟪⬜⬜)' },
        { value: 'percentage', label: 'Percentage (Chest: 80%)' },
        { value: 'text', label: 'Text Only (High: Chest, Medium: Legs)' },
      ],
    },
    {
      key: 'bar_length',
      label: 'Bar Length',
      description: 'Number of squares in emoji bar',
      fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_NUMBER,
      required: false,
      defaultValue: '5',
      options: [],
      validation: { minValue: 3, maxValue: 10 },
    },
    {
      key: 'preset',
      label: 'Coefficient Preset',
      description: 'Muscle weighting preset',
      fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_SELECT,
      required: false,
      defaultValue: 'standard',
      options: [
        { value: 'standard', label: 'Standard (balanced)' },
        { value: 'powerlifting', label: 'Powerlifting (emphasize compounds)' },
        { value: 'bodybuilding', label: 'Bodybuilding (emphasize isolation)' },
      ],
    },
  ],
});

registerEnricher(EnricherProviderType.ENRICHER_PROVIDER_FITBIT_HEART_RATE, {
  id: 'fitbit-heart-rate',
  type: PluginType.PLUGIN_TYPE_ENRICHER,
  name: 'Fitbit Heart Rate',
  description: 'Adds heart rate data from Fitbit to your activity',
  icon: '❤️',
  enabled: true,
  requiredIntegrations: ['fitbit'],
  configSchema: [],
});

registerEnricher(EnricherProviderType.ENRICHER_PROVIDER_VIRTUAL_GPS, {
  id: 'virtual-gps',
  type: PluginType.PLUGIN_TYPE_ENRICHER,
  name: 'Virtual GPS',
  description: 'Adds GPS coordinates from a virtual route to indoor activities',
  icon: '🗺️',
  enabled: true,
  requiredIntegrations: [],
  configSchema: [
    {
      key: 'route',
      label: 'Route',
      description: 'Virtual route to use for GPS generation',
      fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_SELECT,
      required: false,
      defaultValue: 'london',
      options: [
        { value: 'london', label: 'London Hyde Park (~4km loop)' },
        { value: 'nyc', label: 'NYC Central Park (~10km loop)' },
      ],
    },
    {
      key: 'force',
      label: 'Force Override',
      description: 'Override existing GPS data if present',
      fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_BOOLEAN,
      required: false,
      defaultValue: 'false',
      options: [],
    },
  ],
});

registerEnricher(EnricherProviderType.ENRICHER_PROVIDER_SOURCE_LINK, {
  id: 'source-link',
  type: PluginType.PLUGIN_TYPE_ENRICHER,
  name: 'Source Link',
  description: 'Appends a link to the original activity in the description',
  icon: '🔗',
  enabled: true,
  requiredIntegrations: [],
  configSchema: [],
});

registerEnricher(EnricherProviderType.ENRICHER_PROVIDER_METADATA_PASSTHROUGH, {
  id: 'metadata-passthrough',
  type: PluginType.PLUGIN_TYPE_ENRICHER,
  name: 'Metadata Passthrough',
  description: 'Passes through metadata from the source activity',
  icon: '📦',
  enabled: true,
  requiredIntegrations: [],
  configSchema: [],
});

registerEnricher(EnricherProviderType.ENRICHER_PROVIDER_TYPE_MAPPER, {
  id: 'type-mapper',
  type: PluginType.PLUGIN_TYPE_ENRICHER,
  name: 'Type Mapper',
  description: 'Maps activity types from one type to another (e.g., Ride → Virtual Ride)',
  icon: '🏷️',
  enabled: true,
  requiredIntegrations: [],
  configSchema: [
    {
      key: 'type_mappings',
      label: 'Type Mappings',
      description: 'Map original activity types to desired types',
      fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_KEY_VALUE_MAP,
      required: true,
      defaultValue: '',
      options: [],
    },
  ],
});

registerEnricher(EnricherProviderType.ENRICHER_PROVIDER_PARKRUN, {
  id: 'parkrun',
  type: PluginType.PLUGIN_TYPE_ENRICHER,
  name: 'Parkrun',
  description: 'Detects Parkrun events based on location and time, and sets activity title',
  icon: '🏃',
  enabled: true,
  requiredIntegrations: [],
  configSchema: [
    {
      key: 'enable_titling',
      label: 'Set Title',
      description: 'Replace activity title with Parkrun event name',
      fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_BOOLEAN,
      required: false,
      defaultValue: 'true',
      options: [],
    },
    {
      key: 'tags',
      label: 'Tags',
      description: 'Comma-separated tags to add when matched (e.g., Parkrun)',
      fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_STRING,
      required: false,
      defaultValue: 'Parkrun',
      options: [],
    },
  ],
});

registerEnricher(EnricherProviderType.ENRICHER_PROVIDER_CONDITION_MATCHER, {
  id: 'condition-matcher',
  type: PluginType.PLUGIN_TYPE_ENRICHER,
  name: 'Condition Matcher',
  description: 'Applies title/description templates when conditions match (type, day, time, location)',
  icon: '🎯',
  enabled: true,
  requiredIntegrations: [],
  configSchema: [
    { key: 'activity_type', label: 'Activity Type', description: 'Match specific activity type', fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_STRING, required: false, defaultValue: '', options: [] },
    { key: 'days_of_week', label: 'Days of Week', description: 'Comma-separated days (Mon,Wed,Sat)', fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_STRING, required: false, defaultValue: '', options: [] },
    { key: 'start_time', label: 'Start Time', description: 'Earliest time (HH:MM)', fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_STRING, required: false, defaultValue: '', options: [] },
    { key: 'end_time', label: 'End Time', description: 'Latest time (HH:MM)', fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_STRING, required: false, defaultValue: '', options: [] },
    { key: 'location_lat', label: 'Location Latitude', description: 'Target latitude', fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_STRING, required: false, defaultValue: '', options: [] },
    { key: 'location_long', label: 'Location Longitude', description: 'Target longitude', fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_STRING, required: false, defaultValue: '', options: [] },
    { key: 'radius_m', label: 'Radius (meters)', description: 'Match radius', fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_STRING, required: false, defaultValue: '200', options: [] },
    { key: 'title_template', label: 'Title Template', description: 'Title when matched', fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_STRING, required: false, defaultValue: '', options: [] },
    { key: 'description_template', label: 'Description Template', description: 'Description when matched', fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_STRING, required: false, defaultValue: '', options: [] },
  ],
});

registerEnricher(EnricherProviderType.ENRICHER_PROVIDER_AUTO_INCREMENT, {
  id: 'auto-increment',
  type: PluginType.PLUGIN_TYPE_ENRICHER,
  name: 'Auto Increment',
  description: 'Appends an incrementing counter number to activity titles',
  icon: '🔢',
  enabled: true,
  requiredIntegrations: [],
  configSchema: [
    { key: 'counter_key', label: 'Counter Key', description: 'Unique identifier for this counter', fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_STRING, required: true, defaultValue: '', options: [] },
    { key: 'title_contains', label: 'Title Filter', description: 'Only increment if title contains this', fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_STRING, required: false, defaultValue: '', options: [] },
    { key: 'initial_value', label: 'Initial Value', description: 'Starting number', fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_STRING, required: false, defaultValue: '1', options: [] },
  ],
});

registerEnricher(EnricherProviderType.ENRICHER_PROVIDER_USER_INPUT, {
  id: 'user-input',
  type: PluginType.PLUGIN_TYPE_ENRICHER,
  name: 'User Input',
  description: 'Pauses pipeline to wait for user input (title, description, etc.)',
  icon: '✍️',
  enabled: true,
  requiredIntegrations: [],
  configSchema: [
    { key: 'fields', label: 'Required Fields', description: 'Comma-separated fields (title,description)', fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_STRING, required: false, defaultValue: 'description', options: [] },
  ],
});

registerEnricher(EnricherProviderType.ENRICHER_PROVIDER_ACTIVITY_FILTER, {
  id: 'activity-filter',
  type: PluginType.PLUGIN_TYPE_ENRICHER,
  name: 'Activity Filter',
  description: 'Skips activities matching exclude patterns or not matching include patterns',
  icon: '🚫',
  enabled: true,
  requiredIntegrations: [],
  configSchema: [
    { key: 'exclude_activity_types', label: 'Exclude Activity Types', description: 'Comma-separated types to exclude', fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_STRING, required: false, defaultValue: '', options: [] },
    { key: 'exclude_title_contains', label: 'Exclude Titles Containing', description: 'Patterns to exclude', fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_STRING, required: false, defaultValue: '', options: [] },
    { key: 'include_activity_types', label: 'Include Only Activity Types', description: 'Only include these types', fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_STRING, required: false, defaultValue: '', options: [] },
    { key: 'include_title_contains', label: 'Include Only Titles Containing', description: 'Must contain one of these', fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_STRING, required: false, defaultValue: '', options: [] },
  ],
});

registerEnricher(EnricherProviderType.ENRICHER_PROVIDER_MOCK, {
  id: 'mock',
  type: PluginType.PLUGIN_TYPE_ENRICHER,
  name: 'Mock',
  description: 'Testing enricher that simulates various behaviors',
  icon: '🧪',
  enabled: false, // Testing only
  requiredIntegrations: [],
  configSchema: [
    {
      key: 'behavior',
      label: 'Behavior',
      description: 'How the mock should behave',
      fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_SELECT,
      required: false,
      defaultValue: 'success',
      options: [
        { value: 'success', label: 'Success' },
        { value: 'lag', label: 'Simulate Lag' },
        { value: 'fail', label: 'Fail' },
      ],
    },
    { key: 'name', label: 'Activity Name', description: 'Name to set', fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_STRING, required: false, defaultValue: '', options: [] },
    { key: 'description', label: 'Description', description: 'Description to add', fieldType: ConfigFieldType.CONFIG_FIELD_TYPE_STRING, required: false, defaultValue: '', options: [] },
  ],
});
