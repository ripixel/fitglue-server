import axios from 'axios';
import { randomUUID } from 'crypto';
import { setupTestUser } from "./setup";
import { cleanupTestUser, cleanupExecutions, cleanupGCSArtifacts } from "./cleanup";
import { publishRawActivity, publishEnrichedActivity, publishUploadJob } from './pubsub-helpers';
import { waitForExecutionActivity } from './verification-helpers';
import { config } from './config';

describe('Deployed Environment Integration Tests', () => {
  let userId: string;
  const testRunIds: string[] = []; // Track all test run IDs for cleanup

  beforeAll(async () => {
    // Verify we're not running in local mode
    if (config.environment === 'local') {
      throw new Error(
        'Deployed tests should not run in local environment. Use TEST_ENVIRONMENT=dev|test|prod'
      );
    }

    userId = `test_${randomUUID()}`;
    await setupTestUser(userId);
    console.log(`[Deployed Tests] Testing against: ${config.projectId}`);
    console.log(`[Deployed Tests] Test user: ${userId}`);
  });

  afterAll(async () => {
    // Clean up all executions from all tests
    if (testRunIds.length > 0) {
      await cleanupExecutions(testRunIds);
    }

    // Clean up user and GCS artifacts
    if (userId) {
      await cleanupGCSArtifacts(userId);
      await cleanupTestUser(userId);
    }
  });

  describe('HTTP-triggered functions', () => {
    it('should accept Hevy webhook', async () => {
      const testRunId = randomUUID();
      testRunIds.push(testRunId);

      if (!config.endpoints?.hevyWebhook) {
        throw new Error('Hevy webhook endpoint not configured');
      }

      const payload = {
        user_id: 'test_hevy_user',
        workout: {
          title: 'Deployed Integration Test Workout',
          exercises: [],
        },
      };

      // Testing endpoint reachability with invalid signature
      // Expected: 200 (no signature check), 401/403 (signature verification enabled)
      try {
        const res = await axios.post(config.endpoints.hevyWebhook, payload, {
          headers: {
            'Content-Type': 'application/json',
            'X-Hevy-Signature': 'invalid-signature-for-testing',
            'X-Test-Run-Id': testRunId,
          },
          validateStatus: () => true, // Accept any status
        });

        // We expect either:
        // - 401/403 (signature verification failed - good!)
        // - 200 (signature verification passed or disabled - also acceptable for test)
        expect([200, 401, 403]).toContain(res.status);
        console.log(`[Hevy Webhook] Response status: ${res.status}`);
      } catch (e: any) {
        // Network errors are failures
        throw new Error(`Failed to reach Hevy webhook: ${e.message}`);
      }
    });

    it('should trigger Keiser Poller manually', async () => {
      const testRunId = randomUUID();
      testRunIds.push(testRunId);

      if (!config.endpoints?.keiserPoller) {
        throw new Error('Keiser Poller endpoint not configured');
      }

      // Keiser Poller is normally triggered by Cloud Scheduler
      // We're testing manual HTTP trigger for integration testing
      try {
        const res = await axios.post(config.endpoints.keiserPoller, {}, {
          headers: {
            'Content-Type': 'application/json',
            'X-Test-Run-Id': testRunId,
          },
          validateStatus: () => true,
        });

        // Expected: 200 (success) or 500 (if no users configured for Keiser)
        expect([200, 500]).toContain(res.status);
        console.log(`[Keiser Poller] Response status: ${res.status}`);
      } catch (e: any) {
        throw new Error(`Failed to reach Keiser Poller: ${e.message}`);
      }
    });
  });

  describe('Pub/Sub-triggered functions', () => {
    // Increase timeout for these tests as Cloud Functions can take time to cold start
    jest.setTimeout(60000); // 60 seconds

    it('should trigger Enricher via Pub/Sub', async () => {
      const testRunId = randomUUID();
      testRunIds.push(testRunId);

      const payload = {
        source: 2, // HEVY
        user_id: userId,
        timestamp: new Date().toISOString(),
        original_payload_json: JSON.stringify({ test: 'data' }),
        metadata: { test: 'true' }, // map<string, string> per protobuf
      };

      console.log('[Enricher] Publishing to raw-activity topic...');
      const messageId = await publishRawActivity(payload, testRunId);
      console.log(`[Enricher] Published message: ${messageId}`);

      // Wait for function execution
      console.log('[Enricher] Waiting for execution activity...');
      await waitForExecutionActivity({
        testRunId,
        timeout: 45000, // 45s - Cloud Functions can take time to cold start
        checkInterval: 3000, // Check every 3s
        minExecutions: 1,
      });

      console.log('[Enricher] ✓ Function executed successfully');
    });

    it('should trigger Router via Pub/Sub', async () => {
      const testRunId = randomUUID();
      testRunIds.push(testRunId);

      const payload = {
        user_id: userId,
        gcs_uri: 'gs://test-bucket/test.fit',
        description: 'Test activity',
      };

      console.log('[Router] Publishing to enriched-activity topic...');
      const messageId = await publishEnrichedActivity(payload, testRunId);
      console.log(`[Router] Published message: ${messageId}`);

      // Wait for function execution
      console.log('[Router] Waiting for execution activity...');
      await waitForExecutionActivity({
        testRunId,
        timeout: 45000,
        checkInterval: 3000,
        minExecutions: 1,
      });

      console.log('[Router] ✓ Function executed successfully');
    });

    it('should trigger Strava Uploader via Pub/Sub', async () => {
      const testRunId = randomUUID();
      testRunIds.push(testRunId);

      const payload = {
        user_id: userId,
        gcs_uri: 'gs://test-bucket/test.fit',
        description: 'Test upload',
      };

      console.log('[Uploader] Publishing to upload-strava topic...');
      const messageId = await publishUploadJob(payload, testRunId);
      console.log(`[Uploader] Published message: ${messageId}`);

      console.log('[Uploader] Waiting for execution activity...');
      await waitForExecutionActivity({
        testRunId,
        timeout: 45000,
        checkInterval: 3000,
        minExecutions: 1,
      });

      console.log('[Uploader] ✓ Function executed successfully');
    });
  });

  describe('End-to-end pipeline', () => {
    jest.setTimeout(90000); // 90 seconds for full pipeline

    it('should process activity through entire pipeline', async () => {
      const testRunId = randomUUID();
      testRunIds.push(testRunId);

      const payload = {
        source: 1, // HEVY
        user_id: userId,
        timestamp: new Date().toISOString(),
        original_payload_json: JSON.stringify({
          workout_title: 'E2E Test Workout',
          exercises: [],
        }),
        metadata: { e2e_test: 'true' },
      };

      console.log('[E2E] Publishing to raw-activity topic...');
      const messageId = await publishRawActivity(payload, testRunId);
      console.log(`[E2E] Published message: ${messageId}`);

      // Wait for multiple executions (enricher -> router -> uploader)
      console.log('[E2E] Waiting for pipeline execution...');
      await waitForExecutionActivity({
        testRunId,
        timeout: 75000, // 75s for full pipeline
        checkInterval: 5000, // Check every 5s
        minExecutions: 3, // enricher + router + uploader
      });

      console.log('[E2E] ✓ Full pipeline executed successfully');
    });
  });
});
