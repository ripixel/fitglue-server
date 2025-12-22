# Integration Tests

This directory contains integration tests for the FitGlue application, supporting both local development and deployed environments.

## Test Suites

### Local Validation (`local.test.ts`)
Tests local Functions Framework instances running on localhost.

- **Purpose**: Fast feedback during local development
- **Triggers**: Direct HTTP calls to all functions (including Pub/Sub-triggered ones via CloudEvent format)
- **Requirements**: Local functions must be running (`./scripts/local_run.sh`)

**Run:**
```bash
./scripts/local_run.sh  # Start local functions
npm run test:local
```

### Deployed Validation (`deployed.test.ts`)
Tests deployed Cloud Functions in GCP environments (dev, test, prod).

- **Purpose**: Validate deployed infrastructure and end-to-end flows
- **Triggers**:
  - HTTP calls to public endpoints (`hevy-webhook-handler`, `keiser-poller`)
  - Pub/Sub message publishing for event-triggered functions (`enricher`, `router`, `strava-uploader`)
- **Requirements**:
  - GCP authentication configured (`gcloud auth application-default login`)
  - `TEST_ENVIRONMENT` set to target environment

**Run:**
```bash
# Authenticate with GCP
gcloud auth application-default login

# Test against Dev environment
npm run test:dev

# Test against Test environment (future)
npm run test:test
```

## Test Run ID Tracking

Each test generates a unique `testRunId` that is propagated through all function executions:

- **HTTP Functions**: Passed via `X-Test-Run-Id` header
- **Pub/Sub Functions**: Passed via message attributes

This enables:
- ✅ Precise verification of test executions
- ✅ Complete cleanup of test data
- ✅ No test pollution between runs
- ✅ Parallel test execution (future)

**Example:**
```typescript
describe('My Test Suite', () => {
  const testRunIds: string[] = []; // Track all test run IDs

  it('should process activity', async () => {
    const testRunId = randomUUID(); // Unique ID per test
    testRunIds.push(testRunId);

    // HTTP request
    await axios.post(endpoint, payload, {
      headers: { 'X-Test-Run-Id': testRunId }
    });

    // Pub/Sub message
    await publishRawActivity(payload, testRunId);

    // Verify by test run ID (not timestamp!)
    await waitForExecutionActivity({
      testRunId,
      minExecutions: 1
    });
  });

  afterAll(async () => {
    // Clean up all executions from all tests
    await cleanupExecutions(testRunIds);
    await cleanupGCSArtifacts(userId);
    await cleanupTestUser(userId);
  });
});
```

## Configuration

### Environment Variables

Set `TEST_ENVIRONMENT` to control which environment to test:

- `local` (default) - localhost Functions Framework instances
- `dev` - fitglue-server-dev GCP project
- `test` - fitglue-server-test GCP project
- `prod` - fitglue-server-prod GCP project

Example:
```bash
export TEST_ENVIRONMENT=dev
npm run test:deployed
```

### Environment Configuration

Environment-specific settings are defined in `environments.json`:

- Project ID
- Region
- GCS bucket name
- Function endpoints (HTTP-triggered)
- Pub/Sub topic names (event-triggered)

## Architecture

### Configuration (`config.ts`)
Loads environment-specific configuration from `environments.json` based on `TEST_ENVIRONMENT`.

### Test Setup (`setup.ts`)
- Creates test users in Firestore
- **Focused on setup only** - no cleanup logic

### Test Cleanup (`cleanup.ts`)
- `cleanupExecutions(testRunIds[])` - Deletes execution records by test run IDs
- `cleanupTestUser(userId)` - Deletes user document
- `cleanupGCSArtifacts(userId)` - Removes GCS files
- **Separated from setup for clarity**

### Pub/Sub Helpers (`pubsub-helpers.ts`)
Utilities for publishing messages to Pub/Sub topics:

```typescript
// All functions accept optional testRunId
publishRawActivity(payload, testRunId?)      // Triggers Enricher
publishEnrichedActivity(payload, testRunId?) // Triggers Router
publishUploadJob(payload, testRunId?)        // Triggers Strava Uploader
```

Test run ID is passed as Pub/Sub message attribute:
```typescript
await topic.publishMessage({
  data: dataBuffer,
  attributes: { test_run_id: testRunId }
});
```

### Verification Helpers (`verification-helpers.ts`)

**Key Function:**
```typescript
waitForExecutionActivity({
  testRunId: string;      // Required - test run ID to query
  timeout?: number;       // Optional - default 30s
  checkInterval?: number; // Optional - default 2s
  minExecutions?: number; // Optional - default 1
})
```

**How it works:**
- Queries Firestore `executions` collection by `test_run_id`
- Polls until minimum executions found or timeout
- **No timestamp-based queries** - precise test isolation

## Authentication

### Local Tests
No authentication required - tests run against localhost.

### Deployed Tests
Requires GCP Application Default Credentials (ADC):

```bash
gcloud auth application-default login
```

This provides access to:
- Pub/Sub (for publishing messages)
- Firestore (for test user setup/cleanup and verification)
- Cloud Storage (for artifact cleanup and verification)

## Test Isolation

Each test is completely isolated by test run ID:

```
Test 1: testRunId1 → HTTP/PubSub with testRunId1 → Verify by testRunId1
Test 2: testRunId2 → HTTP/PubSub with testRunId2 → Verify by testRunId2
Test 3: testRunId3 → HTTP/PubSub with testRunId3 → Verify by testRunId3
...
Cleanup: Delete executions WHERE test_run_id IN [testRunId1, testRunId2, testRunId3]
```

**Benefits:**
- ✅ No false positives from other tests
- ✅ Complete cleanup of test executions
- ✅ Can identify which test created which execution
- ✅ Enables parallel test execution

## Troubleshooting

### "Timeout waiting for execution activity"
- **Cause**: Function didn't execute or took too long
- **Debug**:
  1. Check Cloud Functions logs in GCP Console
  2. Search for executions with your test run ID in Firestore
  3. Verify Pub/Sub topic configuration
  4. Check function deployment status
- **Solution**: Increase timeout (cold starts can take 30-45s)

### "Pub/Sub topics not configured for this environment"
- **Cause**: Running deployed tests in local environment
- **Solution**: Set `TEST_ENVIRONMENT=dev` (or test/prod)

### "Invalid TEST_ENVIRONMENT"
- **Cause**: Typo in environment name
- **Solution**: Use one of: `local`, `dev`, `test`, `prod`

### Authentication errors
- **Cause**: ADC not configured or expired
- **Solution**: Run `gcloud auth application-default login`

### Execution records not found
- **Cause**: Framework not extracting test_run_id
- **Debug**: Check function logs for execution_id and test_run_id
- **Solution**: Verify header/attribute is being passed correctly

## Best Practices

1. **Generate test run ID per test** - Not per suite
2. **Track all test run IDs** - For comprehensive cleanup
3. **Verify by test run ID** - Never by timestamp
4. **Clean up by test run ID** - Ensures complete cleanup
5. **Use unique user IDs** - Avoid conflicts between test runs
6. **Monitor costs** - Deployed tests invoke real Cloud Functions

## CI/CD Integration

Integration tests can be run in CI/CD pipelines:

```yaml
# Example CircleCI job
- run:
    name: Integration Tests - Dev
    command: |
      gcloud auth activate-service-account --key-file=${GOOGLE_APPLICATION_CREDENTIALS}
      npm run test:dev
```

Ensure the service account has necessary permissions:
- `roles/pubsub.publisher`
- `roles/datastore.user`
- `roles/storage.objectAdmin` (for test bucket)

## Framework Integration

Tests rely on the execution logging framework:

- **Go Functions**: Extract `test_run_id` from event extensions
- **TypeScript Functions**: Extract `test_run_id` from headers or Pub/Sub attributes
- **Execution Records**: Tagged with `test_run_id` field

See [EXECUTION_LOGGING.md](EXECUTION_LOGGING.md) for framework details.
