# Connector Framework

The Connector Framework provides a standardized way to ingest, deduce, and normalize activity data from third-party sources (Hevy, Fitbit, Garmin, etc.) into the FitGlue platform.

## Architecture

Connectors are designed as **Stateless, Per-Request** components. The framework handles the boilerplate of authentication, routing, and error handling, allowing developers to focus on source-specific logic.

### Core Lifecycle

Every webhook request flows through the `createWebhookProcessor` which enforces the following lifecycle:

1.  **Instantiation**: A new `Connector` instance is created with the current `FrameworkContext` (User ID, Logger, Stores).
2.  **Authentication**: The request is verified to belong to an authenticated User ID.
3.  **Verification (Optional)**: `connector.verifyRequest()` allows handling challenge/response flows (e.g., Strava/Fitbit verification).
4.  **Extraction**: `connector.extractId()` parses the incoming payload to find the external Activity ID.
5.  **Deduplication**: The framework checks `UserStore` to see if this activity ID has already been processed for this connector.
6.  **Resolution**: The User's configuration for this specific integration is loaded and validated (`connector.validateConfig()`).
7.  **Fetching & Mapping**: `connector.fetchAndMap()` retrieves full details from the provider API and converts them to `StandardizedActivity`.
8.  **Publishing**: The framework publishes the standardized activity to Cloud Pub/Sub for enrichment and records success in `ActivityStore`.

## Implementation Guide

To implement a new integration, extend the `BaseConnector`.

```typescript
import { BaseConnector, ConnectorConfig } from '../../shared/src/framework';

interface MyConfig extends ConnectorConfig {
  apiKey: string;
}

export class MyConnector extends BaseConnector<MyConfig, MyRawPayload> {
  // 1. Define Unique Name
  readonly name = 'my_provider';
  readonly activitySource = ActivitySource.SOURCE_MYPROVIDER;

  // 2. Extract ID from Webhook
  extractId(body: any): string | null {
    return body?.activity_id || null;
  }

  // 3. Fetch Data & Map to Standard Format
  async fetchAndMap(externalId: string, config: MyConfig): Promise<StandardizedActivity[]> {
    const rawData = await this.myApiClient.get(externalId, config.apiKey);
    return [this.mapToStandard(rawData)];
  }
}
```

## Key Components

### BaseConnector
The abstract base class that provides common utilities and enforces the interface.
- `context`: Access to `logger`, `services`, `stores`.
- `verifyRequest`: Override to handle GET challenges (e.g. `hub.challenge`).

### FrameworkContext
Injected into the constructor. Contains:
- `logger`: Structured JSON logger.
- `userId`: Authenticated User ID.
- `stores`: Direct access to typed Firestore stores (`UserStore`, `ActivityStore`).
- `services`: Domain services (`UserService`).

### Type Safety
The framework relies on strict typing:
- **Config**: Must define the shape of User Integration config.
- **Raw Payload**: Defines the shape of the webhook body.
- **StandardizedActivity**: The output format used by downstream Enrichers.

## Best Practices

1.  **Immutability**: Do not store request-specific state on `this` (other than `context`).
2.  **Idempotency**: The framework handles deduplication matching, but `fetchAndMap` should be safe to retry.
3.  **Validation**: Use `validateConfig` to ensure the user has provided all necessary credentials before attempting API calls.
