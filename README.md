# FitGlue

**FitGlue** is a serverless fitness data aggregation and routing platform built on Google Cloud Platform. It ingests workout data from multiple sources (Hevy, Fitbit), enriches it with standardized formats (FIT files), and routes it to connected services like Strava.

## Architecture

FitGlue uses an event-driven, microservices architecture deployed as Google Cloud Functions (Gen 2):

```
┌─────────────────┐
│  Data Sources   │
│     (Hevy)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│ Ingestion Layer │─────▶│  Pub/Sub     │
│ (Webhooks/Poll) │      │ (Raw Events) │
└─────────────────┘      └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐      ┌─────────────────┐
                         │  Enricher    │◀────▶│ External Data   │
                         │ (FIT Gen)    │      │ (e.g. FitBit)   │
                         └──────┬───────┘      └─────────────────┘
                                │
                                ▼
                         ┌──────────────┐
                         │    Router    │
                         └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │    Egress    │
                         │ Destinations │
                         │ (e.g. Strava)│
                         └──────────────┘
```

### Components

- **Hevy Handler** (TypeScript): Webhook receiver for Hevy workout data
- **Enricher** (Go): Converts raw activity data to FIT files and stores in GCS
- **Router** (Go): Routes enriched activities to configured destinations
- **Strava Uploader** (Go): Uploads FIT files to Strava via OAuth

### Enrichment Pipeline

The Enricher supports a flexible, configurable pipeline of providers that transform and enhance activities:

| Provider | Purpose | Output |
|----------|---------|--------|
| **Workout Summary** | Exercise breakdown with sets/reps/weight | Description text |
| **Muscle Heatmap** | Visual muscle activation chart | Description (emoji bars) |
| **Fitbit Heart Rate** | Fetches HR data from Fitbit API | Heart rate stream |
| **Virtual GPS** | Synthetic GPS routes for indoor activities | Lat/Long streams |
| **Source Link** | Links back to original workout | Description (URL) |
| **Metadata Passthrough** | Preserves source metadata | Name, Description |
| **Type Mapper** | Maps activity types (e.g., Ride → VirtualRide) | Activity type |
| **Parkrun** | Detects Parkrun events by location/time | Title, tags |
| **Condition Matcher** | Rule-based title/description templates | Title, Description |
| **Auto Increment** | Appends incrementing counter to titles | Title |
| **User Input** | Pauses for user input (title, description) | User-supplied values |
| **Activity Filter** | Skips activities matching patterns | Pipeline halt |
| **Branding** | Adds footer branding | Description |

See [Plugin System Architecture](docs/architecture/plugin-system.md) for details.

## Features

- 🔄 **Multi-source ingestion**: Hevy webhooks, extensible for Fitbit/Garmin/other sources
- 📦 **Standardized output**: Generates industry-standard FIT files
- 🚀 **Serverless**: Auto-scaling Cloud Functions with Pub/Sub event routing
- 🔐 **Secure**: Secret Manager integration, HMAC signature verification
- 🧪 **Testable**: Comprehensive unit tests, integration tests with test run ID tracking
- 📊 **Observable**: Structured logging, automatic execution tracking, Firestore audit logs

- 🎯 **Framework-driven**: Consistent execution logging across all functions (Go & TypeScript)
## Tech Stack

- **Languages**: Go 1.25, TypeScript 5.x
- **Infrastructure**: Terraform, Google Cloud Functions v2
- **Storage**: Cloud Storage (FIT files), Firestore (metadata)
- **Messaging**: Cloud Pub/Sub
- **CI/CD**: CircleCI with OIDC authentication

## Documentation

### Getting Started
- **[Architecture Overview](docs/architecture/overview.md)** - System components and data flow
- **[Local Development](docs/development/local-development.md)** - Running the stack locally
- **[Admin CLI](docs/reference/admin-cli.md)** - User management and pipeline configuration

### Plugin Development
- **[Plugin System](docs/architecture/plugin-system.md)** - Architecture and scaffolding
- **[Plugin Registry](docs/reference/registry.md)** - Self-describing plugin API

### Testing
- **[Testing Guide](docs/development/testing.md)** - Unit, integration, and manual QA
- **[Enricher Testing](docs/guides/enricher-testing.md)** - Testing enrichment providers
- **[Debugging](docs/development/debugging.md)** - Troubleshooting guide

### Architecture
- **[Services & Stores](docs/architecture/services-and-stores.md)** - Business logic vs data access
- **[Security](docs/architecture/security.md)** - Authorization and access control
- **[Connectors](docs/architecture/connectors.md)** - Data source integrations
- **[Execution Logging](docs/architecture/execution-logging.md)** - Observability framework
- **[Architecture Decisions](docs/decisions/ADR.md)** - Key design choices

### Infrastructure
- **[CI/CD Guide](docs/infrastructure/cicd.md)** - Deployment pipeline
- **[Terraform](docs/infrastructure/terraform.md)** - Infrastructure as code

### Reference
- **[Error Codes](docs/reference/errors.md)** - Structured error types

### Guides
- **[OAuth Integration](docs/guides/oauth-integration.md)** - Strava and Fitbit OAuth
- **[Fitbit Setup](docs/guides/fitbit-setup.md)** - Step-by-step configuration
- **[FIT Generation](docs/guides/fit-generation.md)** - Generating FIT files
- **[OpenAPI Clients](docs/guides/openapi-clients.md)** - API client generation

## Quick Start

### Prerequisites

- Go 1.25+
- Node.js 20+
- `protoc` (Protocol Buffers compiler)
- Google Cloud SDK (for deployment)

### Setup

```bash
# Install dependencies and generate code
make setup

# Build all services
make build

# Run tests
make test

# Start local development environment
make local
```

See [Local Development](docs/LOCAL_DEVELOPMENT.md) for detailed instructions.

## Project Structure

```
fitglue-server/
├── src/
│   ├── go/                 # Go monorepo
│   │   ├── functions/      # Cloud Functions
│   │   └── pkg/            # Shared libraries
│   ├── typescript/         # TypeScript workspace
│   │   ├── hevy-handler/
│   │   └── shared/         # @fitglue/shared
│   └── proto/              # Protocol Buffer definitions
├── terraform/              # Infrastructure as Code
├── scripts/                # Local development scripts
├── integration-tests/      # E2E tests
└── docs/                   # Documentation
```

## Contributing

This is a personal project, but suggestions and feedback are welcome via issues.

## License

MIT
