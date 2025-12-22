import * as admin from 'firebase-admin';
import { config } from './config';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: config.projectId,
  });
}

const db = admin.firestore();

export interface WaitForExecutionOptions {
  testRunId: string;
  timeout?: number;
  checkInterval?: number;
  minExecutions?: number;
}

/**
 * Wait for execution records to appear for a specific test run
 * Uses test_run_id to precisely identify executions from this test
 */
export async function waitForExecutionActivity(options: WaitForExecutionOptions): Promise<void> {
  const {
    testRunId,
    timeout = 30000,
    checkInterval = 2000,
    minExecutions = 1,
  } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const snapshot = await db
        .collection('executions')
        .where('test_run_id', '==', testRunId)
        .get();

      if (snapshot.size >= minExecutions) {
        console.log(`[Verification] Found ${snapshot.size} execution(s) for test run: ${testRunId}`);
        return;
      }

      console.log(
        `[Verification] Waiting for executions (found ${snapshot.size}/${minExecutions})...`
      );
    } catch (e) {
      console.log(`[Verification] Error checking executions: ${e}`);
    }

    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  throw new Error(
    `Timeout waiting for executions. Expected at least ${minExecutions} execution(s) for test run: ${testRunId}`
  );
}
