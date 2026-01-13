# Adding Plugins

FitGlue provides scaffolding commands to minimize boilerplate when adding new plugins.

## Quick Start

```bash
# Add a new data source (TypeScript webhook handler)
make plugin-source name=garmin

# Add a new enricher (Go pipeline step)
make plugin-enricher name=weather

# Add a new destination (Go uploader)
make plugin-destination name=runkeeper
```

## What Gets Generated

### Source (`make plugin-source name=NAME`)

| Generated | Location |
|-----------|----------|
| Handler directory | `src/typescript/{name}-handler/` |
| package.json | Standard dependencies |
| Connector class | `src/connector.ts` with TODO markers |
| Terraform config | Appended to `functions.tf` |
| index.js export | Appended automatically |

**Remaining manual steps:**
1. Add `CloudEventSource.CLOUD_EVENT_SOURCE_{NAME}` to `events.proto`
2. Add `ActivitySource.SOURCE_{NAME}` to `activity.proto`
3. Run `make generate`
4. Add Firebase rewrite to `web/firebase.json`
5. Implement the connector logic

### Enricher (`make plugin-enricher name=NAME`)

| Generated | Location |
|-----------|----------|
| Provider file | `src/go/pkg/enricher_providers/{name}.go` |
| Proto enum | Auto-added to `user.proto` |
| Type regeneration | Runs `make generate` automatically |

**Remaining manual steps:**
1. Implement the `Enrich()` method
2. Add config fields to the manifest

### Destination (`make plugin-destination name=NAME`)

| Generated | Location |
|-----------|----------|
| Uploader function | `src/go/functions/{name}-uploader/` |
| Proto enum | Auto-added to `events.proto` |
| Terraform config | Appended to `functions.tf` |
| Type regeneration | Runs `make generate` automatically |

**Remaining manual steps:**
1. Implement upload logic
2. Add routing case in `router/function.go`

## Example: Adding a Weather Enricher

```bash
make plugin-enricher name=weather
```

Output:
```
Creating enricher: weather
  Using enum value: 13
✓ Added ENRICHER_PROVIDER_WEATHER = 13 to user.proto
✓ Created src/go/pkg/enricher_providers/weather.go
Running 'make generate' to regenerate types...
✓ Enricher scaffolding complete!

Next steps:
  1. Implement the Enrich() method
  2. Add config fields to the manifest if needed
  3. Run 'make test-go' to verify
```

Then edit `weather.go`:

```go
func (p *WeatherProvider) Enrich(ctx context.Context, activity *pb.StandardizedActivity, ...) (*EnrichmentResult, error) {
    // Fetch weather data for activity location/time
    weather := fetchWeather(activity.StartTime, activity.StartLocation)

    return &EnrichmentResult{
        Description: fmt.Sprintf("Weather: %s, %d°C", weather.Condition, weather.Temp),
    }, nil
}
```

## Naming Conventions

| Input | Generated Names |
|-------|-----------------|
| `garmin` | `GarminConnector`, `garmin-handler`, `GARMIN` |
| `heart_rate` | `HeartRateProvider`, `heart_rate.go`, `HEART_RATE` |

Use lowercase with underscores. The script handles case conversion.
