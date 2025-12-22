import * as admin from 'firebase-admin';
import { Storage } from '@google-cloud/storage';
import { config } from './config';

const PROJECT_ID = config.projectId;
const GCS_BUCKET = config.gcsBucket;

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: PROJECT_ID,
  });
}

const db = admin.firestore();
const storage = new Storage({ projectId: PROJECT_ID });

/**
 * Clean up execution records by test run IDs
 * This is the primary cleanup method - executions should be tagged with test_run_id
 */
export const cleanupExecutions = async (testRunIds: string[]) => {
  console.log(`[Cleanup] Deleting executions for ${testRunIds.length} test run(s)`);

  let totalDeleted = 0;
  for (const testRunId of testRunIds) {
    try {
      const executionsSnapshot = await db
        .collection('executions')
        .where('test_run_id', '==', testRunId)
        .get();

      const deletePromises = executionsSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);

      console.log(`[Cleanup] Deleted ${executionsSnapshot.size} executions for test run: ${testRunId}`);
      totalDeleted += executionsSnapshot.size;
    } catch (e) {
      console.log(`[Cleanup] Warning: Failed to delete executions for ${testRunId}: ${e}`);
    }
  }

  console.log(`[Cleanup] Total executions deleted: ${totalDeleted}`);
};

/**
 * Clean up test user document
 */
export const cleanupTestUser = async (userId: string) => {
  console.log(`[Cleanup] Deleting user: ${userId}`);
  await db.collection('users').doc(userId).delete();
};

/**
 * Clean up GCS artifacts for a test user
 */
export const cleanupGCSArtifacts = async (userId: string) => {
  console.log(`[Cleanup] Deleting GCS artifacts for: ${userId}`);
  const bucket = storage.bucket(GCS_BUCKET);
  const prefix = `activities/${userId}/`;

  try {
    const [files] = await bucket.getFiles({ prefix });
    const deletePromises = files.map(file => file.delete());
    await Promise.all(deletePromises);
    console.log(`[Cleanup] Deleted ${files.length} GCS files`);
  } catch (e) {
    console.log(`[Cleanup] Warning: GCS cleanup failed: ${e}`);
  }
};
