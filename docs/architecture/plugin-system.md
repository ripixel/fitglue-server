# Plugin System Architecture

FitGlue uses a **type-safe, self-registering plugin architecture** for extensible data processing.

## Plugin Types

| Type | Language | Purpose | Example |
|------|----------|---------|---------|
| **Source** | TypeScript | Ingests data from external services | Hevy, Fitbit webhooks |
| **Enricher** | Go | Transforms/enhances activities in pipeline | Workout Summary, Heart Rate |
| **Destination** | Go | Uploads processed activities | Strava |

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Sources   │────▶│   Enrichers  │────▶│  Destinations   │
│ (TypeScript)│     │    (Go)      │     │     (Go)        │
└─────────────┘     └──────────────┘     └─────────────────┘
       │                   │                     │
       └───────────────────┼─────────────────────┘
                           ▼
                 ┌──────────────────┐
                 │  Plugin Registry │
                 │    GET /api/plugins   │
                 └──────────────────┘
```

## Registration Patterns

### Go Enrichers (Self-Registration)

Enrichers register themselves via `init()`:

```go
// pkg/enricher_providers/weather.go
func init() {
    plugin.RegisterManifest(pb.EnricherProviderType_ENRICHER_PROVIDER_WEATHER, &pb.PluginManifest{
        Id:          "weather",
        Name:        "Weather",
        Description: "Adds weather data to activities",
        Icon:        "🌤️",
        ConfigSchema: []*pb.ConfigFieldSchema{
            {Key: "units", Label: "Units", FieldType: pb.ConfigFieldType_CONFIG_FIELD_TYPE_SELECT},
        },
    })
    Register(NewWeatherProvider())
}
```

### TypeScript Sources

Sources register in `shared/src/plugin/registry.ts`:

```typescript
registerSource({
  id: 'hevy',
  name: 'Hevy',
  icon: '💪',
  enabled: true,
});
```

## Configuration Schema

Plugins define their configuration using `ConfigFieldSchema`:

| Field Type | Description | Example |
|------------|-------------|---------|
| `STRING` | Text input | API keys, names |
| `NUMBER` | Numeric input | Timeout values |
| `BOOLEAN` | Toggle | Enable/disable features |
| `SELECT` | Dropdown | Format options |
| `MULTI_SELECT` | Multi-choice | Days of week |
| `KEY_VALUE_MAP` | Key-value pairs | Type mappings |

## Discovery API

The plugin registry is exposed via:

```
GET /api/plugins
```

Returns:
```json
{
  "sources": [...],
  "enrichers": [...],
  "destinations": [...]
}
```

Used by the frontend to dynamically render plugin selection and configuration forms.

## Related Docs

- [Adding Plugins](../development/adding-plugins.md) - Scaffolding new plugins
- [Enricher Config](./ENRICHER_CONFIG.md) - Configuring pipelines
