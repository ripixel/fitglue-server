# Plugin Registry Reference

The Plugin Registry is the central source of truth for all FitGlue plugins. It provides a self-describing API that returns plugin manifests including configuration schemas, marketing descriptions, and capabilities.

> [!IMPORTANT]
> The registry replaces the legacy `ENRICHER_CONFIG.md` documentation. Plugin configuration is now defined in code and served dynamically.

## API Endpoint

```
GET /api/registry
```

Returns the complete plugin registry:

```json
{
  "sources": [...],
  "enrichers": [...],
  "destinations": [...],
  "integrations": [...]
}
```

## Plugin Manifest Structure

Each plugin is described by a `PluginManifest`:

```typescript
interface PluginManifest {
  // Identity
  id: string;                    // Unique identifier (e.g., "workout-summary")
  type: PluginType;              // SOURCE, ENRICHER, or DESTINATION
  name: string;                  // Display name
  description: string;           // Short description
  icon: string;                  // Emoji icon
  enabled: boolean;              // Whether available for use

  // Requirements
  requiredIntegrations: string[]; // e.g., ["fitbit"] for Fitbit HR enricher

  // Configuration
  configSchema: ConfigFieldSchema[]; // User-configurable options

  // Marketing (for UI display)
  marketingDescription: string;  // Detailed markdown description
  features: string[];            // Feature bullet points
  transformations: Transformation[]; // Before/after examples
  useCases: string[];            // Example use cases

  // Type-specific
  enricherProviderType?: number; // For enrichers: maps to protobuf enum
  destinationType?: number;      // For destinations: maps to protobuf enum
}
```

## Configuration Schema

Plugins define their configuration using `ConfigFieldSchema`:

```typescript
interface ConfigFieldSchema {
  key: string;           // Field identifier
  label: string;         // Display label
  description: string;   // Help text
  fieldType: ConfigFieldType;
  required: boolean;
  defaultValue: string;
  options: SelectOption[];      // For SELECT/MULTI_SELECT
  keyOptions: SelectOption[];   // For KEY_VALUE_MAP keys
  valueOptions: SelectOption[]; // For KEY_VALUE_MAP values
  validation?: {
    minValue?: number;
    maxValue?: number;
  };
}
```

### Field Types

| Type | Description | Example |
|------|-------------|---------|
| `STRING` | Text input | API keys, template strings |
| `NUMBER` | Numeric input | Bar length (3-10) |
| `BOOLEAN` | Toggle | Enable/disable features |
| `SELECT` | Dropdown | Format selection |
| `MULTI_SELECT` | Multi-choice | Days of week |
| `KEY_VALUE_MAP` | Key-value pairs | Type mappings |

## Registration Patterns

### TypeScript (Sources & Destinations)

Sources and destinations register in `shared/src/plugin/registry.ts`:

```typescript
import { registerSource, registerEnricher } from './registry';
import { EnricherProviderType } from '../types/pb/user';

registerSource({
  id: 'hevy',
  type: PluginType.PLUGIN_TYPE_SOURCE,
  name: 'Hevy',
  description: 'Import strength training workouts from Hevy',
  icon: '🏋️',
  enabled: true,
  requiredIntegrations: ['hevy'],
  configSchema: [],
  marketingDescription: `
    ### Strength Training Source
    Import your weight training workouts from Hevy...
  `,
  features: [
    '✅ Import strength workouts with full exercise details',
    '✅ Capture sets, reps, weights, and rest periods',
  ],
  transformations: [],
  useCases: [],
});
```

### Go (Enrichers)

Enrichers self-register via `init()`:

```go
// pkg/enricher_providers/weather.go
func init() {
    plugin.RegisterManifest(
        pb.EnricherProviderType_ENRICHER_PROVIDER_WEATHER,
        &pb.PluginManifest{
            Id:          "weather",
            Name:        "Weather",
            Description: "Adds weather data to activities",
            Icon:        "🌤️",
            ConfigSchema: []*pb.ConfigFieldSchema{
                {
                    Key:       "units",
                    Label:     "Units",
                    FieldType: pb.ConfigFieldType_CONFIG_FIELD_TYPE_SELECT,
                    Options: []*pb.SelectOption{
                        {Value: "metric", Label: "Celsius"},
                        {Value: "imperial", Label: "Fahrenheit"},
                    },
                },
            },
        },
    )
    Register(NewWeatherProvider())
}
```

## Using the Registry

### Frontend Plugin Selection

The web app fetches the registry to dynamically render:

1. **Source selection** - Available data sources with descriptions
2. **Enricher configuration** - Forms generated from `configSchema`
3. **Destination selection** - Available upload targets

### Pipeline Wizard

The Pipeline Wizard uses the registry to:

1. Display available enrichers with marketing descriptions
2. Generate configuration forms based on `configSchema`
3. Show before/after transformations from `transformations`

## Why Self-Describing?

Previous approach (static `ENRICHER_CONFIG.md`):
- ❌ Documentation frequently out of sync with code
- ❌ Changes required updating two places
- ❌ No type safety for configuration

Current approach (registry):
- ✅ Single source of truth in code
- ✅ Type-safe configuration schemas
- ✅ Dynamic UI generation
- ✅ Always up-to-date

## Source Files

| File | Purpose |
|------|---------|
| `src/typescript/shared/src/plugin/registry.ts` | TypeScript registry with all manifests |
| `src/go/pkg/plugin/registry.go` | Go registry interface |
| `src/go/pkg/enricher_providers/*.go` | Individual enricher registrations |
| `src/proto/plugin.proto` | Protobuf definitions for manifests |

## Related Documentation

- [Plugin System](../architecture/plugin-system.md) - Architecture overview
- [Adding Plugins](../architecture/plugin-system.md#scaffolding) - Creating new plugins
