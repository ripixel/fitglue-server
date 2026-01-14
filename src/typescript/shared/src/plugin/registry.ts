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
  ConfigFieldType,
  IntegrationManifest,
  IntegrationAuthType,
} from '../types/pb/plugin';
import { EnricherProviderType } from '../types/pb/user';

// Registry stores
const sources: Map<string, PluginManifest> = new Map();
const enrichers: Map<EnricherProviderType, PluginManifest> = new Map();
const destinations: Map<string, PluginManifest> = new Map();
const integrations: Map<string, IntegrationManifest> = new Map();

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
 * Register an integration manifest
 */
export function registerIntegration(manifest: IntegrationManifest): void {
  integrations.set(manifest.id, manifest);
}

/**
 * Get the full plugin registry
 */
export function getRegistry(): PluginRegistryResponse {
  return {
    sources: Array.from(sources.values()),
    enrichers: Array.from(enrichers.values()),
    destinations: Array.from(destinations.values()),
    integrations: Array.from(integrations.values()).filter(i => i.enabled),
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
  integrations.clear();
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
  marketingDescription: '',
  features: [],
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
  marketingDescription: '',
  features: [],
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
  marketingDescription: '',
  features: [],
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
  marketingDescription: '',
  features: [],
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
  marketingDescription: `
### What is Workout Summary?
This booster uses advanced AI to analyze your strength training data and generate engaging, human-readable summaries of your sessions. Instead of just a list of numbers, you get a narrative description of your workout intensity, volume, and focus areas.

### How it works
FitGlue analyzes your sets, reps, and weight data, identifies your primary muscle groups targeted, and calculates total volume. It then uses a Large Language Model (LLM) to craft a summary that highlights your achievements, personal bests, and overall effort.
  `,
  features: [
    '✅ Narrative summaries of your strength workouts',
    '✅ Highlights key lifts and personal bests',
    '✅ Analyzes volume trends and intensity',
    '✅ customizable formats (Compact, Detailed, Verbose)',
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
  marketingDescription: `
### Visualize Your Training
The Muscle Heatmap booster generates a visual representation of your training volume by muscle group. Using a heatmap style visualization, you can instantly see which muscles you hit hardest and which ones might be lagging.

### How it works
Every exercise in your workout is mapped to primary and secondary muscle groups. We calculate the volume load for each muscle and generate a "heatmap" bar or chart that is appended to your activity description. It's a great way to show off your leg day or chest pump!
  `,
  features: [
    '✅ Visual heatmap of trained muscles',
    '✅ Supports Emoji, Percentage, and Text formats',
    '✅ Adjustable muscle coefficients',
    '✅ Works with all strength activities',
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
  marketingDescription: `
### Unified Heart Data
Sync your heart rate data from your Fitbit device and overlay it onto your imported activities. This is perfect for when you track a workout (like weightlifting) on one app but wear your Fitbit for health monitoring.

### How it works
When an activity is imported (e.g., from Hevy), FitGlue checks your Fitbit account for heart rate data recorded during that time window. It creates a second-by-second heart rate stream and attaches it to the activity before sending it to Strava or other destinations.
  `,
  features: [
    '✅ Merges heart rate from Fitbit to any activity',
    '✅ Perfect for gym workouts where you don\'t start a GPS watch',
    '✅ Accurate calorie data based on heart rate',
    '✅ Seamless background synchronization',
  ],
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
  marketingDescription: '',
  features: [],
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
  marketingDescription: '',
  features: [],
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
  marketingDescription: '',
  features: [],
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
  marketingDescription: '',
  features: [],
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
  marketingDescription: '',
  features: [],
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
  marketingDescription: '',
  features: [],
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
  marketingDescription: '',
  features: [],
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
  marketingDescription: '',
  features: [],
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
  marketingDescription: '',
  features: [],
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
  marketingDescription: '',
  features: [],
});

// ============================================================================
// Register all known integrations
// NOTE: Keep in sync with web/skier.tasks.mjs for marketing site
// ============================================================================

registerIntegration({
  id: 'hevy',
  name: 'Hevy',
  description: 'Import strength training workouts',
  icon: '🏋️',
  authType: IntegrationAuthType.INTEGRATION_AUTH_TYPE_API_KEY,
  enabled: true,
  docsUrl: 'https://docs.hevy.com',
  setupTitle: 'Connect Hevy',
  setupInstructions: `To connect Hevy, you'll need to generate an API key from the Hevy app:

1. Open the **Hevy app** on your phone
2. Go to **Settings** (gear icon)
3. Scroll down and tap **Developer API**
4. Tap **Generate API Key**
5. Copy the key and paste it below

Your workouts will automatically sync when you log them in Hevy.`,
  apiKeyLabel: 'Hevy API Key',
  apiKeyHelpUrl: 'https://docs.hevy.com/developer-api',
  marketingDescription: `
### What is Hevy?
Hevy is a popular workout tracking app designed for strength training enthusiasts. It lets you log exercises, sets, reps, and weights with a clean, intuitive interface.

### What FitGlue Does
FitGlue connects to your Hevy account via API key, allowing your logged workouts to flow into the FitGlue pipeline. From there, you can enhance them with AI summaries, muscle heatmaps, and more — then sync them to Strava or other destinations.
  `,
  features: [
    '✅ Import all your strength workouts automatically',
    '✅ Exercises, sets, reps, and weights included',
    '✅ Real-time sync when you finish a workout',
    '✅ Simple API key setup — no OAuth required',
  ],
});

registerIntegration({
  id: 'fitbit',
  name: 'Fitbit',
  description: 'Sync activities and health data from your Fitbit device',
  icon: '⌚',
  authType: IntegrationAuthType.INTEGRATION_AUTH_TYPE_OAUTH,
  enabled: true,
  docsUrl: '',
  setupTitle: 'Connect Fitbit',
  setupInstructions: 'Click **Connect** to authorize FitGlue to access your Fitbit activity and heart rate data. You will be redirected to Fitbit to sign in.',
  apiKeyLabel: '',
  apiKeyHelpUrl: '',
  marketingDescription: `
### What is Fitbit?
Fitbit is a leading wearable fitness tracker that monitors your activity, heart rate, sleep, and more. Millions of users rely on Fitbit devices to track their daily health metrics.

### What FitGlue Does
FitGlue connects to your Fitbit account via OAuth, enabling you to import activities and heart rate data. Use Fitbit as a source for activities, or overlay heart rate data onto workouts from other sources like Hevy.
  `,
  features: [
    '✅ Import activities tracked by your Fitbit device',
    '✅ Use heart rate data to enrich workouts from other sources',
    '✅ Secure OAuth connection — no passwords stored',
    '✅ Automatic sync of new activities',
  ],
});

registerIntegration({
  id: 'strava',
  name: 'Strava',
  description: 'Upload activities to Strava',
  icon: '🚴',
  authType: IntegrationAuthType.INTEGRATION_AUTH_TYPE_OAUTH,
  enabled: true,
  docsUrl: '',
  setupTitle: 'Connect Strava',
  setupInstructions: 'Click **Connect** to authorize FitGlue to upload enriched activities to your Strava profile. You will be redirected to Strava to sign in.',
  apiKeyLabel: '',
  apiKeyHelpUrl: '',
  marketingDescription: `
### What is Strava?
Strava is the social network for athletes. Share your activities with friends, compete on segments, and track your training progress over time.

### What FitGlue Does
FitGlue connects to your Strava account via OAuth and can upload your enriched activities directly. Workouts from Hevy or Fitbit — enhanced with AI descriptions, muscle heatmaps, and heart rate data — appear on your Strava feed automatically.
  `,
  features: [
    '✅ Upload enriched activities to Strava automatically',
    '✅ AI-generated descriptions appear in your feed',
    '✅ Muscle heatmaps and stats included',
    '✅ Secure OAuth connection',
  ],
});
