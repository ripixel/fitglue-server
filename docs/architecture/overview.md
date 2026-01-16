# Architecture Overview

FitGlue is a serverless fitness data aggregation and routing platform built on Google Cloud Platform. It ingests workout data from multiple sources, enriches it with standardized formats and additional data, and routes it to connected services.

## System Components

```
                                    ┌─────────────────────────────────────┐
                                    │         Google Cloud Platform       │
                                    └─────────────────────────────────────┘
                                                     │
    ┌──────────────────────────────────────────────────────────────────────────────┐
    │                                                                              │
    │  ┌─────────────────┐                                                         │
    │  │   DATA SOURCES  │                                                         │
    │  │                 │                                                         │
    │  │  • Hevy         │                                                         │
    │  │  • Fitbit       │                                                         │
    │  │  • Apple Health │                                                         │
    │  │  • Health Connect│                                                        │
    │  └────────┬────────┘                                                         │
    │           │                                                                  │
    │           ▼                                                                  │
    │  ┌─────────────────┐      ┌──────────────┐                                   │
    │  │ INGESTION LAYER │─────▶│   Pub/Sub    │                                   │
    │  │   (Webhooks)    │      │ (Raw Events) │                                   │
    │  │   TypeScript    │      └──────┬───────┘                                   │
    │  └─────────────────┘             │                                           │
    │                                  ▼                                           │
    │                         ┌──────────────────┐      ┌─────────────────┐        │
    │                         │     ENRICHER     │◀────▶│  External APIs  │        │
    │                         │   (Pipeline)     │      │  (Fitbit, etc)  │        │
    │                         │       Go         │      └─────────────────┘        │
    │                         └────────┬─────────┘                                 │
    │                                  │                                           │
    │                                  ▼                                           │
    │  ┌─────────────────┐      ┌──────────────┐      ┌─────────────────┐          │
    │  │  Cloud Storage  │◀─────│    ROUTER    │─────▶│     Pub/Sub     │          │
    │  │   (FIT Files)   │      │      Go      │      │ (Upload Jobs)   │          │
    │  └─────────────────┘      └──────────────┘      └────────┬────────┘          │
    │                                                          │                   │
    │                                                          ▼                   │
    │                                                 ┌──────────────────┐         │
    │                                                 │   DESTINATIONS   │         │
    │                                                 │                  │         │
    │                                                 │  • Strava        │         │
    │                                                 │       Go         │         │
    │                                                 └──────────────────┘         │
    │                                                                              │
    │  ┌─────────────────┐      ┌──────────────┐                                   │
    │  │    Firestore    │      │ Secret Mgr   │                                   │
    │  │   (Metadata)    │      │  (Secrets)   │                                   │
    │  └─────────────────┘      └──────────────┘                                   │
    │                                                                              │
    └──────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Ingestion

Data enters the system through source-specific handlers:

1. **Webhooks** (Hevy): External services push data via authenticated webhooks
2. **Polling** (Fitbit): Scheduled pulls from APIs
3. **Mobile Push** (Apple Health, Health Connect): Mobile apps push via authenticated API

Each handler:
- Validates authentication (HMAC signature or API key)
- Transforms source-specific format → `StandardizedActivity` protobuf
- Publishes to `raw-activities` Pub/Sub topic

### 2. Enrichment

The **Enricher** function processes raw activities through a configurable pipeline:

1. Receives `RawActivityEvent` from Pub/Sub
2. Looks up user's pipelines from Firestore
3. For each matching pipeline, runs enrichers in sequence
4. Each enricher can add/modify:
   - Metadata (name, description, activity type)
   - Data streams (heart rate, GPS coordinates)
   - Artifacts (FIT files stored in GCS)
5. Publishes `EnrichedActivityEvent` to `enriched-activities` topic

### 3. Routing

The **Router** function distributes enriched activities:

1. Receives `EnrichedActivityEvent` from Pub/Sub
2. Reads destination list from the event payload
3. Publishes destination-specific upload jobs:
   - Strava → `strava-upload-jobs` topic

### 4. Egress

Destination-specific uploaders handle delivery:

- **Strava Uploader**: Uploads FIT file via Strava API
- Future: Garmin, TrainingPeaks, etc.

## Plugin Architecture

FitGlue uses a type-safe, self-registering plugin system:

| Plugin Type | Language | Purpose |
|-------------|----------|---------|
| **Source** | TypeScript | Ingests data from external services |
| **Enricher** | Go | Transforms/enhances activities in pipeline |
| **Destination** | Go | Uploads processed activities |

All plugins register themselves with the central **Plugin Registry**, which exposes their configuration schemas via `GET /api/plugins`.

See [Plugin System](plugin-system.md) and [Registry Reference](../reference/registry.md) for details.

## Key Technologies

| Component | Technology |
|-----------|------------|
| Compute | Cloud Functions Gen 2 (Cloud Run) |
| Messaging | Cloud Pub/Sub |
| Database | Cloud Firestore |
| Storage | Cloud Storage |
| Secrets | Secret Manager |
| Infrastructure | Terraform |

## Environments

| Environment | Project ID | URL |
|-------------|------------|-----|
| Dev | `fitglue-server-dev` | `https://dev.fitglue.tech` |
| Test | `fitglue-server-test` | `https://test.fitglue.tech` |
| Prod | `fitglue-server-prod` | `https://fitglue.tech` |

## Related Documentation

- [Plugin System](plugin-system.md) - How plugins work
- [Services & Stores](services-and-stores.md) - Business logic architecture
- [Execution Logging](execution-logging.md) - Observability framework
- [Security](security.md) - Authorization and access control
